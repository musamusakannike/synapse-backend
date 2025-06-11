FROM ghcr.io/puppeteer/puppeteer:20.9.0

# Set Puppeteer environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# ✅ Install TLS and DNS dependencies required for MongoDB Atlas
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    dirmngr \
    netbase \
    dnsutils \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /usr/src/app

# Install Node.js dependencies
COPY package*.json ./
RUN npm ci

# Copy application code
COPY . .

# Start the application
CMD ["node", "server.js"]
