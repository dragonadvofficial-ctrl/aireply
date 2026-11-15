# One image, two roles:  web → node .next/standalone/server.js   worker → npm run worker
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && cp -r .next/static .next/standalone/.next/static && cp -r public .next/standalone/public

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app ./
EXPOSE 3000
CMD ["node", ".next/standalone/server.js"]
