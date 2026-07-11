from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import jobs, upload
from api.routes.upload import ensure_bucket_exists
from api.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    ensure_bucket_exists()
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router)
app.include_router(jobs.router)


@app.get("/health")
def health():
    return {"status": "ok"}
