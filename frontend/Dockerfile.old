# Base Nginx image
FROM nginx:alpine

# Set working directory
WORKDIR /usr/share/nginx/html

# Remove default files
RUN rm -rf ./*

# Copy static frontend files
COPY . .

# Copy custom Nginx config for SPA fallback
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Internal port only
EXPOSE 80

# Use default Nginx command
CMD ["nginx", "-g", "daemon off;"]
