from fastapi import FastAPI

# import routers
from api.execute import router as execute_router
from api.terraform import router as terraform_router  # if you have terraform

app = FastAPI(title="Execution Engine")

# register routers
app.include_router(execute_router)
app.include_router(terraform_router)

@app.get("/health")
def health():
    return {"status": "ok"}
