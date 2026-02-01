# Frontend Dockerfile

FROM node:18-alpine

WORKDIR /app

# Copy and install dependencies first (cached layer)
COPY package*.json ./
RUN npm install

# Copy Tailwind and PostCSS config files
COPY tailwind.config.js postcss.config.js ./

# Copy entire application source
COPY . .

EXPOSE 3000

# Start React development server (auto-reloads on code changes)
CMD ["npm", "start"]
