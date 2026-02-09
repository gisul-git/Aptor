from fastapi import FastAPI
from api.execute import router as execute_router

app = FastAPI(title="NSJail Execution Engine")

app.include_router(execute_router)
git push -u origin devops/sumukh/testing
