from __future__ import annotations

import json
import logging
from typing import Optional

from aiokafka import AIOKafkaProducer

from app.core.config import settings
from app.core.events import DomainEvent

logger = logging.getLogger(__name__)

_producer: Optional[AIOKafkaProducer] = None


async def get_producer() -> Optional[AIOKafkaProducer]:
    global _producer
    if _producer is not None:
        return _producer

    try:
        _producer = AIOKafkaProducer(
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            value_serializer=lambda v: json.dumps(v, default=str).encode("utf-8"),
            key_serializer=lambda k: k.encode("utf-8") if k else None,
        )
        await _producer.start()
        logger.info("Kafka producer started")
        return _producer
    except Exception as e:
        logger.warning(f"Failed to start Kafka producer: {e}")
        _producer = None
        return None


async def publish_event(event: DomainEvent) -> bool:
    if not settings.KAFKA_ENABLED:
        return False

    try:
        producer = await get_producer()
        if producer is None:
            return False
        await producer.send_and_wait(
            topic=settings.KAFKA_TOPIC,
            key=event.event_type,
            value=event.model_dump(),
        )
        logger.info(f"Published event: {event.event_type} ({event.event_id})")
        return True
    except Exception as e:
        logger.warning(f"Failed to publish Kafka event: {e}")
        return False


async def close_producer() -> None:
    global _producer
    if _producer is not None:
        try:
            await _producer.stop()
        except Exception:
            pass
        _producer = None
        logger.info("Kafka producer stopped")
