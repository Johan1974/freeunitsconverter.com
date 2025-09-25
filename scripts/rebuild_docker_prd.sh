#!/bin/bash
set -e
set -x

# ---------------------------
# Load environment variables from .env
# ---------------------------
set +H
set -o allexport
source .env
set +o allexport

# ---------------------------
# Determine project root dynamically
# ---------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/.."

# ---------------------------
# Ensure minifiers are installed
# ---------------------------
echo "🔧 Checking for JS/CSS minifiers..."
command -v uglifyjs >/dev/null 2>&1 || {
    echo "uglify-js not found. Installing..."
    npm install -g uglify-js
}
command -v csso >/dev/null 2>&1 || {
    echo "csso-cli not found. Installing..."
    npm install -g csso-cli
}

# ---------------------------
# Files to swap URLs in
# ---------------------------
FILES_TO_SWAP=(
  "$PROJECT_ROOT/frontend/index.html"
  "$PROJECT_ROOT/frontend/app.js"
  # Add more files here if needed
)

# ---------------------------
# Stop old production containers
# ---------------------------
echo "Stopping old production containers..."
docker compose -p freeunitsconverter_prd -f docker-compose.prd.yml down

# ---------------------------
# Ensure Certbot challenge folder exists
# ---------------------------
CERTBOT_WWW="$PROJECT_ROOT/certbot/www"
mkdir -p "$CERTBOT_WWW/.well-known/acme-challenge"

CERT_PATH="$PROJECT_ROOT/certbot/conf/live/freeunitsconverter.com/fullchain.pem"
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
# Swap URLs to PRD before building
# ---------------------------
echo "🔄 Replacing dev URL with PRD URL in files..."
for f in "${FILES_TO_SWAP[@]}"; do
    sed -i "s|$SITE_URL_DEV|$SITE_URL_PRD|g" "$f"
done

# ---------------------------
# Make frontend folder writable
# ---------------------------
echo "🔧 Ensuring frontend folder is writable..."
sudo chown -R $USER:$USER "$PROJECT_ROOT/frontend"

# ---------------------------
# Generate static pages & sitemap for production
# ---------------------------
echo "🔄 Generating static converter pages & sitemap..."
cd "$PROJECT_ROOT/frontend"
node generate-pages.js prd
node generate-sitemap.js
cd "$PROJECT_ROOT"
echo "✅ Static pages and sitemap generated."

# ---------------------------
# Minify JS and CSS
# ---------------------------
echo "🔧 Minifying JS and CSS for production..."
uglifyjs "$PROJECT_ROOT/frontend/app.js" -o "$PROJECT_ROOT/frontend/app.min.js" -c -m
uglifyjs "$PROJECT_ROOT/frontend/converters.js" -o "$PROJECT_ROOT/frontend/converters.min.js" -c -m
csso "$PROJECT_ROOT/frontend/style.css" -o "$PROJECT_ROOT/frontend/style.min.css"
echo "✅ Minified JS and CSS generated."

# ---------------------------
# Copy static pages into seo_audit folder
# ---------------------------
echo "🔄 Copying static-pages into seo_audit folder..."
rm -rf "$PROJECT_ROOT/seo_audit/static-pages"
cp -r "$PROJECT_ROOT/frontend/static-pages" "$PROJECT_ROOT/seo_audit/"
echo "✅ static-pages copied."

# ---------------------------
# Build and start main production containers
# ---------------------------
echo "Building and starting production containers..."
docker compose -p freeunitsconverter_prd -f docker-compose.prd.yml up -d --build frontend backend nginx
echo "✅ Production environment is up with HTTPS enabled."

# ---------------------------
# Restore URLs back to DEV
# ---------------------------
echo "↩️ Restoring dev URLs in files..."
for f in "${FILES_TO_SWAP[@]}"; do
    sed -i "s|$SITE_URL_PRD|$SITE_URL_DEV|g" "$f"
done

# ---------------------------
# Verify compression
# ---------------------------
echo "🔍 Verifying compression..."
BROTLI_CHECK=$(curl -s -I -H "Accept-Encoding: br" https://freeunitsconverter.com | grep -i "Content-Encoding")
echo "Brotli test headers: $BROTLI_CHECK"

GZIP_CHECK=$(curl -s -I -H "Accept-Encoding: gzip" https://freeunitsconverter.com | grep -i "Content-Encoding")
echo "Gzip test headers: $GZIP_CHECK"
echo "✅ Compression verification complete."

# ---------------------------
# Remove old SEO audit container if exists
# ---------------------------
echo "🔄 Removing old SEO audit container if exists..."
docker compose -p freeunitsconverter_prd -f docker-compose.prd.yml rm -sf seo_audit

# ---------------------------
# Build and start SEO audit container
# ---------------------------
echo "Building and starting SEO audit container..."
docker compose -p freeunitsconverter_prd -f docker-compose.prd.yml up -d --build seo_audit
echo "✅ SEO audit container is up."
