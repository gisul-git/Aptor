import httpx
import os
import base64
from dotenv import load_dotenv
from typing import Dict, Any, Optional

load_dotenv()

# Judge0 URL from environment
JUDGE0_URL = os.getenv("JUDGE0_URL", "http://localhost:2358")

# DSA (Data Structures & Algorithms) Language ID mapping
# These are commonly used languages for competitive programming and DSA
LANGUAGE_IDS = {
    "python": 71,
    "javascript": 63,
    "cpp": 54,
    "java": 62,
    "c": 50,           # C - very common for DSA
    "go": 60,          # Go - growing in popularity for DSA
    "rust": 73,        # Rust - modern systems language, good for DSA
    "csharp": 51,      # C# - used in some DSA contexts
    "kotlin": 78,      # Kotlin - Android development, DSA
    "typescript": 74,  # TypeScript - JavaScript with types, good for DSA
}

# Reverse mapping for getting language name from ID
LANGUAGE_NAMES = {v: k for k, v in LANGUAGE_IDS.items()}


async def check_judge0_health() -> bool:
    """
    Check if Judge0 is accessible and healthy
    
    Returns:
        True if Judge0 is accessible, False otherwise
    """
    try:
        health_url = f"{JUDGE0_URL}/about"
        timeout_config = httpx.Timeout(connect=5.0, read=10.0)
        
        async with httpx.AsyncClient(timeout=timeout_config) as client:
            response = await client.get(health_url)
            return response.status_code == 200
    except:
        return False


async def execute_code(
    source_code: str,
    language_id: int,
    stdin: str = "",
    timeout: float = 60.0,
    max_retries: int = 2
) -> Dict[str, Any]:
    """
    Execute code using Judge0 API with retry logic
    
    Args:
        source_code: The source code to execute
        language_id: Judge0 language ID (71=Python, 63=JavaScript, 54=C++, 62=Java)
        stdin: Standard input for the program
        timeout: Request timeout in seconds (increased to 60s for Docker Judge0)
        max_retries: Maximum number of retry attempts
    
    Returns:
        Raw Judge0 JSON response with all fields including:
        - stdout
        - stderr
        - compile_output
        - status (with id and description)
        - time
        - memory
        - etc.
    
    Raises:
        Exception: If Judge0 API call fails or times out
    """
    url = f"{JUDGE0_URL}/submissions?wait=true"
    
    payload = {
        "source_code": source_code,
        "language_id": language_id,
        "stdin": stdin,
    }
    
    headers = {
        "Content-Type": "application/json",
    }
    
    last_error = None
    
    for attempt in range(max_retries + 1):
        try:
            # Use a longer timeout for Docker Judge0 which may need more time
            # Set connect timeout to 15s and read timeout to 60s
            timeout_config = httpx.Timeout(
                connect=15.0, 
                read=timeout, 
                write=15.0, 
                pool=15.0
            )
            
            # Create client with limits to handle connection issues
            limits = httpx.Limits(
                max_keepalive_connections=5,
                max_connections=10,
                keepalive_expiry=30.0
            )
            
            async with httpx.AsyncClient(
                timeout=timeout_config, 
                follow_redirects=True,
                limits=limits
            ) as client:
                response = await client.post(
                    url,
                    json=payload,
                    headers=headers
                )
                
                if response.status_code != 201:
                    error_text = response.text[:500] if response.text else "No error message"
                    raise Exception(
                        f"Judge0 API error (status {response.status_code}): {error_text}"
                    )
                
                # Get raw Judge0 response
                result = response.json()
                
                # Decode base64 fields if present
                for field in ["stdout", "stderr", "compile_output", "message"]:
                    if field in result and result[field]:
                        try:
                            # Try to decode if it's base64
                            decoded = base64.b64decode(result[field]).decode('utf-8')
                            result[field] = decoded
                        except:
                            # If decoding fails, keep original value
                            pass
                
                return result
                
        except httpx.TimeoutException as e:
            last_error = f"Judge0 API request timed out after {timeout}s (attempt {attempt + 1}/{max_retries + 1}). Judge0 may be starting up or processing."
            if attempt < max_retries:
                import asyncio
                await asyncio.sleep(2)  # Wait 2 seconds before retry
                continue
            raise Exception(last_error)
            
        except httpx.ConnectError as e:
            last_error = f"Cannot connect to Judge0 at {JUDGE0_URL}. Make sure Judge0 is running and accessible. Error: {str(e)}"
            if attempt < max_retries:
                import asyncio
                await asyncio.sleep(2)
                continue
            raise Exception(last_error)
            
        except httpx.ReadError as e:
            last_error = f"Judge0 connection was closed unexpectedly (attempt {attempt + 1}/{max_retries + 1}). This may happen if Judge0 is still starting up. Error: {str(e)}"
            if attempt < max_retries:
                import asyncio
                await asyncio.sleep(3)  # Wait longer for connection errors
                continue
            raise Exception(last_error)
            
        except httpx.RequestError as e:
            last_error = f"Judge0 API request failed (attempt {attempt + 1}/{max_retries + 1}): {str(e)}. Check if Judge0 is running at {JUDGE0_URL}"
            if attempt < max_retries:
                import asyncio
                await asyncio.sleep(2)
                continue
            raise Exception(last_error)
            
        except Exception as e:
            # For other exceptions, don't retry
            raise Exception(f"Error executing code: {str(e)}")
    
    # If we get here, all retries failed
    raise Exception(f"Judge0 API request failed after {max_retries + 1} attempts. Last error: {last_error}")


def get_language_id(language: str) -> Optional[int]:
    """
    Get Judge0 language ID from language name
    
    Args:
        language: Language name (python, javascript, cpp, java)
    
    Returns:
        Language ID or None if not found
    """
    return LANGUAGE_IDS.get(language.lower())


def get_language_name(language_id: int) -> Optional[str]:
    """
    Get language name from Judge0 language ID
    
    Args:
        language_id: Judge0 language ID
    
    Returns:
        Language name or None if not found
    """
    return LANGUAGE_NAMES.get(language_id)

