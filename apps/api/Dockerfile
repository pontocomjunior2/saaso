FROM node:22-alpine AS base

WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json ./

RUN npm ci --legacy-peer-deps

FROM node:22-alpine AS build

WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

COPY --from=base /app/node_modules ./node_modules
COPY . .

RUN DATABASE_URL="postgresql://x:x@x:5432/x" node_modules/.bin/prisma generate --schema prisma/schema.prisma
RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

RUN apk add --no-cache libc6-compat openssl

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma

EXPOSE 3001

CMD ["sh", "-c", "node_modules/.bin/prisma migrate resolve --applied 20260416_add_pageid_to_meta_webhook_mapping --schema ./prisma/schema.prisma 2>/dev/null || true && node_modules/.bin/prisma migrate deploy --schema ./prisma/schema.prisma && node dist/src/main.js"]
