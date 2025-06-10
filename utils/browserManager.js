const puppeteer = require("puppeteer");

/**
 * Browser Manager - Handles Puppeteer browser lifecycle
 */
class BrowserManager {
  constructor() {
    this.browser = null;
    this.isInitializing = false;
    this.initPromise = null;
    this.lastUsed = Date.now();

    // Auto-close browser after inactivity
    this.startIdleTimer();
  }

  /**
   * Get or initialize browser instance
   * @returns {Promise<Browser>} Puppeteer browser instance
   */
  async getBrowser() {
    // If browser exists and is connected, return it
    if (this.browser && this.browser.isConnected()) {
      this.lastUsed = Date.now();
      return this.browser;
    }

    // If initialization is in progress, wait for it
    if (this.isInitializing) {
      return this.initPromise;
    }

    // Initialize new browser
    this.isInitializing = true;
    this.initPromise = this._initBrowser();

    try {
      this.browser = await this.initPromise;
      return this.browser;
    } finally {
      this.isInitializing = false;
      this.lastUsed = Date.now();
    }
  }

  /**
   * Initialize a new browser instance
   * @private
   * @returns {Promise<Browser>} Puppeteer browser instance
   */
  async _initBrowser() {
    try {
      console.log("Initializing new browser instance");
      const browser = await puppeteer.launch({
        headless: "new",
        executablePath: puppeteer.executablePath(),
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--disable-gpu",
          "--window-size=1920x1080",
        ],
      });

      // Handle browser disconnection
      browser.on("disconnected", () => {
        console.log("Browser disconnected");
        this.browser = null;
      });

      return browser;
    } catch (error) {
      console.error("Error initializing browser:", error);
      throw error;
    }
  }

  /**
   * Close the browser instance
   * @returns {Promise<void>}
   */
  async closeBrowser() {
    if (this.browser) {
      try {
        await this.browser.close();
        console.log("Browser closed successfully");
      } catch (error) {
        console.error("Error closing browser:", error);
      } finally {
        this.browser = null;
      }
    }
  }

  /**
   * Start idle timer to close browser after inactivity
   * @private
   */
  startIdleTimer() {
    // Check every 5 minutes
    const IDLE_CHECK_INTERVAL = 5 * 60 * 1000;
    // Close after 15 minutes of inactivity
    const MAX_IDLE_TIME = 15 * 60 * 1000;

    setInterval(async () => {
      if (this.browser && Date.now() - this.lastUsed > MAX_IDLE_TIME) {
        console.log(
          `Browser idle for ${MAX_IDLE_TIME / 60000} minutes, closing`
        );
        await this.closeBrowser();
      }
    }, IDLE_CHECK_INTERVAL);
  }
}

// Create singleton instance
const browserManager = new BrowserManager();

// Handle process termination
process.on("SIGINT", async () => {
  await browserManager.closeBrowser();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await browserManager.closeBrowser();
  process.exit(0);
});

module.exports = browserManager;
