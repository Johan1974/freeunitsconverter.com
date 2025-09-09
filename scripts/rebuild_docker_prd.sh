#!/bin/bash
set -e


echo "Stopping old production containers..."
docker compose -p freeunitsconverter_prd -f docker-compose.prd.yml down

# Ensure Certbot challenge folder exists
CERTBOT_WWW="./certbot/www"
mkdir -p "$CERTBOT_WWW/.well-known/acme-challenge"
# chown -R $USER:$USER "$CERTBOT_WWW"

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

# Generate sitemap before building frontend
echo "Generating sitemap..."
cd frontend
node generate-sitemap.js
cd ..

# Build and start main production containers
echo "Building and starting production containers..."
docker compose -p freeunitsconverter_prd -f docker-compose.prd.yml up -d --build frontend backend nginx

echo "✅ Production environment is up with HTTPS enabled."
