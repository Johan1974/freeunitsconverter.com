#!/bin/bash
set -e
set -x   # Debug: prints every command as it runs

# ---------------------------
# 0️⃣ Generate static SEO pages & sitemap using Node container
# ---------------------------
echo "🔄 Generating static pages & sitemap..."

docker run --rm \
  -v $(pwd)/frontend:/app \
  -w /app \
  -u $(id -u):$(id -g) \
  node:18 \
  sh -c "npm install dotenv && node generate-pages.js && node generate-sitemap.js"

echo "✅ Static pages and sitemap generated."

# ---------------------------
# 1️⃣ Remove old dev images (keep only latest freeunitsconverter_dev-* tags)
# ---------------------------
echo "Removing old dev images (except latest freeunitsconverter_dev-* tags)..."
docker images --format '{{.Repository}}:{{.Tag}} {{.ID}}' \
    | grep 'freeunitsconverter' \
    | grep -v 'freeunitsconverter_dev-' \
    | awk '{print $2}' \
    | xargs -r docker rmi -f || true

# ---------------------------
# 2️⃣ Stop old development containers
# ---------------------------
echo "Stopping old development containers..."
docker compose -p freeunitsconverter_dev -f docker-compose.dev.yml down || true

# ---------------------------
# 3️⃣ Remove exited frontend/backend containers
# ---------------------------
echo "Removing any exited dev containers..."
docker ps -a --filter "status=exited" --filter "name=freeunitsconverter_dev" -q | xargs -r docker rm || true

# ---------------------------
# 4️⃣ Build and start dev containers
# ---------------------------
echo "Building frontend and backend images..."
docker compose -p freeunitsconverter_dev -f docker-compose.dev.yml build --no-cache frontend backend seo_audit

echo "Starting development containers..."
docker compose -p freeunitsconverter_dev -f docker-compose.dev.yml up -d frontend backend seo_audit

# ---------------------------
# 5️⃣ Prune dangling images to free space
# ---------------------------
echo "Pruning dangling images..."
docker image prune -f

echo "✅ Development environment is up."
echo "Frontend dev: http://localhost:8080 | Backend dev: http://localhost:8000"
