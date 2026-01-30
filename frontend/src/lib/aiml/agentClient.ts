/**
 * AIML Notebook Agent Client
 * WebSocket client for connecting to the Python kernel agent for AIML code execution
 */

const AGENT_URL = process.env.NEXT_PUBLIC_AIML_AGENT_URL || 'wss://aiml-agent-service.delightfulpebble-b20f7903.centralindia.azurecontainerapps.io'

let ws: WebSocket | null = null
let isConnecting = false
let connectionPromise: Promise<void> | null = null
const pendingRequests = new Map<string, { resolve: (value: any) => void; reject: (error: any) => void }>()

interface ExecutionResult {
  stdout: string
  stderr: string
  images: string[]
  error?: {
    ename: string
    evalue: string
    traceback: string[]
  }
  success: boolean
}

export async function connect(): Promise<void> {
  if (ws && ws.readyState === WebSocket.OPEN) {
    return Promise.resolve()
  }

  if (isConnecting && connectionPromise) {
    return connectionPromise
  }

  isConnecting = true
  connectionPromise = new Promise((resolve, reject) => {
    try {
      ws = new WebSocket(AGENT_URL)

      ws.onopen = () => {
        console.log('[AgentClient] Connected to agent')
        isConnecting = false
        resolve()
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          if (data.type === 'result' && data.run_id) {
            const pending = pendingRequests.get(data.run_id)
            if (pending) {
              pendingRequests.delete(data.run_id)
              pending.resolve(data)
            }
          } else if (data.type === 'restart_result') {
            const pending = pendingRequests.get('restart_' + data.session_id)
            if (pending) {
              pendingRequests.delete('restart_' + data.session_id)
              pending.resolve(data)
            }
          } else if (data.type === 'pong') {
            // Heartbeat response
          }
        } catch (e) {
          console.error('[AgentClient] Error parsing message:', e)
        }
      }

      ws.onerror = (error) => {
        console.error('[AgentClient] WebSocket error:', error)
        isConnecting = false
        reject(error)
      }

      ws.onclose = () => {
        console.log('[AgentClient] Disconnected')
        ws = null
        isConnecting = false
        // Reject all pending requests
        pendingRequests.forEach((pending, key) => {
          pending.reject(new Error('Connection closed'))
          pendingRequests.delete(key)
        })
      }
    } catch (error) {
      isConnecting = false
      reject(error)
    }
  })

  return connectionPromise
}

export async function executeCode(
  code: string,
  sessionId: string = 'default',
  runId?: string,
  timeoutMs: number = 120000
): Promise<ExecutionResult> {
  await connect()

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error('Not connected to agent')
  }

  const actualRunId = runId || `run_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(actualRunId)
      reject(new Error(`Execution timeout after ${timeoutMs}ms`))
    }, timeoutMs)

    pendingRequests.set(actualRunId, {
      resolve: (data) => {
        clearTimeout(timeout)
        resolve({
          stdout: data.stdout || '',
          stderr: data.stderr || '',
          images: data.images || [],
          error: data.error,
          success: data.success !== false
        })
      },
      reject: (error) => {
        clearTimeout(timeout)
        reject(error)
      }
    })

    ws!.send(JSON.stringify({
      type: 'execute',
      code,
      session_id: sessionId,
      run_id: actualRunId
    }))
  })
}

export async function restartKernel(sessionId: string = 'default'): Promise<{ success: boolean; message: string }> {
  await connect()

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error('Not connected to agent')
  }

  const requestId = 'restart_' + sessionId

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId)
      reject(new Error('Restart timeout'))
    }, 30000)

    pendingRequests.set(requestId, {
      resolve: (data) => {
        clearTimeout(timeout)
        resolve({ success: data.success, message: data.message })
      },
      reject: (error) => {
        clearTimeout(timeout)
        reject(error)
      }
    })

    ws!.send(JSON.stringify({
      type: 'restart',
      session_id: sessionId
    }))
  })
}

export function isConnected(): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN
}

export function disconnect(): void {
  if (ws) {
    ws.close()
    ws = null
  }
}

