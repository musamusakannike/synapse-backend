const axios = require("axios")
const cheerio = require("cheerio")
const { scrapeWithPuppeteer } = require("./puppeteerScraper")

/**
 * Determine if a URL likely requires JavaScript rendering
 * @param {string} url - The URL to check
 * @returns {boolean} - Whether the URL likely requires JavaScript
 */
const likelyRequiresJavaScript = (url) => {
  // Common domains that are JavaScript-heavy
  const jsHeavyDomains = [
    "react",
    "angular",
    "vue",
    "spa",
    "app",
    "dashboard",
    "twitter.com",
    "facebook.com",
    "instagram.com",
    "linkedin.com",
    "gmail.com",
    "docs.google.com",
    "github.com",
    "gitlab.com",
    "youtube.com",
    "netflix.com",
    "amazon.com",
    "airbnb.com",
    "trello.com",
    "notion.so",
    "airtable.com",
    "webflow.com",
    "vercel.com",
    "netlify.com",
    "heroku.com",
    "shopify.com",
    "x.com"
  ]

  // Check if URL contains any of the JS-heavy domains
  return jsHeavyDomains.some((domain) => url.includes(domain))
}

/**
 * Scrape website content using the appropriate method
 * @param {string} url - The URL to scrape
 * @param {Object} options - Scraping options
 * @returns {Promise<Object>} - The scraped content
 */
const scrapeWebsite = async (url, options = {}) => {
  try {
    // Add protocol if missing
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url
    }

    // Determine if we should use Puppeteer based on URL or options
    const forcePuppeteer = options.forcePuppeteer || false
    const useJavaScript = options.useJavaScript || likelyRequiresJavaScript(url)

    // Try Puppeteer first for JavaScript-heavy sites
    if (useJavaScript || forcePuppeteer) {
      try {
        console.log(`Using Puppeteer for ${url}`)
        return await scrapeWithPuppeteer(url, options)
      } catch (puppeteerError) {
        console.error(`Puppeteer scraping failed for ${url}:`, puppeteerError.message)

        // If user explicitly requested Puppeteer, don't fall back
        if (forcePuppeteer) {
          throw puppeteerError
        }

        // Otherwise, fall back to Cheerio
        console.log(`Falling back to Cheerio for ${url}`)
      }
    }

    // Use Cheerio for static HTML scraping
    console.log(`Using Cheerio for ${url}`)
    const response = await axios.get(url, {
      timeout: options.timeout || 10000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    })

    const $ = cheerio.load(response.data)

    // Remove unwanted elements
    $("script, style, nav, header, footer, aside, .advertisement, .ads, .social-media").remove()

    // Extract title
    const title = $("title").text().trim() || $("h1").first().text().trim() || "Untitled"

    // Extract main content
    let content = ""

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

    let foundContent = false
    for (const selector of contentSelectors) {
      const element = $(selector)
      if (element.length > 0) {
        content = element.text()
        foundContent = true
        break
      }
    }

    // Fallback to body if no specific content area found
    if (!foundContent) {
      content = $("body").text()
    }

    // Clean up the text
    content = content.replace(/\s+/g, " ").replace(/\n+/g, "\n").trim()

    // Limit content length to avoid token limits
    if (content.length > 50000) {
      content = content.substring(0, 50000) + "..."
    }

    if (!content || content.length < 100) {
      throw new Error("Could not extract meaningful content from the website")
    }

    return {
      title,
      content,
      url,
    }
  } catch (error) {
    if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
      throw new Error("Website not found or unreachable")
    }
    if (error.response && error.response.status === 404) {
      throw new Error("Website page not found (404)")
    }
    if (error.response && error.response.status >= 400) {
      throw new Error(`Website returned error: ${error.response.status}`)
    }
    throw new Error(error.message || "Failed to scrape website content")
  }
}

module.exports = {
  scrapeWebsite,
}
