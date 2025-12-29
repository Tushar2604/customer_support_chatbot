const API_BASE_URL = '/api/chat'

export interface Message {
  id: string
  sender: 'user' | 'ai'
  text: string
  timestamp: string
}

export interface SendMessageResponse {
  reply: string
  sessionId: string
}

export async function sendMessage(
  message: string,
  sessionId?: string
): Promise<SendMessageResponse> {
  const response = await fetch(`${API_BASE_URL}/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, sessionId }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Network error' }))
    throw new Error(error.message || error.error || 'Failed to send message')
  }

  return response.json()
}

export async function getHistory(sessionId: string): Promise<Message[]> {
  const response = await fetch(`${API_BASE_URL}/history/${sessionId}`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to load history' }))
    throw new Error(error.message || error.error || 'Failed to load history')
  }

  const data = await response.json()
  return data.messages || []
}




