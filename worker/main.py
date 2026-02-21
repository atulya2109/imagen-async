import redis
import json
import time

redis_client = redis.Redis(host="localhost", port=6379, decode_responses=True)


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
