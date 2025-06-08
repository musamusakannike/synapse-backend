const express = require("express")
const { body, validationResult } = require("express-validator")
const rateLimit = require("express-rate-limit")
const { GoogleGenerativeAI } = require("@google/generative-ai")
const auth = require("../middleware/auth")
const { scrapeWebsite } = require("../utils/scraper")
const Conversation = require("../models/Conversation")

const router = express.Router()

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// Rate limiting for AI routes
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // limit each user to 20 AI requests per hour
  message: "Too many AI requests, please try again later.",
})

// Analyze website route
router.post(
  "/analyze",
  auth,
  aiLimiter,
  [
    body("url")
      .notEmpty()
      .withMessage("URL is required")
      .isURL({ require_protocol: false })
      .withMessage("Please provide a valid URL"),
    body("useJavaScript").optional().isBoolean().withMessage("useJavaScript must be a boolean value"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: "Validation failed",
          errors: errors.array(),
        })
      }

      const { url, useJavaScript = false } = req.body

      // Check if user already has a conversation for this URL
      const existingConversation = await Conversation.findOne({
        userId: req.user._id,
        websiteUrl: url,
      })

      if (existingConversation) {
        return res.json({
          message: "Website already analyzed",
          conversationId: existingConversation._id,
          summary: existingConversation.initialSummary,
          websiteTitle: existingConversation.websiteTitle,
          websiteUrl: existingConversation.websiteUrl,
        })
      }

      // Scrape website content with JavaScript option
      const scrapedData = await scrapeWebsite(url, {
        useJavaScript,
        timeout: 30000, // Increase timeout for JS-heavy sites
      })

      // Use Gemini AI to analyze the content
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

      const prompt = `You are Synapse, an AI assistant that analyzes websites and provides comprehensive summaries. Based on the following website content, provide a detailed but concise summary that includes:

1. Main purpose and overview of the website
2. Key features or services offered
3. Target audience
4. Notable information or unique aspects
5. Overall assessment

Website Title: ${scrapedData.title}
Website URL: ${scrapedData.url}

Website Content:
---
${scrapedData.content}
---

Please provide a well-structured summary:`

      const result = await model.generateContent(prompt)
      const response = await result.response
      const summary = response.text()

      // Save conversation to database
      const conversation = new Conversation({
        userId: req.user._id,
        websiteUrl: url,
        websiteTitle: scrapedData.title,
        initialSummary: summary,
        scrapedContent: scrapedData.content,
        messages: [
          {
            role: "user",
            content: `Analyze this website: ${url}`,
          },
          {
            role: "model",
            content: summary,
          },
        ],
      })

      await conversation.save()

      res.json({
        message: "Website analyzed successfully",
        conversationId: conversation._id,
        summary,
        websiteTitle: scrapedData.title,
        websiteUrl: url,
      })
    } catch (error) {
      console.error("Website analysis error:", error)

      if (error.message.includes("Website not found") || error.message.includes("unreachable")) {
        return res.status(400).json({
          message: "Unable to access the website. Please check the URL and try again.",
        })
      }

      if (error.message.includes("Could not extract meaningful content")) {
        return res.status(400).json({
          message: "Unable to extract content from this website. It may be protected or have limited text content.",
        })
      }

      res.status(500).json({
        message: "Failed to analyze website",
        error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
      })
    }
  },
)

// Ask follow-up question route
router.post(
  "/chat/:conversationId",
  auth,
  aiLimiter,
  [
    body("question")
      .notEmpty()
      .withMessage("Question is required")
      .isLength({ min: 3, max: 1000 })
      .withMessage("Question must be between 3 and 1000 characters"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: "Validation failed",
          errors: errors.array(),
        })
      }

      const { conversationId } = req.params
      const { question } = req.body

      // Find the conversation
      const conversation = await Conversation.findOne({
        _id: conversationId,
        userId: req.user._id,
      })

      if (!conversation) {
        return res.status(404).json({
          message: "Conversation not found",
        })
      }

      // Prepare conversation history for Gemini
      const history = [
        {
          role: "user",
          parts: [
            {
              text: `Please analyze this website content and provide a summary:\n\nWebsite: ${conversation.websiteUrl}\nTitle: ${conversation.websiteTitle}\n\nContent:\n${conversation.scrapedContent}`,
            },
          ],
        },
        {
          role: "model",
          parts: [{ text: conversation.initialSummary }],
        },
      ]

      // Add previous messages to history
      conversation.messages.slice(2).forEach((msg) => {
        history.push({
          role: msg.role,
          parts: [{ text: msg.content }],
        })
      })

      // Use Gemini AI to answer the question
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
      const chat = model.startChat({ history })

      const result = await chat.sendMessage(question)
      const response = await result.response
      const answer = response.text()

      // Add the new question and answer to the conversation
      conversation.messages.push(
        {
          role: "user",
          content: question,
        },
        {
          role: "model",
          content: answer,
        },
      )

      await conversation.save()

      res.json({
        message: "Question answered successfully",
        question,
        answer,
        conversationId: conversation._id,
      })
    } catch (error) {
      console.error("Chat error:", error)
      res.status(500).json({
        message: "Failed to process question",
        error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
      })
    }
  },
)

// Get conversation history
router.get("/conversations", auth, async (req, res) => {
  try {
    const conversations = await Conversation.find({ userId: req.user._id })
      .select("websiteUrl websiteTitle initialSummary createdAt")
      .sort({ createdAt: -1 })
      .limit(50)

    res.json({
      conversations,
    })
  } catch (error) {
    console.error("Conversations fetch error:", error)
    res.status(500).json({
      message: "Failed to fetch conversations",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    })
  }
})

// Get specific conversation with full history
router.get("/conversations/:conversationId", auth, async (req, res) => {
  try {
    const { conversationId } = req.params

    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId: req.user._id,
    })

    if (!conversation) {
      return res.status(404).json({
        message: "Conversation not found",
      })
    }

    res.json({
      conversation,
    })
  } catch (error) {
    console.error("Conversation fetch error:", error)
    res.status(500).json({
      message: "Failed to fetch conversation",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    })
  }
})

// Delete conversation
router.delete("/conversations/:conversationId", auth, async (req, res) => {
  try {
    const { conversationId } = req.params

    const conversation = await Conversation.findOneAndDelete({
      _id: conversationId,
      userId: req.user._id,
    })

    if (!conversation) {
      return res.status(404).json({
        message: "Conversation not found",
      })
    }

    res.json({
      message: "Conversation deleted successfully",
    })
  } catch (error) {
    console.error("Conversation deletion error:", error)
    res.status(500).json({
      message: "Failed to delete conversation",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    })
  }
})

module.exports = router
