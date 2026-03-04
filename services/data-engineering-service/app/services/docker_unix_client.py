"""
Custom Docker client that works with Unix sockets.
This uses raw HTTP over Unix sockets without docker-py.
"""

import json
import socket
import http.client
from typing import Dict, Any, Optional
from urllib.parse import quote


class UnixHTTPConnection(http.client.HTTPConnection):
    """HTTP connection over Unix socket."""
    
    def __init__(self, socket_path):
        super().__init__('localhost')
        self.socket_path = socket_path
    
    def connect(self):
        """Connect to the Unix socket."""
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.connect(self.socket_path)


class DockerUnixClient:
    """Custom Docker client using Unix socket via raw HTTP."""
    
    def __init__(self, socket_path: str = '/var/run/docker.sock'):
        self.socket_path = socket_path
    
    def _request(self, method: str, path: str, body: Optional[bytes] = None, 
                 headers: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """Make an HTTP request over Unix socket."""
        conn = UnixHTTPConnection(self.socket_path)
        
        try:
            request_headers = headers or {}
            if body and 'Content-Type' not in request_headers:
                request_headers['Content-Type'] = 'application/json'
            if body:
                request_headers['Content-Length'] = str(len(body))
            
            conn.request(method, path, body=body, headers=request_headers)
            response = conn.getresponse()
            
            response_data = response.read()
            
            if response.status >= 400:
                raise Exception(f"Docker API error: {response.status} - {response_data.decode('utf-8', errors='replace')}")
            
            if response_data:
                try:
                    return json.loads(response_data.decode('utf-8'))
                except json.JSONDecodeError:
                    return {'raw': response_data.decode('utf-8', errors='replace')}
            return {}
        finally:
            conn.close()
    
    def _request_raw(self, method: str, path: str) -> bytes:
        """Make an HTTP request and return raw bytes."""
        conn = UnixHTTPConnection(self.socket_path)
        
        try:
            conn.request(method, path)
            response = conn.getresponse()
            
            if response.status >= 400:
                raise Exception(f"Docker API error: {response.status}")
            
            return response.read()
        finally:
            conn.close()
    
    def ping(self) -> bool:
        """Ping the Docker daemon."""
        try:
            result = self._request('GET', '/_ping')
            return True
        except Exception:
            return False
    
    def version(self) -> Dict[str, Any]:
        """Get Docker version information."""
        return self._request('GET', '/version')
    
    def inspect_image(self, image_name: str) -> Dict[str, Any]:
        """Inspect an image."""
        return self._request('GET', f'/images/{quote(image_name, safe="")}/json')
    
    def create_container(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Create a container."""
        # The config is in Docker API format, we can pass it directly
        body = json.dumps(config).encode('utf-8')
        return self._request('POST', '/containers/create', body=body)
    
    def start_container(self, container_id: str) -> None:
        """Start a container."""
        self._request('POST', f'/containers/{container_id}/start')
    
    def wait_container(self, container_id: str, timeout: Optional[int] = None) -> Dict[str, Any]:
        """Wait for a container to stop."""
        path = f'/containers/{container_id}/wait'
        return self._request('POST', path)
    
    def get_container_logs(self, container_id: str, stdout: bool = True, stderr: bool = True) -> bytes:
        """Get container logs."""
        path = f'/containers/{container_id}/logs?stdout={1 if stdout else 0}&stderr={1 if stderr else 0}'
        return self._request_raw('GET', path)
    
    def get_container_stats(self, container_id: str, stream: bool = False) -> Dict[str, Any]:
        """Get container stats."""
        path = f'/containers/{container_id}/stats?stream={1 if stream else 0}'
        return self._request('GET', path)
    
    def stop_container(self, container_id: str, timeout: int = 10) -> None:
        """Stop a container."""
        self._request('POST', f'/containers/{container_id}/stop?t={timeout}')
    
    def remove_container(self, container_id: str, force: bool = False) -> None:
        """Remove a container."""
        self._request('DELETE', f'/containers/{container_id}?force={1 if force else 0}')
    
    def inspect_container(self, container_id: str) -> Dict[str, Any]:
        """Inspect a container."""
        return self._request('GET', f'/containers/{container_id}/json')
    
    def create_exec(self, container_id: str, config: Dict[str, Any]) -> str:
        """
        Create an exec instance in a container.
        
        Args:
            container_id: Container ID
            config: Exec configuration with keys like:
                - AttachStdout: bool
                - AttachStderr: bool
                - Cmd: list of command parts
                
        Returns:
            Exec instance ID
        """
        body = json.dumps(config).encode('utf-8')
        result = self._request('POST', f'/containers/{container_id}/exec', body=body)
        return result.get('Id')
    
    def start_exec(self, exec_id: str, detach: bool = False) -> bytes:
        """
        Start an exec instance.
        
        Args:
            exec_id: Exec instance ID
            detach: Whether to detach from the exec
            
        Returns:
            Output from the exec command
        """
        config = {
            'Detach': detach,
            'Tty': False
        }
        body = json.dumps(config).encode('utf-8')
        
        if detach:
            self._request('POST', f'/exec/{exec_id}/start', body=body)
            return b''
        else:
            return self._request_raw('POST', f'/exec/{exec_id}/start')
