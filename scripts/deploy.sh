#!/usr/bin/env bash
# ==============================================================================
# SmartBiz Accounting - Automated Production Deployment Script
# Execute from: /opt/smartbiz-accounting
# Usage: ./scripts/deploy.sh
# ==============================================================================

set -euo pipefail

APP_DIR="/opt/smartbiz-accounting"
COMPOSE_FILE="docker-compose.prod.yml"
CONTAINER_NAME="smartbiz-app"
HEALTH_URL="http://127.0.0.1:3001/api/health"

echo "================================================================="
echo " Starting SmartBiz Accounting Production Deployment"
echo " Date: $(date)"
echo " Directory: ${APP_DIR}"
echo "================================================================="

cd "${APP_DIR}"

# 1. Verify .env.production exists
if [ ! -f ".env.production" ]; then
    echo "❌ ERROR: .env.production file not found in ${APP_DIR}!"
    echo "Please copy .env.production.example to .env.production and configure your credentials."
    exit 1
fi

# 2. Pull latest code from main branch
echo "📥 Pulling latest repository updates from GitHub..."
git fetch origin main
git reset --hard origin/main

# 3. Build and launch updated Docker container
echo "🐳 Building and starting Docker container (${CONTAINER_NAME})..."
docker compose -f "${COMPOSE_FILE}" build
docker compose -f "${COMPOSE_FILE}" up -d --remove-orphans

# 4. Wait for container to become healthy
echo "⏳ Waiting for application to initialize..."
MAX_RETRIES=20
RETRY_COUNT=0
HEALTHY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "   [Attempt ${RETRY_COUNT}/${MAX_RETRIES}] Checking ${HEALTH_URL}..."
    
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${HEALTH_URL}" || true)
    
    if [ "${HTTP_CODE}" = "200" ]; then
        HEALTHY=true
        break
    fi
    sleep 3
done

if [ "$HEALTHY" = false ]; then
    echo "❌ ERROR: Healthcheck failed! Container did not respond with HTTP 200 within timeout."
    echo "Dumping recent container logs:"
    docker compose -f "${COMPOSE_FILE}" logs --tail 50
    exit 1
fi

echo "✅ Healthcheck passed! Service is responding on http://127.0.0.1:3001"

# 5. Execute Prisma Database Schema Push
echo "🗄️ Synchronizing Prisma schema with PostgreSQL database..."
docker run --rm --network contract-genie_app_network -v "${APP_DIR}":/app -w /app --env-file "${APP_DIR}/.env.production" node:20-alpine sh -c "npx prisma db push --skip-generate" || {
    echo "⚠️ Warning: Prisma db push encountered an issue. Check DATABASE_URL in .env.production."
}

# 6. Check database tables and optionally seed if empty
echo "🌱 Checking if initial seed data is required..."
docker run --rm --network contract-genie_app_network -v "${APP_DIR}":/app -w /app --env-file "${APP_DIR}/.env.production" node:20-alpine sh -c "node scripts/seed.mjs" || {
    echo "ℹ️ Seeding skipped or already populated."
}

echo "================================================================="
echo "🎉 DEPLOYMENT SUCCESSFUL!"
echo " Container: ${CONTAINER_NAME} is running on 127.0.0.1:3001"
echo " Public URL: https://myaccounts360.com"
echo "================================================================="
docker compose -f "${COMPOSE_FILE}" ps
