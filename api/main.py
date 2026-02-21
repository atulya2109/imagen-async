from fastapi import FastAPI
from api.routes import jobs, upload

app = FastAPI()

app.include_router(upload.router)
app.include_router(jobs.router)


@app.get("/health")
def health():
    return {"status": "ok"}
