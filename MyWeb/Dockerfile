# MyWeb frontend — Vite-built React app, served by nginx on port 5173.
# Build context: this directory. Built by root docker-compose.yml.

FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts index.html ./
COPY src ./src
COPY public ./public

# Build-time env vars baked into the SPA bundle. Must be ARG'd here or Docker
# silently drops the --build-arg. Empty defaults → relative URLs / no auth header.
ARG VITE_API_BASE_URL=""
ARG VITE_API_KEY=""
ARG VITE_DEVTEAM_API_URL=""
ARG VITE_DEVTEAM_API_KEY=""
ARG VITE_DEV_MODE=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_API_KEY=$VITE_API_KEY \
    VITE_DEVTEAM_API_URL=$VITE_DEVTEAM_API_URL \
    VITE_DEVTEAM_API_KEY=$VITE_DEVTEAM_API_KEY \
    VITE_DEV_MODE=$VITE_DEV_MODE

RUN npm run build

FROM nginx:alpine AS runtime

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 5173

CMD ["nginx", "-g", "daemon off;"]
