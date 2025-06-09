const express = require("express")
const jwt = require("jsonwebtoken")
const { body, validationResult } = require("express-validator")
const rateLimit = require("express-rate-limit")
const User = require("../models/User")
const { sendVerificationEmail } = require("../utils/email")
const auth = require("../middleware/auth")

const router = express.Router()

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs for auth routes
  message: "Too many authentication attempts, please try again later.",
})

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  })
}

// Register route
router.post(
  "/register",
  authLimiter,
  [
    body("fullName")
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage("Full name must be between 2 and 100 characters"),
    body("email").isEmail().normalizeEmail().withMessage("Please provide a valid email"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long")
      .matches(/^(?=.*[a-z])(?=.*\d)/)
      .withMessage("Password must contain at least one lowercase letter, and one number"),
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: "Validation failed",
          errors: errors.array(),
        })
      }

      const { fullName, email, password } = req.body

      // Check if user already exists
      const existingUser = await User.findOne({ email })
      if (existingUser) {
        return res.status(400).json({
          message: "User with this email already exists",
        })
      }

      // Create new user
      const user = new User({
        fullName,
        email,
        password,
      })

      // Generate email verification token
      const verificationToken = user.generateEmailVerificationToken()
      await user.save()

      // Send verification email
      try {
        await sendVerificationEmail(email, fullName, verificationToken)
      } catch (emailError) {
        console.error("Email sending failed:", emailError)
        // Don't fail registration if email fails
      }

      res.status(201).json({
        message: "Registration successful! Please check your email to verify your account.",
        userId: user._id,
      })
    } catch (error) {
      console.error("Registration error:", error)
      res.status(500).json({
        message: "Registration failed",
        error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
      })
    }
  },
)

// Email verification route
router.post(
  "/verify-email",
  [body("token").notEmpty().withMessage("Verification token is required")],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: "Validation failed",
          errors: errors.array(),
        })
      }

      const { token } = req.body

      const user = await User.findOne({
        emailVerificationToken: token,
        emailVerificationExpires: { $gt: Date.now() },
      })

      if (!user) {
        return res.status(400).json({
          message: "Invalid or expired verification token",
        })
      }

      user.isEmailVerified = true
      user.emailVerificationToken = null
      user.emailVerificationExpires = null
      await user.save()

      const jwtToken = generateToken(user._id)

      res.json({
        message: "Email verified successfully!",
        token: jwtToken,
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          isEmailVerified: user.isEmailVerified,
        },
      })
    } catch (error) {
      console.error("Email verification error:", error)
      res.status(500).json({
        message: "Email verification failed",
        error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
      })
    }
  },
)

// Login route
router.post(
  "/login",
  authLimiter,
  [
    body("email").isEmail().normalizeEmail().withMessage("Please provide a valid email"),
    body("password").notEmpty().withMessage("Password is required"),
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

      const { email, password } = req.body

      // Find user and include password for comparison
      const user = await User.findOne({ email }).select("+password")
      if (!user) {
        return res.status(401).json({
          message: "Invalid email or password",
        })
      }

      // Check password
      const isPasswordValid = await user.comparePassword(password)
      if (!isPasswordValid) {
        return res.status(401).json({
          message: "Invalid email or password",
        })
      }

      // Check if email is verified
      if (!user.isEmailVerified) {
        return res.status(401).json({
          message: "Please verify your email before logging in",
        })
      }

      // Update last login
      user.lastLogin = new Date()
      await user.save()

      // Generate token
      const token = generateToken(user._id)

      res.json({
        message: "Login successful",
        token,
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          isEmailVerified: user.isEmailVerified,
          lastLogin: user.lastLogin,
        },
      })
    } catch (error) {
      console.error("Login error:", error)
      res.status(500).json({
        message: "Login failed",
        error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
      })
    }
  },
)

// Get current user profile
router.get("/profile", auth, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user._id,
        fullName: req.user.fullName,
        email: req.user.email,
        isEmailVerified: req.user.isEmailVerified,
        lastLogin: req.user.lastLogin,
        createdAt: req.user.createdAt,
      },
    })
  } catch (error) {
    console.error("Profile fetch error:", error)
    res.status(500).json({
      message: "Failed to fetch profile",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    })
  }
})

// Resend verification email
router.post(
  "/resend-verification",
  authLimiter,
  [body("email").isEmail().normalizeEmail().withMessage("Please provide a valid email")],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: "Validation failed",
          errors: errors.array(),
        })
      }

      const { email } = req.body

      const user = await User.findOne({ email })
      if (!user) {
        return res.status(404).json({
          message: "User not found",
        })
      }

      if (user.isEmailVerified) {
        return res.status(400).json({
          message: "Email is already verified",
        })
      }

      // Generate new verification token
      const verificationToken = user.generateEmailVerificationToken()
      await user.save()

      // Send verification email
      try {
        await sendVerificationEmail(email, user.fullName, verificationToken)
        res.json({
          message: "Verification email sent successfully",
        })
      } catch (emailError) {
        console.error("Email sending failed:", emailError)
        res.status(500).json({
          message: "Failed to send verification email",
        })
      }
    } catch (error) {
      console.error("Resend verification error:", error)
      res.status(500).json({
        message: "Failed to resend verification email",
        error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
      })
    }
  },
)

module.exports = router
