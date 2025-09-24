#!/bin/bash
set -e
set -x

# ---------------------------
# Load environment variables from .env
# ---------------------------
set -o allexport
source .env
set +o allexport

echo "🔄 Generating static pages & sitemap for dev..."

cd frontend

# ---------------------------
# Generate pages & sitemap for DEV
# ---------------------------
node generate-pages.js dev
node generate-sitemap.js

cd ..

# ---------------------------
# Stop old dev containers
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
# Make frontend folder writable
# ---------------------------
echo "🔧 Ensuring frontend folder is writable..."
sudo chown -R $USER:$USER ./frontend

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
