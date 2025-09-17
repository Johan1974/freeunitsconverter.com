FROM node:20-alpine

WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy only the contents of seo_audit folder (script, helpers)
COPY . .

# Run Node script
CMD ["node", "run_audit.js"]
