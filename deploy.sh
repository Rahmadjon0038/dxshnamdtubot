#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "XATOLIK: .env fayli topilmadi. Avval .env faylini shu papkaga joylashtiring."
  exit 1
fi

mkdir -p data

if command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  COMPOSE="docker compose"
fi

echo "==> Docker image qurilmoqda..."
$COMPOSE build

echo "==> Eski konteyner (agar bo'lsa) to'xtatilmoqda..."
$COMPOSE down 2>/dev/null || true

echo "==> Bot ishga tushirilmoqda..."
$COMPOSE up -d

echo "==> Holat:"
$COMPOSE ps

echo ""
echo "Loglarni ko'rish uchun: docker logs -f dxshnamdtu-bot"
