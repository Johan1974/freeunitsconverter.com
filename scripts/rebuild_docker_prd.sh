#!/bin/bash
set -e

echo "Stopping old production containers..."
docker compose -p freeunitsconverter_prd -f docker-compose.prd.yml down

# Ensure Certbot challenge folder exists
CERTBOT_WWW="./certbot/www"
mkdir -p "$CERTBOT_WWW/.well-known/acme-challenge"

CERT_PATH="./certbot/conf/live/freeunitsconverter.com/fullchain.pem"
if [ ! -f "$CERT_PATH" ]; then
    echo "Certificates not found. Running temporary HTTP container for Certbot..."
    docker compose -p freeunitsconverter_prd -f docker-compose.prd.yml up -d nginx_http

    docker compose -p freeunitsconverter_prd -f docker-compose.prd.yml run --rm certbot certonly \
        --webroot -w /var/www/certbot \
        -d freeunitsconverter.com -d www.freeunitsconverter.com \
        --email johanlijffijt@gmail.com \
        --agree-tos --non-interactive

    docker compose -p freeunitsconverter_prd -f docker-compose.prd.yml stop nginx_http
    docker compose -p freeunitsconverter_prd -f docker-compose.prd.yml rm -f nginx_http
fi

# ---------------------------
# 0️⃣ Make frontend/static-pages writable
# ---------------------------
echo "🔧 Ensuring static-pages folder is writable..."
sudo chown -R $USER:$USER ./frontend

# ---------------------------
# 1️⃣ Generate static SEO pages & sitemap
# ---------------------------
echo "🔄 Generating static converter pages & sitemap..."
cd frontend
node generate-pages.js
node generate-sitemap.js
cd ..
echo "✅ Static pages and sitemap generated."

# ---------------------------
# 2️⃣ Build and start main production containers
# ---------------------------
echo "Building and starting production containers..."
docker compose -p freeunitsconverter_prd -f docker-compose.prd.yml up -d --build frontend backend nginx

echo "✅ Production environment is up with HTTPS enabled."
