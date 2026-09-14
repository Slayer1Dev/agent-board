FROM node:22-alpine AS builder

# Instalar ferramentas de build para compilar better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:22-alpine

WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Configurações padrão para rodar no Docker
ENV BOARD_DB=/data/board.db
ENV BOARD_PORT=8078
ENV BOARD_HOST=0.0.0.0

EXPOSE 8078

CMD ["npm", "start"]
