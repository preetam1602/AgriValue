from datetime import datetime, timezone


def utcnow():
    """Database timestamps are UTC, stored without a timezone on both test and PostgreSQL DBs."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
