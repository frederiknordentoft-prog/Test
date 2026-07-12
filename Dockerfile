# Stage 1: build the frontend bundle
FROM node:20-slim AS frontend
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# Stage 2: backend + static frontend
FROM python:3.11-slim
WORKDIR /app/backend
COPY backend/pyproject.toml ./
COPY backend/simcore ./simcore
COPY backend/api ./api
COPY backend/scripts ./scripts
RUN pip install --no-cache-dir -e .
COPY --from=frontend /fe/dist /app/frontend/dist
RUN mkdir -p /app/data
EXPOSE 8000
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
