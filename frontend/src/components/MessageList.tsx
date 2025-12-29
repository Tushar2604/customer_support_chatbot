import { Message } from '../services/chatService'
import './MessageList.css'

interface MessageListProps {
  messages: Message[]
  isLoading: boolean
  error: string | null
  onQuestionClick?: (question: string) => void
}

export default function MessageList({ messages, isLoading, error, onQuestionClick }: MessageListProps) {
  return (
    <div className="message-list">
      {messages.length === 0 && !isLoading && (
        <div className="welcome-message">
          <p>👋 Welcome to Spur Store Support!</p>
          <p>How can I help you today?</p>
          <div className="example-questions">
            <p className="examples-label">Try asking:</p>
            <ul>
              <li onClick={() => onQuestionClick?.("What's your return policy?")}>
                What's your return policy?
              </li>
              <li onClick={() => onQuestionClick?.("Do you ship to USA?")}>
                Do you ship to USA?
              </li>
              <li onClick={() => onQuestionClick?.("What are your support hours?")}>
                What are your support hours?
              </li>
            </ul>
          </div>
        </div>
      )}
      
      {messages.map((message) => (
        <div
          key={message.id}
          className={`message ${message.sender === 'user' ? 'message-user' : 'message-ai'}`}
        >
          <div className="message-content">
            <div className="message-text">{message.text}</div>
            <div className="message-time">
              {new Date(message.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>
        </div>
      ))}

      {isLoading && (
        <div className="message message-ai">
          <div className="message-content">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}
    </div>
  )
}

