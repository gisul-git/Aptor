import httpx
import asyncio

async def test():
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get('http://aptor-penpot-backend-1:6060/')
            print(f'✅ Connection successful! Status: {resp.status_code}')
    except Exception as e:
        print(f'❌ Connection failed: {e}')

asyncio.run(test())
