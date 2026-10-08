FROM node:22-alpine AS build

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json ./

# Copy scripts
COPY scripts scripts

# Copy assets
COPY assets assets

# Copy all package.json files first
COPY packages/core/package.json packages/core/package.json
COPY packages/crdt/package.json packages/crdt/package.json
COPY packages/client/package.json packages/client/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY apps/web/package.json apps/web/package.json

# Install dependencies
RUN npm ci

# Copy source files
COPY packages/core packages/core
COPY packages/crdt packages/crdt
COPY packages/client packages/client
COPY packages/ui packages/ui
COPY apps/web apps/web
COPY tsconfig.base.json ./

# Build packages
RUN npm run build -w @colanode/core && \
    npm run build -w @colanode/crdt && \
    npm run build -w @colanode/client && \
    npm run build -w @colanode/ui && \
    npm run build -w @colanode/web && \
    npm prune --production


FROM nginx:1.27-alpine

COPY --from=build /app/apps/web/dist /usr/share/nginx/html

RUN cat <<'EOF' > /etc/nginx/conf.d/default.conf
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;
    client_max_body_size 500M;

    resolver 127.0.0.11 valid=30s ipv6=off;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~ ^/(client/|api/|mcp|config) {
        set $backend_server http://server:3000;
        proxy_pass $backend_server;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_buffering off;
    }
}
EOF

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
