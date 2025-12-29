import { GoogleGenerativeAI } from '@google/generative-ai';
import { Message } from '../db/database.js';

const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '500', 10);
const MAX_MESSAGES = parseInt(process.env.MAX_MESSAGES_PER_CONVERSATION || '50', 10);
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';

// High-demand support message
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
    // Lazy-load the genAI instance
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

    // Simple keyword-based fallback responses for common questions
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

    // Generic fallback
    return HIGH_DEMAND_MESSAGE;
  }

  async generateReply(
    conversationHistory: Message[],
    userMessage: string
  ): Promise<string> {

    // Pre-validation for "junk" messages to save API calls
    if (!userMessage || !userMessage.trim()) {
      return "It seems like you sent an empty message. How can I help you today?";
    }

    if (this.isOnlyEmojis(userMessage)) {
      return "I love emojis too! 😊 How can I assist you with your spur store shopping?";
    }

    if (this.isGibberish(userMessage)) {
      return "I'm not sure I understood that. Could you please rephrase your question? I'm here to help with shipping, returns, and product info!";
    }

    // We no longer get the model here, we sort it out in the retry logic
    // const model = this.getModel();

    // Limit conversation history to prevent token overflow
    const recentMessages = conversationHistory.slice(-MAX_MESSAGES);

    // Build conversation history for Gemini
    // Gemini uses a different format - combine system prompt with conversation
    let prompt = SYSTEM_PROMPT + '\n\n';

    // Add conversation history
    for (const msg of recentMessages) {
      const role = msg.sender === 'user' ? 'Customer' : 'Support Agent';
      prompt += `${role}: ${msg.text}\n\n`;
    }

    // Add current user message
    prompt += `Customer: ${userMessage}\n\nSupport Agent:`;

    const maxRetries = 3;
    let lastError: any = null;

    const attemptGeneration = async (modelName: string) => {
      const model = this.getModel(modelName);
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const result = await model.generateContent(prompt, {
            // maxOutputTokens: MAX_TOKENS, // Deprecated in some versions, but fine if supported
            // generationConfig preferred in newer versions
          });

          const response = result.response;
          const reply = response.text();

          if (!reply) throw new Error('Empty response from Gemini');
          return reply.trim();
        } catch (error: any) {
          lastError = error;
          const errorMessage = error.message || error.toString();
          const errorStatus = error.status || error.code || 0;

          // Handle 404 Model Not Found specifically -> break to try fallback
          if (errorMessage.includes('404') || errorMessage.includes('not found')) {
            console.warn(`Model ${modelName} not found (404), saving error to try fallback.`);
            throw error; // Rethrow to let the outer loop handle fallback or fail
          }

          if (errorStatus === 401 || errorMessage.includes('API key') || errorMessage.includes('authentication')) {
            throw new Error('Invalid API key. Please check your GEMINI_API_KEY.');
          }

          // Rate limit handling
          if (errorStatus === 429 || errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
            if (attempt < maxRetries - 1) {
              const retryAfter = Math.min(1000 * Math.pow(2, attempt), 10000);
              console.warn(`Rate limit hit for ${modelName}, retrying after ${retryAfter}ms...`);
              await this.sleep(retryAfter);
              continue;
            }
          }

          // Server errors
          if (errorStatus >= 500) {
            if (attempt < maxRetries - 1) {
              await this.sleep(1000 * (attempt + 1));
              continue;
            }
          }

          // Break on other errors (like 400 Bad Request if not 404) to avoid useless retries
          if (attempt === maxRetries - 1) throw error;
        }
      }
      throw lastError;
    };

    // Try primary model
    try {
      return await attemptGeneration(GEMINI_MODEL);
    } catch (error: any) {
      // If primary failed with 404, 429 or other issues, try fallback if it was the primary model
      const is404 = error.message.includes('404') || error.message.includes('not found');
      const is429 = error.message.includes('429') || error.message.includes('quota') || error.message.includes('rate limit');

      if ((is404 || is429) && GEMINI_MODEL.includes('flash')) {
        const fallbackModel = 'gemini-flash-latest'; // Or gemini-1.5-pro-latest if needed, but flash is safer for quota
        console.warn(`Primary model ${GEMINI_MODEL} failed (404/429), attempting fallback to ${fallbackModel}`);
        try {
          return await attemptGeneration(fallbackModel);
        } catch (fallbackError: any) {
          console.error('Fallback model also failed:', fallbackError);
        }
      }
      // If we fall through, we return fallback response below
    }

    // If we get here, all retries failed
    if (lastError) {
      console.error('Gemini API error after retries:', lastError);
      // Use fallback for common questions, otherwise throw
      return this.getFallbackResponse(userMessage);
    }

    throw new Error(`Failed to generate reply: ${lastError?.message || 'Unknown error'}`);
  }

  private isGibberish(text: string): boolean {
    const cleanText = text.trim();
    if (cleanText.length < 4) return false; // Too short to judge

    // Check for keyboard mashing (simple heuristic: long words with no spaces and high consonant ratio)
    // or just repeated characters
    const repeatedChars = /(.)\1{3,}/; // 4+ same chars in a row
    if (repeatedChars.test(cleanText)) return true;

    // Check for "words" that are too long (likely keyboard mashing)
    const words = cleanText.split(/\s+/);
    const hasSuperLongWord = words.some(w => w.length > 20);
    if (hasSuperLongWord) return true;

    // Check for lack of vowels in longer strings (heuristic)
    // const vowels = /[aeiouy]/i;
    // if (cleanText.length > 10 && !vowels.test(cleanText)) return true;

    return false;
  }

  private isOnlyEmojis(text: string): boolean {
    // Remove all generic emoticons/emojis and spaces
    // This regex matches most emoji ranges
    const emojiRegex = /^(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|\ud83c[\ude32-\ude3a]|\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff]|\s)+$/;
    return emojiRegex.test(text);
  }

  isConfigured(): boolean {
    return !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY);
  }
}

export const llmService = new LLMService();
