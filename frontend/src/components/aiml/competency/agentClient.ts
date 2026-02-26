/**
 * AIML WebSocket Agent Client - Connects to Python kernel execution agent
 * Based on competency/frontend/utils/agentClient.ts but adapted for AIML
 */

type ExecuteResult = {
  stdout: string
  stderr: string
  images: Array<{ mime_type: string; data: string }>
  error?: { 
    type?: string
    value?: string
    ename?: string  // Jupyter-style error name
    evalue?: string // Jupyter-style error value
    traceback?: string[]
  }
  success: boolean
}

type PendingExecution = {
  resolve: (result: ExecuteResult) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
}

class AIMLAgentClient {
  private ws: WebSocket | null = null
  private pendingExecutions = new Map<string, PendingExecution>()
  private reconnectAttempt = 0
  private maxReconnectAttempts = 5 // Stop trying after 5 failed attempts
  private maxReconnectDelay = 30000 // 30 seconds
  private isConnecting = false
  private reconnectTimeout: NodeJS.Timeout | null = null
  private debounceTimeout: NodeJS.Timeout | null = null
  private permanentlyDisconnected = false // Stop reconnecting if agent is unavailable

  constructor(private agentUrl = process.env.NEXT_PUBLIC_AIML_AGENT_URL || 'wss://aiml-agent-service.delightfulpebble-b20f7903.centralindia.azurecontainerapps.io') {}

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return
    if (this.isConnecting) return
    if (this.permanentlyDisconnected) {
      throw new Error('AIML agent is not available. Please start the agent service.')
    }

    this.isConnecting = true

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.agentUrl)

        this.ws.onopen = () => {
          console.log('[AIMLAgent] Connected to agent')
          this.reconnectAttempt = 0
          this.isConnecting = false
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            
            if (message.type === 'result' && message.run_id) {
              const pending = this.pendingExecutions.get(message.run_id)
              if (pending) {
                clearTimeout(pending.timeout)
                this.pendingExecutions.delete(message.run_id)
                pending.resolve({
                  stdout: message.stdout || '',
                  stderr: message.stderr || '',
                  images: message.images || [],
                  error: message.error,
                  success: message.success !== false,
                })
              }
            }
          } catch (err) {
            console.error('[AIMLAgent] Failed to parse message:', err)
          }
        }

        this.ws.onerror = (error) => {
          console.error('[AIMLAgent] WebSocket error:', error)
          this.isConnecting = false
          // PRODUCTION FIX: Track failed connection attempt even on immediate error
          // onclose will also fire and call scheduleReconnect, but we need to ensure
          // the attempt is tracked even if onclose doesn't fire in some edge cases
          reject(new Error('WebSocket connection failed'))
        }

        this.ws.onclose = (event) => {
          console.log('[AIMLAgent] Connection closed', event.code, event.reason)
          this.ws = null
          this.isConnecting = false
          // PRODUCTION FIX: Always schedule reconnect attempt tracking
          // This will increment reconnectAttempt and eventually set permanentlyDisconnected
          this.scheduleReconnect()
        }
      } catch (err) {
        this.isConnecting = false
        reject(err)
      }
    })
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) return
    if (this.permanentlyDisconnected) return

    // Stop trying after max attempts - agent is likely not running
    if (this.reconnectAttempt >= this.maxReconnectAttempts) {
      console.log('[AIMLAgent] Max reconnection attempts reached. AIML agent service is not available.')
      console.log('[AIMLAgent] AIML code execution will not work until the agent is started.')
      this.permanentlyDisconnected = true
      return
    }

    // Debounce reconnects (useful for HMR)
    if (this.debounceTimeout) clearTimeout(this.debounceTimeout)
    
    this.debounceTimeout = setTimeout(() => {
      const delay = Math.min(
        500 * Math.pow(1.8, this.reconnectAttempt),
        this.maxReconnectDelay
      )
      
      console.log(`[AIMLAgent] Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempt + 1}/${this.maxReconnectAttempts})`)
      this.reconnectAttempt++
      
      this.reconnectTimeout = setTimeout(() => {
        this.reconnectTimeout = null
        this.connect().catch(() => {
          // Reconnect failed, will try again via onclose
        })
      }, delay)
    }, 300) // 300ms debounce
  }

  async execute(
    code: string,
    sessionId: string,
    runId?: string,
    timeoutMs = 120000
  ): Promise<ExecuteResult> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connect()
    }

    const actualRunId = runId || `run_${Date.now()}_${Math.random().toString(36).substring(7)}`

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingExecutions.delete(actualRunId)
        reject(new Error('Execution timeout'))
      }, timeoutMs)

      this.pendingExecutions.set(actualRunId, { resolve, reject, timeout })

      this.ws!.send(
        JSON.stringify({
          type: 'execute',
          code,
          session_id: sessionId,
          run_id: actualRunId,
        })
      )
    })
  }

  async interruptKernel(sessionId: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to agent')
    }

    // Reject all pending executions
    this.pendingExecutions.forEach(({ reject, timeout }) => {
      clearTimeout(timeout)
      reject(new Error('Interrupted by user'))
    })
    this.pendingExecutions.clear()

    this.ws.send(
      JSON.stringify({
        type: 'interrupt',
        session_id: sessionId,
      })
    )
  }

  async restartKernel(sessionId: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to agent')
    }

    this.ws.send(
      JSON.stringify({
        type: 'restart',
        session_id: sessionId,
      })
    )
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout)
      this.debounceTimeout = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  // Reset connection state to allow retrying after the agent is started
  resetConnectionState() {
    this.reconnectAttempt = 0
    this.permanentlyDisconnected = false
    this.isConnecting = false
  }

  isAgentUnavailable(): boolean {
    return this.permanentlyDisconnected
  }
}

// Singleton instance
const agentClient = new AIMLAgentClient()

// Public API
export async function connect() {
  return agentClient.connect()
}

export async function executeCode(
  code: string,
  sessionId: string,
  runId?: string,
  timeoutMs?: number
) {
  return agentClient.execute(code, sessionId, runId, timeoutMs)
}

export async function interruptKernel(sessionId: string) {
  return agentClient.interruptKernel(sessionId)
}

export async function restartKernel(sessionId: string) {
  return agentClient.restartKernel(sessionId)
}

export function isConnected() {
  return agentClient.isConnected()
}

export function disconnect() {
  return agentClient.disconnect()
}

export function resetConnectionState() {
  return agentClient.resetConnectionState()
}

export function isAgentUnavailable() {
  return agentClient.isAgentUnavailable()
}

