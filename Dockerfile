# UX-Ray — Next.js 14 + Playwright Chromium (Railway)
# Playwright npm package: 1.62.1

FROM mcr.microsoft.com/playwright:v1.62.1-jammy AS deps
WORKDIR /app

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY . .
RUN npm run build

FROM mcr.microsoft.com/playwright:v1.62.1-jammy AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/scripts/start-production.mjs ./scripts/start-production.mjs

USER pwuser

EXPOSE 3000

CMD ["node", "scripts/start-production.mjs"]
