# Development image. Build from the repository root: the API uses the shared workspace package.
FROM node:24.22.1-alpine

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace @clozera/backend --include-workspace-root

COPY tooling ./tooling
COPY packages/shared ./packages/shared
COPY backend ./backend

WORKDIR /app/backend
EXPOSE 3000

CMD ["node", "--watch", "src/server.ts"]
