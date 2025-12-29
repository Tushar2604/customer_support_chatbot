import { GoogleGenerativeAI } from '@google/generative-ai';
import { Message } from '../db/database.js';

const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '500', 10);
const MAX_MESSAGES = parseInt(process.env.MAX_MESSAGES_PER_CONVERSATION || '50', 10);
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';


const HIGH_DEMAND_MESSAGE = "I'm currently experiencing high demand, but I'm here to help! For immediate assistance, please contact our support team at support@spurstore.com or call 1-800-SPUR-HELP. Our support hours are Monday-Friday, 9 AM - 6 PM EST.";

const SYSTEM_PROMPT = `You are a helpful and friendly customer support agent for a small e-commerce store called "Spur Store". Your goal is to assist customers with their questions clearly and concisely.

Store Information:
- Store Name: Spur Store
- Shipping: We ship to USA, Canada, and select international locations. Standard shipping takes 5-7 business days, express shipping takes 2-3 business days.
- Returns: We offer a 30-day return policy. Items must be in original condition with tags attached. Returns are free for orders over $50.
- Refunds: Refunds are processed within 5-7 business days after we receive the returned item.
- Support Hours: Monday-Friday, 9 AM - 6 PM EST. We respond to emails within 24 hours.
- Contact: support@spurstore.com or call 1-800-SPUR-HELP
- Payment: We accept all major credit cards, PayPal, and Apple Pay.

Guidelines:
- Be friendly, professional, and empathetic
- Keep responses concise but helpful
- If you don't know something specific, acknowledge it and offer to help find the answer
- Always maintain a positive, solution-oriented tone`;

export class LLMService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  private getModel(modelName: string = GEMINI_MODEL) {
    
    if (!this.genAI) {
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
      if (!apiKey) {
        throw new Error('Gemini API key not configured. Please set GEMINI_API_KEY or GOOGLE_AI_API_KEY environment variable.');
      }
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
    return this.genAI.getGenerativeModel({ model: modelName });
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getFallbackResponse(userMessage: string): string {
    const lowerMessage = userMessage.toLowerCase();

   
    if (lowerMessage.includes('return') || lowerMessage.includes('refund')) {
      return "We offer a 30-day return policy. Items must be in original condition with tags attached. Returns are free for orders over $50. Refunds are processed within 5-7 business days after we receive the returned item. If you need help with a return, please contact us at support@spurstore.com or call 1-800-SPUR-HELP.";
    }

    if (lowerMessage.includes('ship') || lowerMessage.includes('shipping') || lowerMessage.includes('delivery')) {
      return "We ship to USA, Canada, and select international locations. Standard shipping takes 5-7 business days, and express shipping takes 2-3 business days. For more specific shipping information, please contact us at support@spurstore.com.";
    }

    if (lowerMessage.includes('support') || lowerMessage.includes('hours') || lowerMessage.includes('contact')) {
      return "Our support hours are Monday-Friday, 9 AM - 6 PM EST. We respond to emails within 24 hours. You can reach us at support@spurstore.com or call 1-800-SPUR-HELP.";
    }

    if (lowerMessage.includes('payment') || lowerMessage.includes('pay') || lowerMessage.includes('card')) {
      return "We accept all major credit cards, PayPal, and Apple Pay. If you have questions about payment methods, please contact us at support@spurstore.com.";
    }

    
    return HIGH_DEMAND_MESSAGE;
  }

  async generateReply(
    conversationHistory: Message[],
    userMessage: string
  ): Promise<string> {

    
    if (!userMessage || !userMessage.trim()) {
      return "It seems like you sent an empty message. How can I help you today?";
    }

    if (this.isOnlyEmojis(userMessage)) {
      return "I love emojis too! 😊 How can I assist you with your spur store shopping?";
    }

    if (this.isGibberish(userMessage)) {
      return "I'm not sure I understood that. Could you please rephrase your question? I'm here to help with shipping, returns, and product info!";
    }

    
    const recentMessages = conversationHistory.slice(-MAX_MESSAGES);

  
    let prompt = SYSTEM_PROMPT + '\n\n';

  
    for (const msg of recentMessages) {
      const role = msg.sender === 'user' ? 'Customer' : 'Support Agent';
      prompt += `${role}: ${msg.text}\n\n`;
    }


    prompt += `Customer: ${userMessage}\n\nSupport Agent:`;

    const maxRetries = 3;
    let lastError: any = null;

    const attemptGeneration = async (modelName: string) => {
      const model = this.getModel(modelName);
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const result = await model.generateContent(prompt, {
           
          });

          const response = result.response;
          const reply = response.text();

          if (!reply) throw new Error('Empty response from Gemini');
          return reply.trim();
        } catch (error: any) {
          lastError = error;
          const errorMessage = error.message || error.toString();
          const errorStatus = error.status || error.code || 0;

         
          if (errorMessage.includes('404') || errorMessage.includes('not found')) {
            console.warn(`Model ${modelName} not found (404), saving error to try fallback.`);
            throw error; 
          }

          if (errorStatus === 401 || errorMessage.includes('API key') || errorMessage.includes('authentication')) {
            throw new Error('Invalid API key. Please check your GEMINI_API_KEY.');
          }

        
          if (errorStatus === 429 || errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
            if (attempt < maxRetries - 1) {
              const retryAfter = Math.min(1000 * Math.pow(2, attempt), 10000);
              console.warn(`Rate limit hit for ${modelName}, retrying after ${retryAfter}ms...`);
              await this.sleep(retryAfter);
              continue;
            }
          }

          
          if (errorStatus >= 500) {
            if (attempt < maxRetries - 1) {
              await this.sleep(1000 * (attempt + 1));
              continue;
            }
          }

        
          if (attempt === maxRetries - 1) throw error;
        }
      }
      throw lastError;
    };

   
    try {
      return await attemptGeneration(GEMINI_MODEL);
    } catch (error: any) {
     
      const is404 = error.message.includes('404') || error.message.includes('not found');
      const is429 = error.message.includes('429') || error.message.includes('quota') || error.message.includes('rate limit');

      if ((is404 || is429) && GEMINI_MODEL.includes('flash')) {
        const fallbackModel = 'gemini-flash-latest'; 
        console.warn(`Primary model ${GEMINI_MODEL} failed (404/429), attempting fallback to ${fallbackModel}`);
        try {
          return await attemptGeneration(fallbackModel);
        } catch (fallbackError: any) {
          console.error('Fallback model also failed:', fallbackError);
        }
      }
     
    }

    
    if (lastError) {
      console.error('Gemini API error after retries:', lastError);
      
      return this.getFallbackResponse(userMessage);
    }

    throw new Error(`Failed to generate reply: ${lastError?.message || 'Unknown error'}`);
  }

  private isGibberish(text: string): boolean {
    const cleanText = text.trim();
    if (cleanText.length < 4) return false; 

    
    const repeatedChars = /(.)\1{3,}/; 
    if (repeatedChars.test(cleanText)) return true;

   
    const words = cleanText.split(/\s+/);
    const hasSuperLongWord = words.some(w => w.length > 20);
    if (hasSuperLongWord) return true;

   

    return false;
  }

  private isOnlyEmojis(text: string): boolean {
    
    const emojiRegex = /^(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|\ud83c[\ude32-\ude3a]|\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff]|\s)+$/;
    return emojiRegex.test(text);
  }

  isConfigured(): boolean {
    return !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY);
  }
}

export const llmService = new LLMService();
