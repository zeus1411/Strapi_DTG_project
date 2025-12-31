# Dockerfile for Strapi Backend
FROM node:20-alpine

# Install dependencies only when needed
RUN apk update && apk add --no-cache build-base gcc autoconf automake zlib-dev libpng-dev vips-dev git

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Set environment (can be overridden via docker-compose build args)
ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}

# Install dependencies
RUN npm ci

# Copy project files
COPY . .

# Build Strapi admin panel
RUN npm run build

# Expose port
EXPOSE 1337

# Start Strapi
CMD ["npm", "run", "develop"]
