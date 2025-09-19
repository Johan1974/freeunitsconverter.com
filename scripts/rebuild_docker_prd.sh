#!/bin/bash
set -e

echo "Stopping old production containers..."
docker compose -p freeunitsconverter_prd -f docker-compose.prd.yml down

# ---------------------------
# Ensure Certbot challenge folder exists
# ---------------------------
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
# 0️⃣ Make frontend folder writable
# ---------------------------
echo "🔧 Ensuring frontend folder is writable..."
sudo chown -R $USER:$USER ./frontend

# ---------------------------
# 1️⃣ Generate static pages & sitemap
# ---------------------------
echo "🔄 Generating static converter pages & sitemap..."
cd frontend
node generate-pages.js
node generate-sitemap.js
cd ..
echo "✅ Static pages and sitemap generated."

# ---------------------------
# 1b️⃣ Copy static pages into seo_audit folder for prod build
# ---------------------------
echo "🔄 Copying static-pages into seo_audit folder..."
rm -rf seo_audit/static-pages
cp -r frontend/static-pages seo_audit/
echo "✅ static-pages copied."

# ---------------------------
# 2️⃣ Build and start main production containers
# ---------------------------
echo "Building and starting production containers..."
docker compose -p freeunitsconverter_prd -f docker-compose.prd.yml up -d --build frontend backend nginx
echo "✅ Production environment is up with HTTPS enabled."

# ---------------------------
# 3️⃣ Verify compression
# ---------------------------
echo "🔍 Verifying compression..."
BROTLI_CHECK=$(curl -s -I -H "Accept-Encoding: br" https://freeunitsconverter.com | grep -i "Content-Encoding")
echo "Brotli test headers: $BROTLI_CHECK"

GZIP_CHECK=$(curl -s -I -H "Accept-Encoding: gzip" https://freeunitsconverter.com | grep -i "Content-Encoding")
echo "Gzip test headers: $GZIP_CHECK"
echo "✅ Compression verification complete."

# ---------------------------
# 4️⃣ Remove old SEO audit container if exists
# ---------------------------
echo "🔄 Removing old SEO audit container if exists..."
docker compose -p freeunitsconverter_prd -f docker-compose.prd.yml rm -sf seo_audit

# ---------------------------
# 5️⃣ Build and start SEO audit container
# ---------------------------
echo "Building and starting SEO audit container..."
docker compose -p freeunitsconverter_prd -f docker-compose.prd.yml up -d --build seo_audit
echo "✅ SEO audit container is up."
