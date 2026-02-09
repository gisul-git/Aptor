"""
Transit Format Helper for Penpot API Integration

This module provides utilities for encoding/decoding Transit format
used by Penpot's RPC API.

Custom implementation compatible with Python 3.11+
"""

import json
import logging
from typing import Any, Dict, Optional
import uuid

logger = logging.getLogger(__name__)

# Transit format is available with our custom implementation
TRANSIT_AVAILABLE = True


class TransitEncoder:
    """
    Encode Python objects to Transit JSON format for Penpot API
    
    Custom implementation compatible with Python 3.11+
    Transit JSON format uses special markers:
    - Maps: ["^ ", "key1", "value1", "key2", "value2", ...]
    - Keywords: "~:keyword"
    - UUIDs: "~uxxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    """
    
    def __init__(self, protocol="json"):
        """Initialize Transit encoder (only JSON protocol supported)"""
        self.protocol = protocol
    
    def _encode_value(self, value: Any) -> Any:
        """Encode a single value to Transit format"""
        if isinstance(value, dict):
            return self._encode_map(value)
        elif isinstance(value, uuid.UUID):
            return f"~u{str(value)}"
        elif isinstance(value, bool):
            return value
        elif isinstance(value, (int, float, str)):
            return value
        elif value is None:
            return None
        else:
            return str(value)
    
    def _encode_map(self, data: Dict[str, Any]) -> list:
        """
        Encode a Python dict to Transit map format
        
        Transit maps are encoded as: ["^ ", "key1", "value1", "key2", "value2", ...]
        Keys with hyphens are treated as keywords and prefixed with ~:
        """
        result = ["^ "]
        for key, value in data.items():
            # Convert Python keys to Transit keywords
            if "-" in key or key in ["id", "name", "email", "password", "project-id", "is-shared"]:
                transit_key = f"~:{key}"
            else:
                transit_key = key
            
            result.append(transit_key)
            result.append(self._encode_value(value))
        
        return result
    
    def encode(self, data: Dict[str, Any]) -> bytes:
        """
        Encode Python dict to Transit JSON bytes
        
        Args:
            data: Python dictionary to encode
            
        Returns:
            Transit-encoded JSON bytes
        """
        try:
            transit_data = self._encode_map(data)
            json_str = json.dumps(transit_data, separators=(',', ':'))
            return json_str.encode('utf-8')
        except Exception as e:
            logger.error(f"Transit encoding failed: {e}")
            raise
    
    def encode_to_string(self, data: Dict[str, Any]) -> str:
        """
        Encode Python dict to Transit JSON string
        
        Args:
            data: Python dictionary to encode
            
        Returns:
            Transit-encoded JSON string
        """
        return self.encode(data).decode('utf-8')


class TransitDecoder:
    """
    Decode Transit JSON format from Penpot API to Python objects
    
    Custom implementation compatible with Python 3.11+
    """
    
    def __init__(self, protocol="json"):
        """Initialize Transit decoder (only JSON protocol supported)"""
        self.protocol = protocol
    
    def _decode_value(self, value: Any) -> Any:
        """Decode a single Transit value"""
        if isinstance(value, str):
            # Handle Transit UUID format
            if value.startswith('~u'):
                return value[2:]  # Remove ~u prefix
            # Handle Transit keyword format
            elif value.startswith('~:'):
                return value[2:]  # Remove ~: prefix
            return value
        elif isinstance(value, list):
            # Check if it's a Transit map
            if len(value) > 0 and value[0] == "^ ":
                return self._decode_map(value)
            return [self._decode_value(v) for v in value]
        else:
            return value
    
    def _decode_map(self, transit_list: list) -> Dict[str, Any]:
        """
        Decode a Transit map to Python dict
        
        Transit maps are: ["^ ", "key1", "value1", "key2", "value2", ...]
        """
        result = {}
        # Skip the first element ("^ ")
        items = transit_list[1:]
        
        # Process pairs of key-value
        for i in range(0, len(items), 2):
            if i + 1 < len(items):
                key = items[i]
                value = items[i + 1]
                
                # Clean up Transit keyword format
                if isinstance(key, str) and key.startswith('~:'):
                    key = key[2:]
                
                result[key] = self._decode_value(value)
        
        return result
    
    def decode(self, data: bytes) -> Any:
        """
        Decode Transit JSON bytes to Python object
        
        Args:
            data: Transit-encoded JSON bytes
            
        Returns:
            Decoded Python object
        """
        try:
            json_str = data.decode('utf-8')
            transit_data = json.loads(json_str)
            return self._decode_value(transit_data)
        except Exception as e:
            logger.error(f"Transit decoding failed: {e}")
            raise
    
    def decode_from_string(self, data: str) -> Any:
        """
        Decode Transit JSON string to Python object
        
        Args:
            data: Transit-encoded JSON string
            
        Returns:
            Decoded Python object
        """
        return self.decode(data.encode('utf-8'))


class PenpotTransitHelper:
    """
    High-level helper for Penpot-specific Transit operations
    
    Handles common Penpot API patterns like:
    - Converting Python dicts to Transit format
    - Extracting IDs from Transit responses
    - Handling Penpot-specific data types (UUIDs, keywords, etc.)
    """
    
    def __init__(self):
        self.encoder = TransitEncoder(protocol="json")
        self.decoder = TransitDecoder(protocol="json")
    
    def encode_rpc_request(self, params: Dict[str, Any]) -> str:
        """
        Encode RPC request parameters to Transit JSON
        
        Args:
            params: Request parameters (e.g., {"project-id": "...", "name": "..."})
            
        Returns:
            Transit-encoded JSON string
        """
        return self.encoder.encode_to_string(params)
    
    def decode_rpc_response(self, response_data: bytes) -> Any:
        """
        Decode RPC response from Transit JSON
        
        Args:
            response_data: Transit-encoded response bytes
            
        Returns:
            Decoded Python object
        """
        return self.decoder.decode(response_data)
    
    def extract_id(self, transit_data: Any, key: str = "id") -> Optional[str]:
        """
        Extract ID from Transit response
        
        Penpot returns IDs in various formats:
        - As dict: {"id": "uuid-string"}
        - As Transit list: ["^ ", "~:id", "uuid-string"]
        - With UUID prefix: "~u" + uuid
        
        Args:
            transit_data: Decoded Transit data
            key: Key to extract (default: "id")
            
        Returns:
            Extracted ID string or None
        """
        try:
            # Case 1: Simple dict
            if isinstance(transit_data, dict):
                value = transit_data.get(key) or transit_data.get(f":{key}")
                if value:
                    return self._clean_uuid(value)
            
            # Case 2: Transit list format ["^ ", "~:key", "value", ...]
            if isinstance(transit_data, list):
                for i in range(len(transit_data) - 1):
                    if isinstance(transit_data[i], str):
                        # Check for keyword format
                        if transit_data[i] == f"~:{key}" or transit_data[i] == f":{key}":
                            value = transit_data[i + 1]
                            return self._clean_uuid(value)
            
            logger.warning(f"Could not extract '{key}' from Transit data")
            return None
            
        except Exception as e:
            logger.error(f"Error extracting ID: {e}")
            return None
    
    def _clean_uuid(self, value: Any) -> str:
        """
        Clean UUID value from Transit format
        
        Transit may prefix UUIDs with "~u"
        """
        if isinstance(value, str):
            # Remove Transit UUID prefix
            if value.startswith('~u'):
                return value[2:]
            return value
        
        # Handle UUID objects
        if isinstance(value, uuid.UUID):
            return str(value)
        
        return str(value)
    
    def prepare_create_file_request(
        self,
        project_id: str,
        file_name: str,
        is_shared: bool = False
    ) -> str:
        """
        Prepare create-file RPC request
        
        Args:
            project_id: Penpot project ID
            file_name: Name for the new file
            is_shared: Whether file is shared
            
        Returns:
            Transit-encoded request body
        """
        params = {
            "project-id": project_id,
            "name": file_name,
            "is-shared": is_shared
        }
        return self.encode_rpc_request(params)
    
    def prepare_login_request(self, email: str, password: str) -> str:
        """
        Prepare login-with-password RPC request
        
        Args:
            email: User email
            password: User password
            
        Returns:
            Transit-encoded request body
        """
        params = {
            "email": email,
            "password": password
        }
        return self.encode_rpc_request(params)


# Singleton instance
transit_helper = PenpotTransitHelper() if TRANSIT_AVAILABLE else None


def get_transit_helper() -> Optional[PenpotTransitHelper]:
    """Get the Transit helper singleton"""
    if not TRANSIT_AVAILABLE:
        logger.error("Transit helper not available. Install transit-python.")
        return None
    return transit_helper
