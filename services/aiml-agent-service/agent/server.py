"""
WebSocket server for local notebook execution with run_id correlation.

Production-focused implementation with proper logging and timeout handling.
"""

import asyncio
import json
import time
from typing import Dict
import websockets
from websockets.server import WebSocketServerProtocol
from agent.kernel_executor import execute_in_kernel


class AgentServer:
    """WebSocket server for code execution with run_id correlation."""
    
    def __init__(self, host: str = "127.0.0.1", port: int = 8889):
        self.host = host
        self.port = port
    
    async def handle_client(self, websocket: WebSocketServerProtocol):
        """Handle a WebSocket client connection."""
        client_addr = websocket.remote_address
        print(f"[AgentServer] Client connected from {client_addr}")
        
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    msg_type = data.get('type')
                    
                    if msg_type == 'ping':
                        # Handle ping/pong for connection health
                        await websocket.send(json.dumps({
                            'type': 'pong'
                        }))
                        continue
                    
                    elif msg_type == 'interrupt':
                        session_id = data.get('session_id', 'default')
                        print(f"[AgentServer] INTERRUPT session={session_id}")
                        
                        try:
                            from agent.kernel_manager import interrupt_kernel
                            interrupt_kernel(session_id)
                            
                            await websocket.send(json.dumps({
                                'type': 'interrupt_success',
                                'message': 'Kernel execution interrupted'
                            }))
                        except Exception as e:
                            print(f"[AgentServer] Interrupt error: {e}")
                            await websocket.send(json.dumps({
                                'type': 'interrupt_error',
                                'message': str(e)
                            }))
                    
                    elif msg_type == 'restart':
                        session_id = data.get('session_id', 'default')
                        print(f"[AgentServer] RESTART session={session_id}")
                        
                        try:
                            from agent.features.restart_kernel import restart_kernel
                            result = await restart_kernel(session_id)
                            
                            await websocket.send(json.dumps({
                                'type': 'restart_result',
                                'session_id': session_id,
                                'success': result['success'],
                                'message': result['message']
                            }))
                        except Exception as e:
                            print(f"[AgentServer] Restart error: {e}")
                            import traceback
                            traceback.print_exc()
                            await websocket.send(json.dumps({
                                'type': 'restart_result',
                                'session_id': session_id,
                                'success': False,
                                'message': str(e)
                            }))
                    
                    elif msg_type == 'file_upload':
                        session_id = data.get('session_id', 'default')
                        filename = data.get('filename', '')
                        data_base64 = data.get('data_base64', '')
                        print(f"[AgentServer] FILE_UPLOAD session={session_id} filename={filename}")
                        
                        try:
                            from agent.features.file_upload import handle_file_upload
                            result = await handle_file_upload(session_id, filename, data_base64)
                            
                            await websocket.send(json.dumps({
                                'type': 'file_upload_result',
                                'session_id': session_id,
                                'success': result['success'],
                                'path': result.get('path', ''),
                                'message': result.get('message', '')
                            }))
                        except Exception as e:
                            print(f"[AgentServer] File upload error: {e}")
                            await websocket.send(json.dumps({
                                'type': 'file_upload_result',
                                'session_id': session_id,
                                'success': False,
                                'path': '',
                                'message': str(e)
                            }))
                    
                    elif msg_type == 'execute':
                        code = data.get('code', '')
                        session_id = data.get('session_id', 'default')
                        run_id = data.get('run_id')
                        
                        if not run_id:
                            await websocket.send(json.dumps({
                                'type': 'error',
                                'message': 'Missing run_id in execute request'
                            }))
                            continue
                        
                        start_time = time.time()
                        print(f"[AgentServer] EXECUTE run_id={run_id} session={session_id}")
                        
                        # Debug log for run_id
                        print(f"[AgentServer] Received run_id: {run_id}")
                        
                        try:
                            # Execute code (serialized per session, non-blocking)
                            result = await execute_in_kernel(session_id, code, timeout=120)
                            
                            elapsed = time.time() - start_time
                            print(f"[AgentServer] FINISHED run_id={run_id} elapsed={elapsed:.2f}s")
                            
                            # Send response with run_id (echo back the same run_id)
                            print(f"[AgentServer] Sending result with run_id: {run_id}")
                            response = {
                                'type': 'result',
                                'run_id': run_id,  # Echo back the same run_id
                                'stdout': result.get('stdout', ''),
                                'stderr': result.get('stderr', ''),
                                'images': result.get('images', []),
                                'error': result.get('error'),
                                'success': result.get('status') == 'ok'
                            }
                            
                            # If timeout, add to stderr
                            if result.get('status') == 'timeout':
                                response['stderr'] = result.get('stderr', '') + f'\nExecution timeout after 120s'
                                response['success'] = False
                            
                            await websocket.send(json.dumps(response))
                        
                        except Exception as e:
                            import time as time_module  # Use explicit import to avoid scoping issues
                            elapsed = time_module.time() - start_time
                            print(f"[AgentServer] ERROR run_id={run_id} elapsed={elapsed:.2f}s: {e}")
                            
                            print(f"[AgentServer] Sending error result with run_id: {run_id}")
                            await websocket.send(json.dumps({
                                'type': 'result',
                                'run_id': run_id,  # Echo back the same run_id
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
                    
                    else:
                        await websocket.send(json.dumps({
                            'type': 'error',
                            'message': f'Unknown message type: {msg_type}'
                        }))
                
                except json.JSONDecodeError:
                    await websocket.send(json.dumps({
                        'type': 'error',
                        'message': 'Invalid JSON'
                    }))
                except Exception as e:
                    print(f"[AgentServer] Error handling message: {e}")
                    import traceback
                    traceback.print_exc()
        
        except websockets.exceptions.ConnectionClosed:
            print(f"[AgentServer] Client {client_addr} disconnected")
    
    async def start(self):
        """Start the WebSocket server."""
        print(f"[AgentServer] Agent listening on ws://{self.host}:{self.port}")
        print("[AgentServer] Press Ctrl+C to stop")
        
        async def handler(websocket):
            await self.handle_client(websocket)
        
        async with websockets.serve(
            handler,
            self.host,
            self.port,
            ping_interval=20,
            ping_timeout=10
        ):
            try:
                await asyncio.Future()  # Run forever
            except KeyboardInterrupt:
                print("\n[AgentServer] Shutting down...")
                from agent.kernel_manager import shutdown_all_kernels
                await shutdown_all_kernels()

