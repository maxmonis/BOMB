# Stage 1: Build
FROM node:20 AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Run
FROM node:20
WORKDIR /app

COPY --from=builder /app ./
ENV NODE_ENV=production

EXPOSE 8080
CMD ["node", ".build/api/server.js"]
