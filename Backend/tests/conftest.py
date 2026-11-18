import json
import os

from cryptography.fernet import Fernet

# Test-only values; no actual pilot data is seeded.
os.environ.update(
    DATABASE_URL='sqlite://', ENVIRONMENT='test', SMS_MODE='demo',
    JWT_SECRET='test-jwt-secret-' * 4, LOOKUP_SECRET='test-lookup-secret-' * 4,
    ENCRYPTION_KEY=Fernet.generate_key().decode(),
    PILOT_DISTRICTS=json.dumps(['Test district']),
    CROPS=json.dumps({'test-crop': {'active': True, 'bag_weight_kg': 50,
                                  'varieties': ['test-variety'], 'grades': ['test-grade'],
                                  'high_quantity_qtl_per_acre': 100}}),
)

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy import event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from alembic import command
from alembic.config import Config

from app.db import session
from app.main import app


@pytest.fixture
def api():
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)

    @event.listens_for(engine, 'connect')
    def foreign_keys(connection, _):
        connection.execute('PRAGMA foreign_keys=ON')

    with engine.begin() as connection:
        config = Config('alembic.ini')
        config.attributes['connection'] = connection
        command.upgrade(config, 'head')
    factory = sessionmaker(engine, expire_on_commit=False)

    def override():
        with factory() as db:
            yield db

    app.dependency_overrides[session] = override
    with TestClient(app) as client:
        yield client, factory
    app.dependency_overrides.clear()
    engine.dispose()


def login(client, phone='9876543210', role='farmer', language='en'):
    response = client.post('/api/v1/auth/otp/request', json={'phone': phone, 'role': role, 'language': language})
    assert response.status_code == 200, response.text
    response = client.post('/api/v1/auth/otp/verify', json={'phone': phone, 'otp': response.json()['demo_otp']})
    assert response.status_code == 200, response.text
    return {'Authorization': 'Bearer ' + response.json()['access_token']}, response.json()
