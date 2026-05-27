FROM node:20-slim

# Sin Chromium — Baileys usa WebSocket directo
# Imagen ~10x más liviana que antes

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]