from fastapi import FastAPI
from api.routes import jobs, upload
from api.database import init_db

app = FastAPI()

init_db()

app.include_router(upload.router)
app.include_router(jobs.router)


@app.get("/health")
def health():
    return {"status": "ok"}
