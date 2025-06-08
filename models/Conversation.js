const mongoose = require("mongoose")

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ["user", "model"],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
})

const conversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    websiteUrl: {
      type: String,
      required: true,
    },
    websiteTitle: {
      type: String,
      default: "",
    },
    initialSummary: {
      type: String,
      required: true,
    },
    messages: [messageSchema],
    scrapedContent: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
)

// Index for better query performance
conversationSchema.index({ userId: 1, createdAt: -1 })

module.exports = mongoose.model("Conversation", conversationSchema)
