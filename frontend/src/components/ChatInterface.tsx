import { useState, useEffect, useRef } from 'react'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import { sendMessage, getHistory, Message } from '../services/chatService'
import './ChatInterface.css'

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load conversation history on mount if sessionId exists in localStorage
  useEffect(() => {
    const savedSessionId = localStorage.getItem('chatSessionId')
    if (savedSessionId) {
      setSessionId(savedSessionId)
      loadHistory(savedSessionId)
    }
  }, [])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadHistory = async (sessionId: string) => {
    try {
      const history = await getHistory(sessionId)
      setMessages(history)
    } catch (err: any) {
      console.error('Failed to load history:', err)
      // Don't show error for history loading, just start fresh
    }
  }

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      sender: 'user',
      text: text.trim(),
      timestamp: new Date().toISOString()
    }

    // Optimistically add user message
    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)
    setError(null)

    try {
      const response = await sendMessage(text.trim(), sessionId || undefined)
      
      // Update session ID if we got a new one
      if (response.sessionId) {
        setSessionId(response.sessionId)
        localStorage.setItem('chatSessionId', response.sessionId)
      }

      // Remove temp message and add real messages
      setMessages(prev => {
        const withoutTemp = prev.filter(m => !m.id.startsWith('temp-'))
        return [
          ...withoutTemp,
          userMessage,
          {
            id: `ai-${Date.now()}`,
            sender: 'ai',
            text: response.reply,
            timestamp: new Date().toISOString()
          }
        ]
      })
    } catch (err: any) {
      setError(err.message || 'Failed to send message. Please try again.')
      // Remove the optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== userMessage.id))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="chat-interface">
      <MessageList 
        messages={messages} 
        isLoading={isLoading}
        error={error}
        onQuestionClick={handleSendMessage}
      />
      <div ref={messagesEndRef} />
      <MessageInput 
        onSend={handleSendMessage}
        disabled={isLoading}
      />
    </div>
  )
}

