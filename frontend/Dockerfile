# Frontend Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files first (better caching - this layer won't rebuild if source code changes)
COPY package*.json ./

# Install dependencies (npm ci requires package-lock.json, so using npm install for dev)
RUN npm install && \
    npm cache clean --force

# Copy configuration files
COPY tailwind.config.js postcss.config.js ./

# Copy application source code
COPY src ./src
COPY public ./public

EXPOSE 3000

# Start React development server with optimized settings
CMD ["npm", "start"]
