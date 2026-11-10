FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY drizzle.config.js ./drizzle.config.js

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "src/server.js"]
