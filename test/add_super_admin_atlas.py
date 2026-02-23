from bcrypt import hashpw, gensalt
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
   
async def add_super_admin():
       # Use your Atlas connection string
    ATLAS_URI = "mongodb+srv://GisulAi:gisulaiplatform@cluster0.9s0ro4g.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
       
    client = AsyncIOMotorClient(ATLAS_URI)
    db = client.ai_assessment
       
       # Hash passwords
    password1_hash = hashpw(b"Vijeth@1234", gensalt()).decode('utf-8')
    password2_hash = hashpw(b"Vijeth#12@12", gensalt()).decode('utf-8')
       
       # Insert
    await db.super_admin_credentials.insert_one({
        "name": "Vijeth",
        "email1": "vijeth@gmail.com",
        "password1": password1_hash,
        "email2": "poojaryvijeth239@gmail.com",
        "password2": password2_hash,
        "mfaSecret": None
    })
       
    print("Super admin added!")
    client.close()
   
if __name__ == "__main__":
    asyncio.run(add_super_admin())