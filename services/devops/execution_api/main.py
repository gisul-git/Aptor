from fastapi import FastAPI
from db.mongodb import close_mongo_connection, connect_to_mongo
import logging

# import routers
from api.execute import router as execute_router
from api.terraform import router as terraform_router  # if you have terraform
from api.questions import router as questions_router
from api.cloud_questions import router as cloud_questions_router
from api.tests import router as tests_router
from api.cloud_tests import router as cloud_tests_router
from api.terminal_sessions import router as terminal_sessions_router

app = FastAPI(title="Execution Engine")
logger = logging.getLogger(__name__)

# register routers
app.include_router(execute_router)
app.include_router(terraform_router)
app.include_router(questions_router)
app.include_router(cloud_questions_router)
app.include_router(tests_router)
app.include_router(cloud_tests_router)
app.include_router(terminal_sessions_router)

@app.on_event("startup")
async def startup_event() -> None:
    try:
        await connect_to_mongo()
    except Exception as exc:
        logger.warning("MongoDB not available at startup: %s", exc)


@app.on_event("shutdown")
async def shutdown_event() -> None:
    await close_mongo_connection()


@app.get("/health")
def health():
    return {"status": "ok"}
