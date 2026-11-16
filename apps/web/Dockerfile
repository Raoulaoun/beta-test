# Web app. Build context: repo root.
FROM node:22-alpine AS deps
WORKDIR /app
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
# SITE_ENV decides noindex at build time ("production" = indexable). Railway passes
# service variables to the build when they are declared as ARG.
ARG SITE_ENV
ENV SITE_ENV=$SITE_ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY apps/web/ ./
RUN npm run build

FROM node:22-alpine
WORKDIR /app
# Same SITE_ENV at runtime, where page metadata (robots meta) is rendered.
ARG SITE_ENV
ENV SITE_ENV=$SITE_ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
# server.js reads PORT (set by Railway) and HOSTNAME.
CMD ["node", "server.js"]
