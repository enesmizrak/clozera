# Development image. Build from the repository root: the web app uses the shared workspace package.
FROM node:24.22.1-alpine

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/emails/package.json packages/emails/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace @clozera/frontend --include-workspace-root

COPY tooling ./tooling
COPY packages/shared ./packages/shared
COPY frontend ./frontend

WORKDIR /app/frontend
EXPOSE 5173

CMD ["npx", "vp", "dev", "--host", "0.0.0.0", "--port", "5173"]
