#!/bin/bash
set -e
set -x

# ---------------------------
# Load environment variables from .env
# ---------------------------
set +H   # disables history expansion
set -o allexport
source .env
set +o allexport

# ---------------------------
# Files to ensure use DEV URL
# ---------------------------
FILES_TO_SWAP=(
  "./frontend/index.html"
  "./frontend/app.js"
  # Add more files here if needed
)

# ---------------------------
# Make frontend folder writable
# ---------------------------
echo "🔧 Ensuring frontend folder is writable..."
sudo chown -R $USER:$USER ./frontend

# ---------------------------
# Replace any PRD URLs with DEV URLs
# ---------------------------
echo "🔄 Ensuring all files use DEV URLs..."
for f in "${FILES_TO_SWAP[@]}"; do
    sed -i "s|$SITE_URL_PRD|$SITE_URL_DEV|g" "$f"
done

# ---------------------------
# Generate static pages & sitemap for DEV
# ---------------------------
echo "🔄 Generating static pages & sitemap for DEV..."
cd frontend
node generate-pages.js dev
node generate-sitemap.js
cd ..
echo "✅ Static pages and sitemap generated."

# ---------------------------
# Stop old development containers
# ---------------------------
echo "Stopping old development containers..."
docker ps -a --filter "name=freeunitsconverter_dev" -q | xargs -r docker stop || true
docker ps -a --filter "name=freeunitsconverter_dev" -q | xargs -r docker rm || true

# ---------------------------
# Remove old dev images
# ---------------------------
echo "Removing old dev images..."
docker images --format '{{.Repository}}:{{.Tag}} {{.ID}}' \
    | grep 'freeunitsconverter_dev' \
    | awk '{print $2}' \
    | xargs -r docker rmi -f || true

# ---------------------------
# Build frontend and backend images
# ---------------------------
echo "Building frontend and backend images..."
docker compose -p freeunitsconverter_dev -f docker-compose.dev.yml build --no-cache frontend backend seo_audit

# ---------------------------
# Start development containers
# ---------------------------
echo "Starting development containers..."
docker compose -p freeunitsconverter_dev -f docker-compose.dev.yml up -d frontend backend seo_audit

# ---------------------------
# Prune dangling images
# ---------------------------
echo "Pruning dangling images..."
docker image prune -f

echo "✅ Development environment is up."
echo "Frontend dev: http://localhost:8080 | Backend dev: http://localhost:8000"
