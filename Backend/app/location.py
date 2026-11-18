from functools import lru_cache
import threading
import time

import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import text

from .config import settings
from .db import session
from .security import current_user, fail

router = APIRouter()
_lock = threading.Lock()


class Coordinates(BaseModel):
    latitude: float = Field(ge=-90, le=90, allow_inf_nan=False)
    longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)


@lru_cache(maxsize=512)
def lookup(latitude, longitude, url):
    # Caller holds the shared PostgreSQL lock (or local test lock).
    # A one-second gap also applies across API workers sharing this database.
    time.sleep(1)
    try:
        with httpx.Client(timeout=10) as client:
            response = client.get(url, params={'lat': latitude, 'lon': longitude,
                'format': 'jsonv2', 'addressdetails': 1, 'zoom': 18},
                headers={'User-Agent': 'AgriValue/0.1 (farm location lookup)', 'Accept-Language': 'en'})
            response.raise_for_status()
            address = response.json().get('address', {})
            if not isinstance(address, dict):
                raise ValueError('Invalid address')
            return {'district': address.get('state_district') or address.get('county') or '',
                    'village': address.get('village') or address.get('hamlet') or address.get('town') or address.get('city') or ''}
    except (httpx.HTTPError, ValueError, AttributeError):
        fail('LOCATION_UNAVAILABLE', 503)


@router.post('/location/reverse')
def reverse_location(body: Coordinates, user=Depends(current_user), db=Depends(session)):
    # POST keeps coordinates out of application access-log query strings.
    with _lock:
        if db.bind.dialect.name == 'postgresql':
            db.execute(text('SELECT pg_advisory_xact_lock(718416201)'))
        result = lookup(round(body.latitude, 5), round(body.longitude, 5), settings().geocoding_url)
    return result
