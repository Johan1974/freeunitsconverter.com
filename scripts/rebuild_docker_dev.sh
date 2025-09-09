#!/bin/bash
set -e

clear
echo "Stopping old development containers..."
docker compose -p freeunitsconverter_dev -f docker-compose.dev.yml down

# Clean up any exited frontend/backend containers to avoid port conflicts
echo "Removing any exited dev containers..."
docker ps -a --filter "status=exited" --filter "name=freeunitsconverter_dev" -q | xargs -r docker rm

# Start dev containers with live frontend volume
echo "Starting development containers with live frontend volume..."
docker compose -p freeunitsconverter_dev -f docker-compose.dev.yml up -d --build frontend backend

echo "✅ Development environment is up. Changes in ./frontend are reflected immediately."
echo "Frontend dev: http://localhost:8080 | Backend dev: http://localhost:8000"
