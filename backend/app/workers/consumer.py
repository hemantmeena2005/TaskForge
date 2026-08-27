from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from aiokafka import AIOKafkaConsumer

from app.core.config import settings

logger = logging.getLogger(__name__)


async def process_event(event_data: dict[str, Any]) -> None:
    event_type = event_data.get("event_type", "UNKNOWN")
    resource_type = event_data.get("resource_type", "unknown")
    resource_id = event_data.get("resource_id", "none")
    user_id = event_data.get("user_id", "system")

    logger.info(
        f"[Consumer] Processing {event_type} on {resource_type}/{resource_id} by user {user_id}"
    )

    if event_type == "ISSUE_CREATED":
        logger.info(f"[Consumer] New issue created: {event_data.get('data', {}).get('issue_key', 'N/A')}")

    elif event_type == "ISSUE_STATUS_CHANGED":
        data = event_data.get("data", {})
        logger.info(
            f"[Consumer] Issue status changed: {data.get('old', '?')} -> {data.get('new', '?')}"
        )

    elif event_type == "SPRINT_STARTED":
        logger.info(f"[Consumer] Sprint started: {event_data.get('data', {}).get('name', 'N/A')}")

    elif event_type == "SPRINT_COMPLETED":
        logger.info(f"[Consumer] Sprint completed: {event_data.get('data', {}).get('name', 'N/A')}")

    elif event_type == "MEMBER_ADDED":
        logger.info(f"[Consumer] Member added to {resource_type}: user {event_data.get('data', {}).get('member_id', 'N/A')}")

    else:
        logger.info(f"[Consumer] Unhandled event type: {event_type}")


async def run_consumer() -> None:
    consumer = AIOKafkaConsumer(
        settings.KAFKA_TOPIC,
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
        group_id="taskforge-workers",
        auto_offset_reset="latest",
        value_deserializer=lambda m: json.loads(m.decode("utf-8")),
    )

    await consumer.start()
    logger.info(f"[Consumer] Listening on topic '{settings.KAFKA_TOPIC}'...")

    try:
        async for msg in consumer:
            try:
                event_data = msg.value
                if event_data:
                    await process_event(event_data)
            except Exception as e:
                logger.error(f"[Consumer] Error processing message: {e}")
    finally:
        await consumer.stop()
        logger.info("[Consumer] Stopped")


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(name)s | %(message)s")
    logger.info("[Consumer] Starting TaskForge event consumer...")
    await run_consumer()


if __name__ == "__main__":
    asyncio.run(main())
