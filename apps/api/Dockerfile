FROM node:22-alpine AS base

WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm ci

FROM node:22-alpine AS build

WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/package-lock.json ./package-lock.json
COPY . .

WORKDIR /app/apps/api

RUN /app/node_modules/.bin/prisma generate --schema prisma/schema.prisma
RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app/apps/api

ENV NODE_ENV=production
ENV PORT=3001

RUN apk add --no-cache libc6-compat openssl

COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/api/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/package.json ./package.json
COPY --from=build /app/apps/api/prisma ./prisma

EXPOSE 3001

CMD ["sh", "-c", "/app/node_modules/.bin/prisma migrate deploy --schema ./prisma/schema.prisma && node dist/src/main.js"]
