# ─────────────────────────────────────────────────────────────────────────────
# foodgo-backend — Production Dockerfile
#
# Multi-stage build:
#   deps    — install all dependencies (production + dev) from the lockfile
#   builder — generate Prisma Client and compile TypeScript
#   runner  — minimal runtime image; no build toolchain, no dev dependencies
#
# Usage:
#   Build:   docker build -t foodgo-backend .
#   Run:     docker run --env-file .env.staging -p 3000:3000 foodgo-backend
#
# Migrations are NOT run at application startup.
# Run them separately before deploying a new version:
#   docker run --rm --env-file .env.staging foodgo-backend \
#     sh -c "npm run prisma:deploy"
#
# Base image choice: node:22-alpine
#   • Node 22 LTS satisfies NestJS >=20 and Prisma >=18.18
#   • Alpine uses musl libc; binaryTargets in schema.prisma includes
#     "linux-musl-openssl-3.0.x" so prisma generate downloads the correct
#     Rust query engine binary during the builder stage
#   • bcrypt v6 ships prebuilt musl binaries (no native compilation required)
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: dependency installation ─────────────────────────────────────────
FROM node:22-alpine AS deps

# openssl is needed by prisma generate (classic engine) to download/verify binaries
# python3 + make + g++ are needed by node-gyp for packages with native bindings (bcrypt)
RUN apk add --no-cache openssl python3 make g++

WORKDIR /build

# Copy only the manifest files first — this layer is cached until they change
COPY package.json package-lock.json ./

# ci: reproducible install from lockfile; fails on lockfile mismatch
RUN npm ci

# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM deps AS builder

WORKDIR /build

# Copy source required for the build
COPY prisma ./prisma
COPY src ./src
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY prisma.config.ts ./

# Generate Prisma Client for the current platform (linux) AND linux-musl
# binaryTargets in schema.prisma ensures the linux-musl engine binary is also fetched
RUN npx prisma generate

# Compile TypeScript -> dist/
# Uses tsc directly with tsconfig.build.json to bypass Nest CLI ora/schematics circular dependency issue
RUN npx tsc -p tsconfig.build.json

# Copy generated Prisma engine binaries into dist/generated/prisma/ because tsc only compiles .ts files and does not copy .node binaries
RUN mkdir -p dist/generated/prisma && cp src/generated/prisma/*.node dist/generated/prisma/

# ── Stage 3: runtime image ────────────────────────────────────────────────────
FROM node:22-alpine AS runner

# Runtime dependencies for the Prisma classic (Rust) query engine on Alpine
# libssl3 / libcrypto3 are the Alpine 3.18+ equivalents of openssl 3.0.x
RUN apk add --no-cache openssl

WORKDIR /app

# Create a dedicated non-root user to run the application
RUN addgroup --system --gid 1001 nestjs \
 && adduser  --system --uid 1001 --ingroup nestjs nestjs

# Copy node_modules from the deps stage (retains prisma CLI for prisma:deploy migration command)
COPY --from=deps --chown=nestjs:nestjs /build/node_modules ./node_modules

# Copy the compiled application output (now includes libquery_engine-*.node in dist/generated/prisma)
COPY --from=builder --chown=nestjs:nestjs /build/dist ./dist

# Copy generated prisma files into src/generated/prisma as well for runtime fallback paths
COPY --from=builder --chown=nestjs:nestjs /build/src/generated ./src/generated

# Copy prisma schema and migrations — required by prisma migrate deploy (release step)
COPY --from=builder --chown=nestjs:nestjs /build/prisma ./prisma

# Copy prisma config file for Prisma CLI migration commands
COPY --from=builder --chown=nestjs:nestjs /build/prisma.config.ts ./prisma.config.ts

# Copy package.json for npm scripts (prisma:deploy, start:prod)
COPY --chown=nestjs:nestjs package.json ./

# Do NOT copy .env files — all configuration is injected via environment variables

USER nestjs

EXPOSE 3000

# Start the compiled NestJS application
# Migrations are NOT run here — run them as a separate step before deployment:
#   docker run --rm --env-file .env.staging foodgo-backend sh -c "npm run prisma:deploy"
CMD ["node", "dist/main"]
