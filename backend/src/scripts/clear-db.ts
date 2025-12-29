
import { db } from '../db/database.js';

console.log('Clearing all chat history...');

try {
    const deleteMessages = db.prepare('DELETE FROM messages');
    const deleteConversations = db.prepare('DELETE FROM conversations');

    const messagesResult = deleteMessages.run();
    console.log(`Deleted ${messagesResult.changes} messages.`);

    const conversationsResult = deleteConversations.run();
    console.log(`Deleted ${conversationsResult.changes} conversations.`);

    console.log('✅ Chat history cleared successfully.');
} catch (error) {
    console.error('Error clearing data:', error);
}
