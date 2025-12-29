import { conversationRepository } from '../db/conversationRepository.js';
import { llmService } from './llmService.js';
import { Message } from '../db/database.js';

export class ChatService {
  async processMessage(
    message: string,
    sessionId?: string
  ): Promise<{ reply: string; sessionId: string }> {
  
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      throw new Error('Message cannot be empty');
    }

  
    const MAX_MESSAGE_LENGTH = 2000;
    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`Message too long. Maximum length is ${MAX_MESSAGE_LENGTH} characters.`);
    }

   
    let conversationId = sessionId;
    if (!conversationId) {
      const conversation = conversationRepository.createConversation();
      conversationId = conversation.id;
    } else {
     
      const conversation = conversationRepository.getConversation(conversationId);
      if (!conversation) {
       
        const newConversation = conversationRepository.createConversation();
        conversationId = newConversation.id;
      }
    }

   
    conversationRepository.addMessage(conversationId, 'user', trimmedMessage);

   
    const history = conversationRepository.getMessages(conversationId);

    
    let reply: string;
    try {
      reply = await llmService.generateReply(history, trimmedMessage);
    } catch (error: any) {
     
      reply = `I apologize, but I'm having trouble processing your request right now. ${error.message || 'Please try again later.'}`;
    }

   
    conversationRepository.addMessage(conversationId, 'ai', reply);

    return {
      reply,
      sessionId: conversationId
    };
  }

  async getConversationHistory(sessionId: string): Promise<Message[]> {
    const conversation = conversationRepository.getConversation(sessionId);
    if (!conversation) {
      return [];
    }
    return conversationRepository.getMessages(sessionId);
  }
}

export const chatService = new ChatService();




