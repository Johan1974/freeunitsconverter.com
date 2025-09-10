#!/bin/bash
set -e
set -x   # Debug: prints every command as it runs

# ---------------------------
# 0️⃣ Generate static SEO pages & sitemap
# ---------------------------
echo "🔄 Generating static pages & sitemap..."
docker run --rm -v $(pwd)/frontend:/app -w /app node:18 node generate-pages.js
echo "✅ Static pages and sitemap generated."

# ---------------------------
# 1️⃣ Remove all old dev images first (keep only latest freeunitsconverter_dev-*)
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
echo "Stopping old development containers...!!"
docker compose -p freeunitsconverter_dev -f docker-compose.dev.yml down || true

# ---------------------------
# 3️⃣ Remove any exited frontend/backend containers
# ---------------------------
echo "Removing any exited dev containers..."
docker ps -a --filter "status=exited" --filter "name=freeunitsconverter_dev" -q | xargs -r docker rm || true

# ---------------------------
# 4️⃣ Free ports used by frontend/backend (optional, commented out)
# ---------------------------
# for PORT in 8080 8000; do
#     PIDS=$(lsof -t -i:$PORT)
#     if [ -n "$PIDS" ]; then
#         echo "Port $PORT is in use by PID(s) $PIDS. Killing..."
#         kill -9 $PIDS
#     fi
# done

# ---------------------------
# 5️⃣ Build and start dev containers
# ---------------------------
echo "Building frontend and backend images..."
docker compose -p freeunitsconverter_dev -f docker-compose.dev.yml build --no-cache frontend backend

echo "Starting development containers with live frontend volume..."
docker compose -p freeunitsconverter_dev -f docker-compose.dev.yml up -d frontend backend

# ---------------------------
# 6️⃣ Prune dangling images to free space
# ---------------------------
echo "Pruning dangling images..."
docker image prune -f

echo "✅ Development environment is up. Changes in ./frontend are reflected immediately."
echo "Frontend dev: http://localhost:8080 | Backend dev: http://localhost:8000"
