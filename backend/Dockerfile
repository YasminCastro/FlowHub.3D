FROM node:24-bookworm-slim AS build
WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .
# O generate não conecta no banco, mas o prisma.config.ts lê DATABASE_URL.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build yarn prisma generate \
 && yarn build


FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production

# O schema engine do prisma (usado no migrate deploy) depende do OpenSSL.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

# node_modules completo: o CLI do prisma (devDependency) roda as migrations no start.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/prisma.config.ts /app/package.json ./

# Criada com dono "node" para o volume nomeado herdar a permissão.
RUN mkdir -p /app/uploads && chown node:node /app/uploads
ENV UPLOADS_DIR=/app/uploads

USER node
EXPOSE 3001
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/src/main.js"]
