# AI Live Chat Agent - Spur Store Customer Support

A full-stack web application that simulates a customer support chat where an AI agent answers user questions using OpenAI's GPT-3.5-turbo API.

## Features

- 💬 Real-time chat interface with clean, modern UI
- 🤖 AI-powered responses using OpenAI GPT-3.5-turbo
- 💾 Persistent conversation history with SQLite database
- 🔄 Session management with conversation continuity
- ✅ Input validation and error handling
- 📱 Responsive design
- ⚡ Fast and lightweight

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- Modern CSS with gradient design

### Backend
- **Node.js** with **Express**
- **TypeScript** for type safety
- **SQLite** (better-sqlite3) for persistence
- **OpenAI API** for LLM integration
- **Zod** for input validation

## Prerequisites

- Node.js 18+ and npm
- OpenAI API key ([Get one here](https://aistudio.google.com/app/))

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
npm install --workspace=backend

# Install frontend dependencies
npm install --workspace=frontend
```

Or use the convenience script:
```bash
npm run install:all
```

### 2. Configure Environment Variables

Create a `.env` file in the `backend` directory:

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and add your OpenAI API key:

```env
OPENAI_API_KEY=your_openai_api_key_here
PORT=3001
NODE_ENV=development
DATABASE_PATH=./chatbot.db
MAX_TOKENS=500
MAX_MESSAGES_PER_CONVERSATION=50
```

### 3. Initialize Database

```bash
cd backend
npm run migrate
```

This creates the SQLite database file and sets up the necessary tables.

### 4. Run the Application

#### Option A: Run Both Frontend and Backend Together

From the root directory:
```bash
npm run dev
```

This starts:
- Backend server on `http://localhost:3001`
- Frontend dev server on `http://localhost:3000`

#### Option B: Run Separately

**Backend:**
```bash
cd backend
npm run dev
```

**Frontend (in a new terminal):**
```bash
cd frontend
npm run dev
```

### 5. Open in Browser

Navigate to `http://localhost:3000` to see the chat interface.

## Project Structure

```
Spur_chatbot/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── database.ts          # Database setup and types
│   │   │   ├── conversationRepository.ts  # Data access layer
│   │   │   └── migrate.ts           # Database migration script
│   │   ├── services/
│   │   │   ├── llmService.ts        # OpenAI integration
│   │   │   └── chatService.ts       # Business logic
│   │   ├── routes/
│   │   │   └── chatRoutes.ts        # API endpoints
│   │   └── index.ts                 # Express server entry point
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/          # React components
│   │   ├── services/
│   │   │   └── chatService.ts     # API client
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

## Architecture Overview

### Backend Architecture

The backend follows a **layered architecture** pattern:

1. **Routes Layer** (`routes/chatRoutes.ts`)
   - Handles HTTP requests/responses
   - Input validation using Zod
   - Error handling and status codes

2. **Service Layer** (`services/`)
   - **ChatService**: Orchestrates conversation flow
   - **LLMService**: Encapsulates OpenAI API calls
   - Business logic and error handling

3. **Data Access Layer** (`db/conversationRepository.ts`)
   - Database operations
   - Conversation and message persistence
   - Clean separation from business logic

4. **Database Layer** (`db/database.ts`)
   - SQLite setup and schema
   - Type definitions

### Design Decisions

1. **SQLite over PostgreSQL**: Chosen for simplicity and zero-configuration. Easy to switch to PostgreSQL by changing the database connection.

2. **Better-sqlite3**: Synchronous API simplifies code and is fast enough for this use case.

3. **Service Layer Pattern**: Separates business logic from HTTP handling, making it easy to:
   - Add new channels (WhatsApp, Instagram, etc.)
   - Swap LLM providers
   - Add features like analytics, rate limiting, etc.

4. **Session Management**: Uses UUIDs stored in localStorage for client-side session persistence. Backend creates new conversations automatically.

5. **Error Handling**: Comprehensive error handling at every layer:
   - Input validation with Zod
   - LLM API error handling (rate limits, timeouts, invalid keys)
   - Graceful degradation with user-friendly error messages

6. **Type Safety**: Full TypeScript coverage ensures type safety across the stack.

### LLM Integration

**Provider**: OpenAI GPT-3.5-turbo

**Prompting Strategy**:
- **System Prompt**: Contains store information (shipping, returns, support hours, etc.)
- **Conversation History**: Last 50 messages included for context
- **Temperature**: 0.7 for balanced creativity and consistency
- **Max Tokens**: 500 to keep responses concise

**Error Handling**:
- Handles API errors (401, 429, 500, 503)
- Network timeouts
- Invalid API keys
- Returns user-friendly error messages instead of crashing

**Cost Control**:
- Max tokens per response: 500 (configurable)
- Max messages in history: 50 (configurable)
- Message length limit: 2000 characters

### API Endpoints

#### `POST /api/chat/message`
Send a message and get an AI reply.

**Request:**
```json
{
  "message": "What's your return policy?",
  "sessionId": "optional-uuid"
}
```

**Response:**
```json
{
  "reply": "We offer a 30-day return policy...",
  "sessionId": "uuid-here"
}
```

#### `GET /api/chat/history/:sessionId`
Get conversation history for a session.

**Response:**
```json
{
  "messages": [
    {
      "id": "uuid",
      "conversationId": "uuid",
      "sender": "user",
      "text": "Hello",
      "timestamp": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

## Database Schema

### `conversations`
- `id` (TEXT, PRIMARY KEY): UUID
- `createdAt` (TEXT): ISO timestamp
- `updatedAt` (TEXT): ISO timestamp

### `messages`
- `id` (TEXT, PRIMARY KEY): UUID
- `conversationId` (TEXT, FOREIGN KEY): References conversations.id
- `sender` (TEXT): 'user' or 'ai'
- `text` (TEXT): Message content
- `timestamp` (TEXT): ISO timestamp

## Robustness Features

✅ **Input Validation**
- Empty messages rejected
- Message length capped at 2000 characters
- UUID validation for session IDs
- Zod schema validation on all inputs

✅ **Error Handling**
- LLM API errors caught and returned as friendly messages
- Network errors handled gracefully
- Invalid API keys detected and reported
- Rate limits handled with clear error messages

✅ **Security**
- No hardcoded secrets (all via environment variables)
- Input sanitization (length limits, type checking)
- SQL injection prevention (parameterized queries)

✅ **User Experience**
- Loading states during API calls
- Typing indicator while AI is responding
- Auto-scroll to latest message
- Error messages displayed in UI
- Disabled send button during requests

## Testing the Application

1. **Basic Chat Flow**:
   - Open the app
   - Type a message and send
   - Verify AI response appears

2. **Session Persistence**:
   - Send a few messages
   - Refresh the page
   - Verify conversation history loads

3. **Error Handling**:
   - Try sending an empty message (should be prevented)
   - Try sending a very long message (should be truncated/rejected)
   - Temporarily set invalid API key (should show friendly error)

4. **FAQ Knowledge**:
   - Ask: "What's your return policy?"
   - Ask: "Do you ship to USA?"
   - Ask: "What are your support hours?"
   - Verify accurate answers based on system prompt

## Trade-offs & "If I Had More Time..."

### Current Trade-offs

1. **SQLite**: Simple but not ideal for production scale. Would use PostgreSQL for real deployment.

2. **No Authentication**: Sessions are stored in localStorage. For production, would add proper auth.

3. **Synchronous Database**: better-sqlite3 is synchronous, which is fine for this scale but could be async for better concurrency.

4. **Single LLM Provider**: Hardcoded to OpenAI. Could abstract to support multiple providers.

5. **No Rate Limiting**: Backend doesn't rate limit users. Would add per-session/IP rate limiting.

### If I Had More Time...

1. **Testing**:
   - Unit tests for services and repositories
   - Integration tests for API endpoints
   - E2E tests for chat flow

2. **Enhanced Features**:
   - Message search/filtering
   - Export conversation history
   - Admin dashboard for viewing all conversations
   - Analytics on common questions

3. **Production Readiness**:
   - Docker containerization
   - Environment-based configuration
   - Logging (Winston/Pino)
   - Monitoring and health checks
   - Database migrations system

4. **Multi-Channel Support**:
   - Abstract channel interface
   - Add WhatsApp, Instagram, Facebook Messenger
   - Unified conversation management

5. **Advanced LLM Features**:
   - Streaming responses for better UX
   - Function calling for structured actions
   - RAG (Retrieval Augmented Generation) for dynamic knowledge base
   - Fine-tuning on support conversations

6. **Better UX**:
   - Markdown support in messages
   - File attachments
   - Emoji reactions
   - Typing indicators with actual streaming

7. **Performance**:
   - Response caching for common questions
   - Database connection pooling
   - CDN for static assets
   - Optimistic UI updates

## Troubleshooting

### "OpenAI API key not configured"
- Make sure you created `backend/.env` with `OPENAI_API_KEY=your_key_here`
- Restart the backend server after adding the key

### "Database not initialized"
- Run `npm run migrate` in the `backend` directory

### Port already in use
- Change `PORT` in `backend/.env` or `frontend/vite.config.ts`

### CORS errors
- Make sure backend is running on port 3001
- Check that frontend proxy is configured correctly in `vite.config.ts`

## License

This project is created for assignment purposes.

