# Das Frontend wird plattformneutral gebaut, deshalb läuft diese Stufe nativ auf dem Build-Rechner.
FROM --platform=$BUILDPLATFORM node:22-alpine AS web
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json vite.config.mts components.json index.html app-detail.html ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM node:22-alpine
WORKDIR /usr/src/app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY public ./public
COPY --from=web /usr/src/app/dist ./dist

EXPOSE 8080
USER node
CMD ["node", "server/index.js"]
