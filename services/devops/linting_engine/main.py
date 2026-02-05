from fastapi import FastAPI
from linting_engine.api.lint import router as lint_router
from linting_engine.core.dispatcher import dispatch_lint


app = FastAPI(title="DevOps Linting Engine")
app.include_router(lint_router)
