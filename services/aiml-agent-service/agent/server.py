"""
WebSocket server for code execution with validation, logging, and error handling.
"""

import asyncio
import json
import time
import sys
import logging
from typing import Dict, Optional
import websockets
from websockets.server import WebSocketServerProtocol
from websockets.exceptions import InvalidMessage, InvalidUpgrade, ConnectionClosed
from agent.kernel_executor import execute_in_kernel
from agent.config import Config
from agent.validators import (
    validate_session_id, validate_run_id, validate_code, 
    ValidationError
)
from agent.security import validate_code_security, SecurityError
from agent.metrics import get_metrics
from agent.queue_manager import get_queue, QueueFullError, QueueTimeoutError
from agent.kernel_manager import (
    start_background_tasks, stop_background_tasks,
    get_kernel_count, get_healthy_kernel_count
)

# Configure logging
logger = logging.getLogger(__name__)


class HealthCheckFilter(logging.Filter):
    """Filter to suppress expected health check errors from WebSocket server."""
    
    def filter(self, record):
        message = record.getMessage()
        message_lower = message.lower()
        
        # Check error level messages
        if record.levelno == logging.ERROR:
            health_check_keywords = [
                'did not receive a valid http request',
                'connection closed while reading http request',
                'connection closed while reading http request line',
                'missing connection header',
                'invalid upgrade',
                'stream ends after',
                'opening handshake failed',
                'eoferror',
                'connection closed',
                'invalidmessage',
                'invalidupgrade',
                'eoferror: stream ends after',
                'eoferror: connection closed',
                'the above exception was the direct cause',
                'traceback (most recent call last)',
                'file "/usr/local/lib/python3',
                'websockets.server',
                'websockets.http11',
                'websockets.asyncio',
                'websockets.streams',
                'parse',
                'handshake'
            ]
            
            if any(keyword in message_lower for keyword in health_check_keywords):
                return False
        
        # Check exception types in exc_info
        if hasattr(record, 'exc_info') and record.exc_info:
            exc_type = record.exc_info[0]
            if exc_type:
                exc_name = str(exc_type.__name__).lower()
                if any(name in exc_name for name in [
                    'eof', 'invalidmessage', 'invalidupgrade', 'connectionclosed', 'eoferror'
                ]):
                    return False
                
                # Also check exception message
                if hasattr(record.exc_info[1], '__str__'):
                    exc_msg = str(record.exc_info[1]).lower()
                    if any(keyword in exc_msg for keyword in [
                        'did not receive a valid http request',
                        'connection closed while reading',
                        'stream ends after',
                        'invalid upgrade'
                    ]):
                        return False
        
        return True


class AgentServer:
    """WebSocket server for code execution with validation and error handling."""
    
    def __init__(self, host: str = None, port: int = None):
        self.host = host or Config.HOST
        self.port = port or Config.PORT
        self.active_connections = 0
        self.metrics = get_metrics()
        self.queue = get_queue()
    
    async def handle_client(self, websocket: WebSocketServerProtocol):
        """Handle a WebSocket client connection with timeout and limits."""
        client_addr = websocket.remote_address
        logger.info(f"Client connected from {client_addr}")
        self.active_connections += 1
        self.metrics.increment('connections.total')
        self.metrics.gauge('connections.active', self.active_connections)
        
        connection_start = time.time()
        
        try:
            # Set connection timeout
            async with asyncio.timeout(Config.CONNECTION_TIMEOUT):
                async for message in websocket:
                    # Check message size
                    if len(message) > Config.MAX_MESSAGE_SIZE:
                        logger.warning(f"Message too large: {len(message)} bytes")
                        await websocket.send(json.dumps({
                            'type': 'error',
                            'message': f'Message too large (max {Config.MAX_MESSAGE_SIZE} bytes)'
                        }))
                        continue
                    
                    # Process message with timeout
                    try:
                        async with asyncio.timeout(30):  # 30s per message
                            await self._handle_message(websocket, message, client_addr)
                    except asyncio.TimeoutError:
                        logger.error(f"Message processing timeout for {client_addr}")
                        await websocket.send(json.dumps({
                            'type': 'error',
                            'message': 'Message processing timeout'
                        }))
                    except Exception as e:
                        logger.error(f"Error processing message: {e}", exc_info=True)
                        await websocket.send(json.dumps({
                            'type': 'error',
                            'message': f'Internal error: {str(e)}'
                        }))
        
        except asyncio.TimeoutError:
            logger.info(f"Connection timeout for {client_addr}")
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"Client {client_addr} disconnected")
        except Exception as e:
            logger.error(f"Connection error for {client_addr}: {e}", exc_info=True)
        finally:
            self.active_connections -= 1
            self.metrics.gauge('connections.active', self.active_connections)
            connection_duration = time.time() - connection_start
            self.metrics.histogram('connections.duration', connection_duration)
            logger.info(f"Client {client_addr} disconnected (duration: {connection_duration:.2f}s)")
    
    async def _handle_message(self, websocket: WebSocketServerProtocol, message: str, client_addr: tuple):
        """Handle a single WebSocket message."""
        try:
            data = json.loads(message)
        except json.JSONDecodeError as e:
            logger.warning(f"Invalid JSON from {client_addr}: {e}")
            await websocket.send(json.dumps({
                'type': 'error',
                'message': 'Invalid JSON'
            }))
            return
        
        msg_type = data.get('type')
        
        if msg_type == 'ping':
            await websocket.send(json.dumps({'type': 'pong'}))
            return
        
        elif msg_type == 'interrupt':
            await self._handle_interrupt(websocket, data)
        
        elif msg_type == 'restart':
            await self._handle_restart(websocket, data)
        
        elif msg_type == 'file_upload':
            await self._handle_file_upload(websocket, data)
        
        elif msg_type == 'execute':
            await self._handle_execute(websocket, data)
        
        else:
            logger.warning(f"Unknown message type: {msg_type}")
            await websocket.send(json.dumps({
                'type': 'error',
                'message': f'Unknown message type: {msg_type}'
            }))
    
    async def _handle_interrupt(self, websocket: WebSocketServerProtocol, data: Dict):
        """Handle interrupt request."""
        try:
            session_id = data.get('session_id', 'default')
            validate_session_id(session_id)
            
            from agent.kernel_manager import interrupt_kernel
            interrupt_kernel(session_id)
            
            await websocket.send(json.dumps({
                'type': 'interrupt_success',
                'message': 'Kernel execution interrupted'
            }))
            self.metrics.increment('operations.interrupt', tags={'session_id': session_id})
        except ValidationError as e:
            logger.warning(f"Invalid session_id in interrupt: {e}")
            await websocket.send(json.dumps({
                'type': 'interrupt_error',
                'message': str(e)
            }))
        except Exception as e:
            logger.error(f"Interrupt error: {e}", exc_info=True)
            await websocket.send(json.dumps({
                'type': 'interrupt_error',
                'message': str(e)
            }))
    
    async def _handle_restart(self, websocket: WebSocketServerProtocol, data: Dict):
        """Handle restart request."""
        try:
            session_id = data.get('session_id', 'default')
            validate_session_id(session_id)
            
            from agent.features.restart_kernel import restart_kernel
            result = await restart_kernel(session_id)
            
            await websocket.send(json.dumps({
                'type': 'restart_result',
                'session_id': session_id,
                'success': result['success'],
                'message': result['message']
            }))
            self.metrics.increment('operations.restart', tags={'session_id': session_id, 'success': str(result['success'])})
        except ValidationError as e:
            logger.warning(f"Invalid session_id in restart: {e}")
            await websocket.send(json.dumps({
                'type': 'restart_result',
                'session_id': data.get('session_id', 'default'),
                'success': False,
                'message': str(e)
            }))
        except Exception as e:
            logger.error(f"Restart error: {e}", exc_info=True)
            await websocket.send(json.dumps({
                'type': 'restart_result',
                'session_id': data.get('session_id', 'default'),
                'success': False,
                'message': str(e)
            }))
    
    async def _handle_file_upload(self, websocket: WebSocketServerProtocol, data: Dict):
        """Handle file upload request."""
        try:
            session_id = data.get('session_id', 'default')
            filename = data.get('filename', '')
            data_base64 = data.get('data_base64', '')
            
            validate_session_id(session_id)
            
            from agent.features.file_upload import handle_file_upload
            result = await handle_file_upload(session_id, filename, data_base64)
            
            await websocket.send(json.dumps({
                'type': 'file_upload_result',
                'session_id': session_id,
                'success': result['success'],
                'path': result.get('path', ''),
                'message': result.get('message', '')
            }))
            self.metrics.increment('operations.file_upload', tags={'session_id': session_id, 'success': str(result['success'])})
        except ValidationError as e:
            logger.warning(f"Validation error in file upload: {e}")
            await websocket.send(json.dumps({
                'type': 'file_upload_result',
                'session_id': data.get('session_id', 'default'),
                'success': False,
                'path': '',
                'message': str(e)
            }))
        except Exception as e:
            logger.error(f"File upload error: {e}", exc_info=True)
            await websocket.send(json.dumps({
                'type': 'file_upload_result',
                'session_id': data.get('session_id', 'default'),
                'success': False,
                'path': '',
                'message': str(e)
            }))
    
    async def _handle_execute(self, websocket: WebSocketServerProtocol, data: Dict):
        """Handle execute request with validation and queuing."""
        start_time = time.time()
        run_id = None
        session_id = None
        
        try:
            # Validate inputs
            code = data.get('code', '')
            session_id = data.get('session_id', 'default')
            run_id = data.get('run_id')
            
            # Validate session_id
            validate_session_id(session_id)
            
            # Validate run_id
            if not run_id:
                raise ValidationError("Missing run_id in execute request")
            validate_run_id(run_id)
            
            # Validate code
            is_valid, error_msg = validate_code(code)
            if not is_valid:
                raise ValidationError(error_msg)
            
            # Security check
            is_safe, security_error = validate_code_security(code)
            if not is_safe:
                raise SecurityError(security_error)
            
            logger.info(f"EXECUTE run_id={run_id} session={session_id} code_size={len(code)}")
            self.metrics.increment('executions.requested', tags={'session_id': session_id})
            
            # Queue execution
            async def execute_fn():
                return await execute_in_kernel(session_id, code, timeout=Config.EXECUTION_TIMEOUT)
            
            try:
                result = await self.queue.enqueue(session_id, run_id, execute_fn)
            except QueueFullError:
                logger.warning(f"Queue full for session {session_id}")
                await websocket.send(json.dumps({
                    'type': 'result',
                    'run_id': run_id,
                    'stdout': '',
                    'stderr': 'Execution queue is full. Please try again later.',
                    'images': [],
                    'error': {
                        'ename': 'QueueFullError',
                        'evalue': 'Execution queue is full',
                        'traceback': []
                    },
                    'success': False
                }))
                return
            except QueueTimeoutError:
                logger.warning(f"Queue timeout for session {session_id}")
                await websocket.send(json.dumps({
                    'type': 'result',
                    'run_id': run_id,
                    'stdout': '',
                    'stderr': 'Execution queue timeout. Please try again.',
                    'images': [],
                    'error': {
                        'ename': 'QueueTimeoutError',
                        'evalue': 'Execution queue timeout',
                        'traceback': []
                    },
                    'success': False
                }))
                return
            
            elapsed = time.time() - start_time
            logger.info(f"FINISHED run_id={run_id} elapsed={elapsed:.2f}s")
            
            # Send response
            response = {
                'type': 'result',
                'run_id': run_id,
                'stdout': result.get('stdout', ''),
                'stderr': result.get('stderr', ''),
                'images': result.get('images', []),
                'error': result.get('error'),
                'success': result.get('status') == 'ok'
            }
            
            if result.get('status') == 'timeout':
                response['stderr'] = result.get('stderr', '') + f'\nExecution timeout after {Config.EXECUTION_TIMEOUT}s'
                response['success'] = False
            
            await websocket.send(json.dumps(response))
        
        except ValidationError as e:
            logger.warning(f"Validation error: {e}")
            await websocket.send(json.dumps({
                'type': 'result',
                'run_id': run_id or 'unknown',
                'stdout': '',
                'stderr': f'Validation error: {str(e)}',
                'images': [],
                'error': {
                    'ename': 'ValidationError',
                    'evalue': str(e),
                    'traceback': []
                },
                'success': False
            }))
        except SecurityError as e:
            logger.warning(f"Security error: {e}")
            await websocket.send(json.dumps({
                'type': 'result',
                'run_id': run_id or 'unknown',
                'stdout': '',
                'stderr': f'Security error: {str(e)}',
                'images': [],
                'error': {
                    'ename': 'SecurityError',
                    'evalue': str(e),
                    'traceback': []
                },
                'success': False
            }))
        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(f"ERROR run_id={run_id} elapsed={elapsed:.2f}s: {e}", exc_info=True)
            await websocket.send(json.dumps({
                'type': 'result',
                'run_id': run_id or 'unknown',
                'stdout': '',
                'stderr': f'Execution error: {str(e)}',
                'images': [],
                'error': {
                    'ename': type(e).__name__,
                    'evalue': str(e),
                    'traceback': []
                },
                'success': False
            }))
    
    async def start(self):
        """Start the WebSocket server."""
        logger.info(f"Agent listening on ws://{self.host}:{self.port}")
        
        # Start background tasks
        start_background_tasks()
        
        # Start queue processor
        queue_task = asyncio.create_task(self.queue.process_queue())
        
        # Suppress expected errors from health checks
        health_check_filter = HealthCheckFilter()
        
        # Apply filter to all websockets loggers
        for logger_name in ["websockets", "websockets.server", "websockets.asyncio", "websockets.http11", "websockets.streams"]:
            ws_logger = logging.getLogger(logger_name)
            ws_logger.addFilter(health_check_filter)
            ws_logger.setLevel(logging.WARNING)
        
        # Also apply to root logger to catch any unhandled websocket errors
        root_logger = logging.getLogger()
        root_logger.addFilter(health_check_filter)
        
        async def handler(websocket, path=None):
            try:
                # Check connection limit
                if self.active_connections >= Config.MAX_CONNECTIONS:
                    logger.warning(f"Connection limit reached: {self.active_connections}")
                    await websocket.close(code=1008, reason="Connection limit reached")
                    return
                
                await self.handle_client(websocket)
            except (InvalidMessage, InvalidUpgrade, ConnectionClosed, EOFError) as e:
                # Silently ignore health check errors - these are expected when Azure sends HTTP to WebSocket port
                pass
            except Exception as e:
                # Log unexpected errors but suppress health check related ones
                error_msg = str(e).lower()
                if not any(keyword in error_msg for keyword in [
                    'did not receive a valid http request',
                    'connection closed while reading http request',
                    'invalid upgrade',
                    'stream ends after',
                    'eoferror',
                    'invalidmessage',
                    'invalidupgrade'
                ]):
                    logger.error(f"Unexpected error in WebSocket handler: {e}", exc_info=True)
        
        # Wrap websockets.serve to catch and suppress health check errors
        try:
            async with websockets.serve(
                handler,
                self.host,
                self.port,
                ping_interval=20,
                ping_timeout=10,
                max_size=Config.MAX_MESSAGE_SIZE
            ):
                try:
                    await asyncio.Future()  # Run forever
                except KeyboardInterrupt:
                    logger.info("\nShutting down...")
                    queue_task.cancel()
                    stop_background_tasks()
                    from agent.kernel_manager import shutdown_all_kernels
                    await shutdown_all_kernels()
        except (InvalidMessage, InvalidUpgrade, ConnectionClosed, EOFError) as e:
            # Suppress health check errors at server level
            logger.debug(f"Suppressed health check error: {type(e).__name__}")
            raise  # Re-raise to let asyncio handle it
