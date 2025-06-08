const puppeteer = require("puppeteer")
const browserManager = require("./browserManager")

/**
 * Scrape a website using Puppeteer (handles JavaScript rendering)
 * @param {string} url - The URL to scrape
 * @param {Object} options - Scraping options
 * @returns {Promise<Object>} - The scraped content
 */
const scrapeWithPuppeteer = async (url, options = {}) => {
  const { timeout = 30000, waitForSelector = "body", scrollToBottom = true, waitTime = 2000 } = options

  let browser = null
  let page = null

  try {
    // Add protocol if missing
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url
    }

    // Get browser instance from manager
    browser = await browserManager.getBrowser()

    // Create a new page
    page = await browser.newPage()

    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 })
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    )

    // Set timeout
    await page.setDefaultNavigationTimeout(timeout)

    // Navigate to the URL
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout,
    })

    // Wait for content to load
    await page.waitForSelector(waitForSelector, { timeout })

    // Scroll to bottom if needed (for lazy-loaded content)
    if (scrollToBottom) {
      await autoScroll(page)
      // Wait a bit for any lazy-loaded content
      await page.waitForTimeout(waitTime)
    }

    // Get page title
    const title = await page.title()

    // Extract text content
    const content = await page.evaluate(() => {
      // Remove unwanted elements
      const elementsToRemove = document.querySelectorAll(
        "script, style, nav, header, footer, aside, .advertisement, .ads, .social-media, iframe",
      )
      elementsToRemove.forEach((el) => el.remove())

      // Try to find main content areas
      const contentSelectors = [
        "main",
        "article",
        ".content",
        ".main-content",
        "#content",
        "#main",
        ".post-content",
        ".entry-content",
      ]

      let mainContent = ""
      for (const selector of contentSelectors) {
        const element = document.querySelector(selector)
        if (element) {
          mainContent = element.innerText
          break
        }
      }

      // Fallback to body if no specific content area found
      if (!mainContent) {
        mainContent = document.body.innerText
      }

      // Clean up the text
      return mainContent.replace(/\s+/g, " ").replace(/\n+/g, "\n").trim()
    })

    // Close the page (but keep browser running for future requests)
    await page.close()

    // Limit content length to avoid token limits
    const trimmedContent = content.length > 50000 ? content.substring(0, 50000) + "..." : content

    if (!trimmedContent || trimmedContent.length < 100) {
      throw new Error("Could not extract meaningful content from the website")
    }

    return {
      title,
      content: trimmedContent,
      url,
    }
  } catch (error) {
    // Close page on error
    if (page) {
      await page.close().catch((e) => console.error("Error closing page:", e))
    }

    throw error
  }
}

/**
 * Auto-scroll to the bottom of the page to load lazy content
 * @param {Page} page - Puppeteer page object
 */
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0
      const distance = 100
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight
        window.scrollBy(0, distance)
        totalHeight += distance

        if (totalHeight >= scrollHeight || totalHeight > 10000) {
          clearInterval(timer)
          resolve()
        }
      }, 100)
    })
  })
}

module.exports = {
  scrapeWithPuppeteer,
}
