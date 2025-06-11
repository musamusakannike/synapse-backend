# ---- Base image with Chrome + Puppeteer pre-installed ----
FROM ghcr.io/puppeteer/puppeteer:20.9.0

# Runtime settings for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    NODE_ENV=production

# ----------------------------------------------------------
# 1️⃣ Root phase – install only the extra packages we need
#    (DNS tools & CA bundle for MongoDB Atlas TLS)
# ----------------------------------------------------------
USER root

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        netbase \
        dnsutils \
    && rm -rf /var/lib/apt/lists/*

# ----------------------------------------------------------
# 2️⃣ Drop back to the non-root Puppeteer user for security
# ----------------------------------------------------------
USER pptruser

# ----------------------------------------------------------
# 3️⃣ App files & dependencies
# ----------------------------------------------------------
WORKDIR /usr/src/app

# Install production dependencies with npm ci
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the rest of your application
COPY . .

# ----------------------------------------------------------
# 4️⃣ Start the server
# ----------------------------------------------------------
CMD ["node", "server.js"]
