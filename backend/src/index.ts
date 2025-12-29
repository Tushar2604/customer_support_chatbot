import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeDatabase } from './db/database.js';
import chatRoutes from './routes/chatRoutes.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


const envPath = join(__dirname, '../.env');
console.log('Loading .env from:', envPath);
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.warn('Error loading .env from calculated path:', result.error.message);
}


if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_AI_API_KEY) {
  console.log('Trying fallback: loading from process.cwd()');
  dotenv.config();

  const cwdPath = join(process.cwd(), '.env');
  console.log('Trying .env from:', cwdPath);
  dotenv.config({ path: cwdPath });
}


const hasApiKey = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY);
if (hasApiKey) {
  const keyValue = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '';

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


const allowedOrigins = ['http://localhost:3000', 'http://localhost:5173'];
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: function (origin, callback) {

    if (!origin) return callback(null, true);


    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }


    if (origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));


app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});


initializeDatabase();
console.log('Database initialized');


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


app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


app.use('/api/chat', chatRoutes);


app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
  });
});


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

