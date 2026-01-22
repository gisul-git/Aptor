/**
 * Agent Client - Re-exports from aimlAgentClient for compatibility
 * This file provides a unified interface for the AIML editor components
 */

export {
  connect,
  executeCode,
  interruptKernel,
  restartKernel,
  isConnected,
  disconnect,
  resetConnectionState,
  isAgentUnavailable,
} from './aimlAgentClient'

