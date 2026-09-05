FROM node:20-bookworm-slim

# better-sqlite3 uchun zaxira build vositalari (prebuilt binary topilmasa kerak bo'ladi)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .

VOLUME ["/app/data"]

CMD ["node", "src/index.js"]
