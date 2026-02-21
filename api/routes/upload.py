from fastapi import APIRouter, UploadFile, File
import uuid
import boto3
from botocore.client import Config

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


@router.post("/upload")
async def upload_images(file: UploadFile = File(...)):
    file_id = str(uuid.uuid4())
    filename = f"uploads/{file_id}.jpg"

    s3_client.upload_fileobj(file.file, BUCKET, filename)

    return {"image_url": f"uploads/{file_id}.jpg"}
