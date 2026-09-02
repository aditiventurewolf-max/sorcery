FROM node:20-slim

# System Chromium instead of letting puppeteer download its own — smaller
# image, and matches what's already tested on Debian slim.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package.json package-lock.json* ./
COPY patches ./patches
RUN npm install --omit=dev

COPY src ./src

ENV PORT=8788
ENV WHATSAPP_SESSION_PATH=/data/session
EXPOSE 8788

CMD ["node", "src/index.js"]
