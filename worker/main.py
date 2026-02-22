import redis
import json
import boto3
from botocore.client import Config
from PIL import Image
import io
from datetime import datetime
from worker.pipelines.canny import run as run_canny
from worker.pipelines.openpose import run as run_openpose
from worker.pipelines.depth import run as run_depth
from api.database import SessionLocal
from api.models import Job

redis_client = redis.Redis(host="localhost", port=6379, decode_responses=True)
s3 = boto3.client(
    "s3",
    endpoint_url="http://localhost:9000",
    aws_access_key_id="minioadmin",
    aws_secret_access_key="minioadmin",
    config=Config(signature_version="s3v4"),
    region_name="us-east-1"
)

BUCKET = "images"

def download_image(image_url: str) -> Image.Image:
    response = s3.get_object(Bucket=BUCKET, Key=image_url)
    image_bytes = response["Body"].read()
    return Image.open(io.BytesIO(image_bytes)).convert("RGB")

def upload_image(image: Image.Image, job_id) -> str:
    result_key = f"results/{job_id}.jpg"
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG")
    buffer.seek(0)
    s3.upload_fileobj(buffer, BUCKET, result_key)
    return result_key

def process_job(job):
    print(f"Downloading image for job {job['job_id']}")
    image = download_image(job["image_url"])

    print(f"Running {job['control_mode']} pipeline")
    if job["control_mode"] == "canny":
        result = run_canny(image, job["instruction"])
    elif job["control_mode"] == "openpose":
        result = run_openpose(image, job["instruction"])
    elif job["control_mode"] == "depth":
        result = run_depth(image, job["instruction"])
    else:
        raise ValueError(f"Unsupported control mode: {job['control_mode']}")

    print(f"Uploading result for job {job['job_id']}")
    result_url = upload_image(result, job["job_id"])

    redis_client.set(f"job:{job['job_id']}:result_url", result_url)
    print(f"Job {job['job_id']} complete, result at {result_url}")
    return result_url


def main():
    print("Worker started, waiting for jobs...")
    while True:
        result = redis_client.brpop(["jobs"])
        if result is None:
            continue
        _, job_data = result  # type: ignore
        job = json.loads(job_data)
        job_id = job["job_id"]

        redis_client.set(f"job:{job_id}:status", "processing")
        with SessionLocal() as db:
            job_row = db.get(Job, job_id)
            if job_row:
                job_row.status = "processing"
                db.commit()

        try:
            result_url = process_job(job)
            redis_client.set(f"job:{job_id}:status", "completed")
            with SessionLocal() as db:
                job_row = db.get(Job, job_id)
                if job_row:
                    job_row.status = "completed"
                    job_row.result_url = result_url
                    job_row.completed_at = datetime.utcnow()
                    db.commit()
        except Exception as e:
            redis_client.set(f"job:{job_id}:status", "failed")
            with SessionLocal() as db:
                job_row = db.get(Job, job_id)
                if job_row:
                    job_row.status = "failed"
                    job_row.completed_at = datetime.utcnow()
                    db.commit()
            print(f"Job failed: {e}")


if __name__ == "__main__":
    main()
