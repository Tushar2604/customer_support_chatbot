import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeDatabase } from './db/database.js';
import chatRoutes from './routes/chatRoutes.js';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables - try multiple paths
// __dirname is backend/src, so go up one level to backend/.env
const envPath = join(__dirname, '../.env');
console.log('Loading .env from:', envPath);
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.warn('Error loading .env from calculated path:', result.error.message);
}

// Also try loading from process.cwd() as fallback
if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_AI_API_KEY) {
  console.log('Trying fallback: loading from process.cwd()');
  dotenv.config();
  // Try from backend directory
  const cwdPath = join(process.cwd(), '.env');
  console.log('Trying .env from:', cwdPath);
  dotenv.config({ path: cwdPath });
}

// Debug: Log if API key is loaded (without exposing the key)
const hasApiKey = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY);
if (hasApiKey) {
  const keyValue = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '';
  // Check if it's still the placeholder
  if (keyValue.includes('your_gemini_api_key_here') || keyValue.includes('your_')) {
    console.log('⚠️  WARNING: GEMINI_API_KEY is set but appears to be a placeholder. Please update it with your actual API key.');
  } else {
    console.log('Gemini API Key loaded: ✅ Yes');
  }
} else {
  console.log('Gemini API Key loaded: ❌ No');
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Initialize database
initializeDatabase();
console.log('Database initialized');

// Root endpoint - API info
app.get('/', (req, res) => {
  res.json({
    message: 'Spur Store Chatbot API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      sendMessage: 'POST /api/chat/message',
      getHistory: 'GET /api/chat/history/:sessionId'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/chat', chatRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_AI_API_KEY) {
    console.warn('⚠️  WARNING: GEMINI_API_KEY or GOOGLE_AI_API_KEY not set. LLM functionality will not work.');
  }
});

