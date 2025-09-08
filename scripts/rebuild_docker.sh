#!/bin/bash
set -e

# Clear the terminal
clear

echo "Stopping system Nginx to free ports 80/443..."
sudo systemctl stop nginx || true
sudo systemctl disable nginx || true

echo "Stopping and removing all old Docker containers..."
# Stop and remove all containers matching project name
docker ps -a --filter "name=freeunitsconverter" -q | xargs -r docker stop
docker ps -a --filter "name=freeunitsconverter" -q | xargs -r docker rm

echo "Cleaning up unused Docker networks and images..."
docker network prune -f
docker image prune -af

# Ensure certbot challenge folder exists with correct permissions
CERTBOT_WWW="./certbot/www"
mkdir -p "$CERTBOT_WWW/.well-known/acme-challenge"
chown -R $USER:$USER "$CERTBOT_WWW"

# Remove old Compose network if it exists (to fix label conflict)
if docker network ls | grep -q freeunitsconvertercom_default; then
    echo "Removing old Docker Compose network to avoid label conflicts..."
    docker network rm freeunitsconvertercom_default
fi

CERT_PATH="./certbot/conf/live/freeunitsconverter.com/fullchain.pem"

if [ ! -f "$CERT_PATH" ]; then
    echo "Certificates not found. Running temporary HTTP container for Certbot..."
    
    # Start temporary HTTP container
    docker compose up -d --remove-orphans nginx_http

    echo "Issuing/Renewing certificates..."
    docker compose run --rm certbot certonly \
        --webroot -w /var/www/certbot \
        -d freeunitsconverter.com -d www.freeunitsconverter.com \
        --email johanlijffijt@gmail.com \
        --agree-tos --non-interactive

    echo "Stopping temporary HTTP container..."
    docker compose stop nginx_http
    docker compose rm -f nginx_http
fi

echo "Building and starting main Docker containers..."
docker compose up -d --build frontend backend nginx

echo "All containers are up. HTTPS should be working."
