const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const rateLimit = require("express-rate-limit")
require("dotenv").config()

// Add this near the top of the imports
const browserManager = require("./utils/browserManager")

// Import routes
const authRoutes = require("./routes/auth")
const aiRoutes = require("./routes/ai")

const app = express()

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
})

// Middleware
app.use(limiter)
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  }),
)
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true }))

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err))

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/ai", aiRoutes)

// Health check
app.get("/api/health", (req, res) => {
  res.json({ message: "Synapse API is running!", timestamp: new Date().toISOString() })
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({
    message: "Something went wrong!",
    error: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
  })
})

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ message: "Route not found" })
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`Synapse server running on port ${PORT}`)
})

// Add this at the end of the file, before the app.listen call
// Graceful shutdown handling
process.on("SIGINT", async () => {
  console.log("Received SIGINT. Shutting down gracefully...")
  await browserManager.closeBrowser()
  mongoose.connection.close(() => {
    console.log("MongoDB connection closed.")
    process.exit(0)
  })
})

process.on("SIGTERM", async () => {
  console.log("Received SIGTERM. Shutting down gracefully...")
  await browserManager.closeBrowser()
  mongoose.connection.close(() => {
    console.log("MongoDB connection closed.")
    process.exit(0)
  })
})
