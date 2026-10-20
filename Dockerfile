# Node.js 20 lightweight Alpine image
FROM node:20-alpine

WORKDIR /app

# Install dependencies first for optimal Docker layer caching
COPY package*.json ./
RUN npm ci

# Copy source and typescript configs
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript to JavaScript
RUN npm run build

# Expose default HTTP & WebSocket port
EXPOSE 4000

ENV PORT=4000
ENV NODE_ENV=production

# Start production server
CMD ["node", "dist/index.js"]

