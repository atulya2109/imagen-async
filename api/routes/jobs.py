from fastapi import APIRouter
from pydantic import BaseModel
import uuid
from api.queue import push_job, set_status, get_status

router = APIRouter()


class JobRequest(BaseModel):
    image_url: str
    instruction: str
    control_mode: str


@router.post("/jobs")
def create_job(request: JobRequest):
    job_id = str(uuid.uuid4())

    job = {
        "job_id": job_id,
        "image_url": request.image_url,
        "instruction": request.instruction,
        "control_mode": request.control_mode,
    }

    set_status(job_id, "queued")
    push_job(job)

    return {"job_id": job_id, "status": "queued"}


@router.get("/jobs/{job_id}")
def get_job(job_id: str):
    status = get_status(job_id)
    if not status:
        return {"error": "job not found"}
    return {"job_id": job_id, "status": status}
