ARG BASE=node:20.18.0
FROM ${BASE} AS base

WORKDIR /app

# Install dependencies (this step is cached as long as the dependencies don't change)
COPY package.json pnpm-lock.yaml ./

RUN corepack enable pnpm && pnpm install

# Copy the rest of your app's source code
COPY . .

# Expose the port the app runs on
EXPOSE 5173

# Production image
FROM base AS bolt-ai-production

ARG BUILD_ENV=production
ENV WRANGLER_SEND_METRICS=false \
    NODE_ENV=${BUILD_ENV} \
    RUNNING_IN_DOCKER=true

# Create an entrypoint script to handle SESSION_SECRET
RUN echo '#!/bin/sh\n\
export SESSION_SECRET=${SESSION_SECRET:-$(openssl rand -hex 32)}\n\
exec "$@"' > /entrypoint.sh && \
    chmod +x /entrypoint.sh

# Pre-configure wrangler to disable metrics
RUN mkdir -p /root/.config/.wrangler && \
    echo '{"enabled":false}' > /root/.config/.wrangler/metrics.json

RUN pnpm run build

ENTRYPOINT ["/entrypoint.sh"]
CMD ["pnpm", "run", "dockerstart"]

# Development image
FROM base AS bolt-ai-development

ARG BUILD_ENV=development
ENV WRANGLER_SEND_METRICS=false \
    NODE_ENV=${BUILD_ENV} \
    RUNNING_IN_DOCKER=true

# Create an entrypoint script to handle SESSION_SECRET
RUN echo '#!/bin/sh\n\
export SESSION_SECRET=${SESSION_SECRET:-$(openssl rand -hex 32)}\n\
exec "$@"' > /entrypoint.sh && \
    chmod +x /entrypoint.sh

RUN mkdir -p ${WORKDIR}/run

ENTRYPOINT ["/entrypoint.sh"]
CMD ["pnpm", "run", "dev", "--host"]
