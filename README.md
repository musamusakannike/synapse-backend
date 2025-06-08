# Synapse - AI-Powered Website Analysis Tool

Synapse is a Node.js application that allows users to analyze websites using AI. Users can input a website URL, and the application will scrape the content, summarize it using Google's Gemini AI, and allow follow-up questions about the website.

## Features

- **User Authentication**: Complete registration and login system with email verification
- **Email Verification**: Secure email verification using Gmail SMTP
- **Advanced Website Scraping**: 
  - Static HTML scraping with Cheerio
  - JavaScript-rendered content scraping with Puppeteer
  - Automatic detection of JavaScript-heavy websites
- **AI Analysis**: Website summarization using Google's Gemini AI
- **Interactive Chat**: Ask follow-up questions about analyzed websites
- **Conversation History**: Save and retrieve previous website analyses
- **Rate Limiting**: Protect against abuse with request rate limiting
- **Security**: JWT-based authentication with bcrypt password hashing

## Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or cloud instance)
- Gmail account with App Password for email verification
- Google Gemini API key
- Chrome or Chromium (for Puppeteer)

## Installation

1. **Clone the repository**
   \`\`\`bash
   git clone <repository-url>
   cd synapse
   \`\`\`

2. **Install dependencies**
   \`\`\`bash
   npm install
   \`\`\`

3. **Environment Setup**
   - Copy `.env.example` to `.env`
   - Fill in all the required environment variables:
     \`\`\`env
     MONGODB_URI=mongodb://localhost:27017/synapse
     JWT_SECRET=your_super_secret_jwt_key_here
     JWT_EXPIRE=7d
     EMAIL_HOST=smtp.gmail.com
     EMAIL_PORT=587
     EMAIL_USER=your_email@gmail.com
     EMAIL_PASS=your_gmail_app_password
     EMAIL_FROM=noreply@synapse.com
     GEMINI_API_KEY=your_gemini_api_key
     PORT=5000
     NODE_ENV=development
     CLIENT_URL=http://localhost:3000
     \`\`\`

4. **Gmail App Password Setup**
   - Go to your Google Account settings
   - Enable 2-Factor Authentication
   - Generate an App Password for "Mail"
   - Use this App Password in the `EMAIL_PASS` environment variable

5. **Get Gemini API Key**
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Add it to your `.env` file

6. **Puppeteer Requirements**
   - On Linux, you may need to install additional dependencies:
     \`\`\`bash
     sudo apt-get install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget
     \`\`\`

## Usage

1. **Start the server**
   \`\`\`bash
   npm start
   # or for development with auto-restart
   npm run dev
   \`\`\`

2. **API Endpoints**

   ### Authentication
   - `POST /api/auth/register` - Register a new user
   - `POST /api/auth/login` - Login user
   - `POST /api/auth/verify-email` - Verify email address
   - `GET /api/auth/profile` - Get user profile
   - `POST /api/auth/resend-verification` - Resend verification email

   ### AI Analysis
   - `POST /api/ai/analyze` - Analyze a website URL
     - Optional `useJavaScript: true` parameter to force Puppeteer rendering
   - `POST /api/ai/chat/:conversationId` - Ask follow-up questions
   - `GET /api/ai/conversations` - Get conversation history
   - `GET /api/ai/conversations/:id` - Get specific conversation
   - `DELETE /api/ai/conversations/:id` - Delete conversation

## API Usage Examples

### Register a User
\`\`\`bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "John Doe",
    "email": "john@example.com",
    "password": "SecurePass123"
  }'
\`\`\`

### Analyze a Website (with JavaScript rendering)
\`\`\`bash
curl -X POST http://localhost:5000/api/ai/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "url": "https://example.com",
    "useJavaScript": true
  }'
\`\`\`

### Ask Follow-up Question
\`\`\`bash
curl -X POST http://localhost:5000/api/ai/chat/CONVERSATION_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "question": "What is their pricing model?"
  }'
\`\`\`

## Advanced Scraping Features

Synapse uses a hybrid approach to website scraping:

1. **Automatic Detection**: The system automatically detects JavaScript-heavy websites based on the URL and uses the appropriate scraping method.

2. **Cheerio (Default)**: For static websites, Synapse uses Cheerio which is fast and lightweight.

3. **Puppeteer (JavaScript Support)**: For dynamic websites with JavaScript content, Synapse uses Puppeteer to render the page in a headless browser.

4. **Smart Resource Management**: The Puppeteer browser instance is managed efficiently:
   - Browser is initialized on demand
   - Pages are closed after use
   - Browser is automatically closed after 15 minutes of inactivity
   - Graceful shutdown on application termination

5. **Fallback Mechanism**: If Puppeteer scraping fails, the system automatically falls back to Cheerio (unless explicitly requested to use Puppeteer).

6. **Content Extraction**: Both scrapers use intelligent content extraction to find the main content area of the page.

## Project Structure

\`\`\`
synapse/
├── models/
│   ├── User.js              # User model with authentication
│   └── Conversation.js      # Conversation model for chat history
├── routes/
│   ├── auth.js             # Authentication routes
│   └── ai.js               # AI analysis and chat routes
├── middleware/
│   └── auth.js             # JWT authentication middleware
├── utils/
│   ├── email.js            # Email sending utilities
│   ├── scraper.js          # Website scraping coordinator
│   ├── puppeteerScraper.js # JavaScript-enabled scraping
│   └── browserManager.js   # Puppeteer browser lifecycle management
├── server.js               # Main server file
├── package.json            # Dependencies and scripts
├── .env.example           # Environment variables template
└── README.md              # This file
\`\`\`

## Security Features

- **Password Hashing**: Passwords are hashed using bcrypt with salt rounds
- **JWT Authentication**: Secure token-based authentication
- **Email Verification**: Users must verify their email before accessing features
- **Rate Limiting**: Prevents abuse with configurable rate limits
- **Input Validation**: All inputs are validated using express-validator
- **CORS Protection**: Configurable CORS settings

## Rate Limits

- General API: 100 requests per 15 minutes per IP
- Authentication: 5 requests per 15 minutes per IP
- AI Analysis: 20 requests per hour per user

## Error Handling

The application includes comprehensive error handling:
- Validation errors return detailed field-specific messages
- Authentication errors provide clear feedback
- Website scraping errors handle various failure scenarios
- AI API errors are gracefully handled and logged

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.
