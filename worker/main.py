import redis
import json
import time
import boto3
from botocore.client import Config
from PIL import Image
import io

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
    result_key = f"results/job_id.jpg"
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG")
    buffer.seek(0)
    s3.upload_fileobj(buffer, BUCKET, result_key)
    return result_key

def process_job(job):
    print(f"Processing job {job['job_id']} with mode {job['control_mode']}")
    time.sleep(5)  # fake processing for now
    print(f"Job {job['job_id']} complete")


def main():
    print("Worker started, waiting for jobs...")
    while True:
        result = redis_client.brpop(["jobs"])
        if result is None:
            continue
        _, job_data = result  # type: ignore
        job = json.loads(job_data)

        redis_client.set(f"job:{job['job_id']}:status", "processing")

        try:
            process_job(job)
            redis_client.set(f"job:{job['job_id']}:status", "completed")
        except Exception as e:
            redis_client.set(f"job:{job['job_id']}:status", "failed")
            print(f"Job failed: {e}")


if __name__ == "__main__":
    main()
