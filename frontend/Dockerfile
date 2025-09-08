# Use the official Nginx lightweight image
FROM nginx:alpine

# Set working directory inside the container
WORKDIR /usr/share/nginx/html

# Remove default Nginx web files
RUN rm -rf ./*

# Copy frontend files into the container
COPY index.html .
COPY style.css .
COPY app.js .

# Optional: add a custom nginx config for caching/headers
# (You can mount or copy this if needed)
# COPY nginx-frontend.conf /etc/nginx/conf.d/default.conf

# Expose HTTP
EXPOSE 80

# Start Nginx (default CMD from nginx:alpine is fine)
