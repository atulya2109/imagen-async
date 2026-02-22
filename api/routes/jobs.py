from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
import uuid
from api.queue import push_job, set_status, get_status, redis_client
from api.database import get_db
from api.models import Job

router = APIRouter()


class JobRequest(BaseModel):
    image_url: str
    instruction: str
    control_mode: str


@router.post("/jobs")
def create_job(request: JobRequest, db: Session = Depends(get_db)):
    job_id = str(uuid.uuid4())

    job = {
        "job_id": job_id,
        "image_url": request.image_url,
        "instruction": request.instruction,
        "control_mode": request.control_mode,
    }

    db_job = Job(
        job_id=job_id,
        status="queued",
        control_mode=request.control_mode,
        instruction=request.instruction,
        image_url=request.image_url,
    )
    db.add(db_job)
    db.commit()

    set_status(job_id, "queued")
    push_job(job)

    return {"job_id": job_id, "status": "queued"}


@router.get("/jobs/{job_id}")
def get_job(job_id: str, db: Session = Depends(get_db)):
    status = get_status(job_id)
    result_url = redis_client.get(f"job:{job_id}:result_url")

    if status:
        return {"job_id": job_id, "status": status, "result_url": result_url}

    # Fall back to PostgreSQL if not in Redis
    db_job = db.get(Job, job_id)
    if not db_job:
        return {"error": "job not found"}

    return {
        "job_id": db_job.job_id,
        "status": db_job.status,
        "result_url": db_job.result_url,
    }
