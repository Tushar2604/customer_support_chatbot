import { db, Conversation, Message } from './database.js';
import { v4 as uuidv4 } from 'uuid';

export class ConversationRepository {
  createConversation(): Conversation {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO conversations (id, createdAt, updatedAt)
      VALUES (?, ?, ?)
    `).run(id, now, now);

    return { id, createdAt: now, updatedAt: now };
  }

  getConversation(id: string): Conversation | null {
    const row = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as Conversation | undefined;
    return row || null;
  }

  updateConversationTimestamp(id: string) {
    const now = new Date().toISOString();
    db.prepare('UPDATE conversations SET updatedAt = ? WHERE id = ?').run(now, id);
  }

  addMessage(conversationId: string, sender: 'user' | 'ai', text: string): Message {
    const id = uuidv4();
    const timestamp = new Date().toISOString();

    db.prepare(`
      INSERT INTO messages (id, conversationId, sender, text, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, conversationId, sender, text, timestamp);

    // Update conversation timestamp
    this.updateConversationTimestamp(conversationId);

    return { id, conversationId, sender, text, timestamp };
  }

  getMessages(conversationId: string): Message[] {
    return db.prepare(`
      SELECT * FROM messages 
      WHERE conversationId = ? 
      ORDER BY timestamp ASC
    `).all(conversationId) as Message[];
  }

  getRecentMessages(conversationId: string, limit: number = 20): Message[] {
    return db.prepare(`
      SELECT * FROM messages 
      WHERE conversationId = ? 
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(conversationId, limit).reverse() as Message[];
  }
}

export const conversationRepository = new ConversationRepository();

