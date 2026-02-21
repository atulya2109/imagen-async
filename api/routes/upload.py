from fastapi import APIRouter, UploadFile, File
import uuid
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

router = APIRouter()

s3_client = boto3.client(
    "s3",
    endpoint_url="http://localhost:9000",
    aws_access_key_id="minioadmin",
    aws_secret_access_key="minioadmin",
    config=Config(signature_version="s3v4"),
    region_name="us-east-1",
)

BUCKET = "images"


def ensure_bucket_exists() -> None:
    try:
        s3_client.head_bucket(Bucket=BUCKET)
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code") if e.response else None
        if error_code == "404":
            s3_client.create_bucket(Bucket=BUCKET)
        else:
            raise


ensure_bucket_exists()


@router.post("/upload")
async def upload_images(file: UploadFile = File(...)) -> dict[str, str]:
    file_id = str(uuid.uuid4())
    filename = f"uploads/{file_id}.jpg"

    s3_client.upload_fileobj(file.file, BUCKET, filename)

    return {"image_url": f"uploads/{file_id}.jpg"}
