import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { chatService } from '../services/chatService.js';

const router = Router();

const messageSchema = z.object({
  message: z.string().min(1).max(2000),
  sessionId: z.string().uuid().optional()
});

// POST /chat/message
router.post('/message', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validationResult = messageSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validationResult.error.errors
      });
    }

    const { message, sessionId } = validationResult.data;

    // Process message
    const result = await chatService.processMessage(message, sessionId);

    res.json(result);
  } catch (error: any) {
    console.error('Error processing message:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'An unexpected error occurred'
    });
  }
});

// GET /chat/history/:sessionId
router.get('/history/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
      return res.status(400).json({
        error: 'Invalid session ID format'
      });
    }

    const history = await chatService.getConversationHistory(sessionId);
    res.json({ messages: history });
  } catch (error: any) {
    console.error('Error fetching history:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'An unexpected error occurred'
    });
  }
});

export default router;




