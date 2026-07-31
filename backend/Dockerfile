FROM node:20.20.0-alpine3.22@sha256:9a6da5b3b736cc5ccc3bc11312cb83d0dae84705f00da92ae420d76a15a9da6f AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.29.2 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM node:20.20.0-alpine3.22@sha256:9a6da5b3b736cc5ccc3bc11312cb83d0dae84705f00da92ae420d76a15a9da6f AS production
ENV NODE_ENV=production \
    PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.29.2 --activate
WORKDIR /app
RUN apk add --no-cache postgresql-client \
    && chown node:node /app
USER node
COPY --chown=node:node package.json pnpm-lock.yaml ./
COPY --chown=node:node patches ./patches
RUN pnpm install --prod --frozen-lockfile
COPY --chown=node:node --from=base /app/dist ./dist
COPY --chown=node:node --from=base /app/security ./security
EXPOSE 3000
CMD ["pnpm", "run", "railway:start:prod"]
