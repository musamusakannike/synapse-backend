FROM ghcr.io/puppeteer/puppeteer:20.9.0

# Set Puppeteer environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# 👤 Switch to root to install packages
USER root

# 🛠 Add missing Google public key to fix apt update
RUN curl -fsSL https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google.gpg \
  && echo "deb [signed-by=/usr/share/keyrings/google.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list

# ✅ Install TLS and DNS dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    dirmngr \
    netbase \
    dnsutils \
    && rm -rf /var/lib/apt/lists/*

# 🔒 Return to non-root Puppeteer user
USER pptruser

# Set working directory
WORKDIR /usr/src/app

# Install Node.js dependencies
COPY package*.json ./
RUN npm ci

# Copy application code
COPY . .

# Start the application
CMD ["node", "server.js"]
