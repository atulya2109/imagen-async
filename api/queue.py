import redis
import json

redis_client = redis.Redis(host="localhost", port=6379, decode_responses=True)


def push_job(job: dict):
    redis_client.lpush("jobs", json.dumps(job))


def set_status(job_id: str, status: str):
    redis_client.set(f"job:{job_id}:status", status)


def get_status(job_id: str):
    status = redis_client.get(f"job:{job_id}:status")
    return status
