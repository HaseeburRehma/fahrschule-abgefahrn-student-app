# syntax=docker/dockerfile:1.7
# ----------------------------------------------------------------------------
# Self-hostable web build of the app (production runs on Vercel; this image is
# the portable alternative and is built in CI so the build stays reproducible).
#
#   docker build -t fahrschule-web \
#     --build-arg EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
#     --build-arg EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable key> .
#   docker run -p 8080:8080 fahrschule-web      → http://localhost:8080
#
# Stage 1 builds the static export; stage 2 is a small unprivileged nginx that
# serves it with the same security headers as vercel.json. Only public
# (EXPO_PUBLIC_*) values go into the bundle — never service keys.
# ----------------------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG EXPO_PUBLIC_SUPABASE_URL
ARG EXPO_PUBLIC_SUPABASE_ANON_KEY
ENV EXPO_PUBLIC_SUPABASE_URL=$EXPO_PUBLIC_SUPABASE_URL \
    EXPO_PUBLIC_SUPABASE_ANON_KEY=$EXPO_PUBLIC_SUPABASE_ANON_KEY \
    EXPO_NO_TELEMETRY=1
RUN npx expo export --platform web --output-dir dist

FROM nginxinc/nginx-unprivileged:1.27-alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/security-headers.inc /etc/nginx/security-headers.inc
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
# nginx finishes in-flight requests on SIGQUIT (graceful shutdown).
STOPSIGNAL SIGQUIT
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
