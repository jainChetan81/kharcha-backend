FROM oven/bun:1.2.4-alpine AS base

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

COPY src/ ./src/
COPY drizzle.config.ts ./

RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
