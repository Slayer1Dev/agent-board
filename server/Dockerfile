FROM node:22-alpine AS builder

# better-sqlite3 compila código nativo.
RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine

WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# O banco fica num volume; o processo roda sem privilégio de root.
RUN mkdir -p /data && chown node:node /data
USER node

ENV BOARD_DB=/data/board.db
ENV BOARD_PORT=8078
# Dentro do contêiner é preciso escutar em todas as interfaces. O servidor só aceita
# isso com BOARD_API_KEY ou BOARD_PERMITIR_ABERTO=1 (veja o docker-compose.yml).
ENV BOARD_HOST=0.0.0.0

EXPOSE 8078
VOLUME /data

CMD ["node", "dist/index.js"]
