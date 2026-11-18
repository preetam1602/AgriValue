import httpx

from app import location
from conftest import login


def test_reverse_location_auth_validation_and_cache(api, monkeypatch):
    client, _ = api
    location.lookup.cache_clear()
    body = {'latitude': 12.5, 'longitude': 77.5}
    assert client.post('/api/v1/location/reverse', json=body).status_code == 401
    headers, _ = login(client)
    calls = []

    def provider(request):
        calls.append(request)
        assert request.headers['user-agent'].startswith('AgriValue/')
        return httpx.Response(200, json={'address': {'state_district': 'Test district', 'county': 'Test taluk', 'village': 'Test village'}})

    original = httpx.Client
    monkeypatch.setattr(location.httpx, 'Client', lambda **kwargs: original(transport=httpx.MockTransport(provider), **kwargs))
    monkeypatch.setattr(location.time, 'sleep', lambda _: None)
    try:
        for _ in range(2):
            response = client.post('/api/v1/location/reverse', headers=headers, json=body)
            assert response.status_code == 200
            assert response.json() == {'district': 'Test district', 'village': 'Test village'}
        assert len(calls) == 1
        assert client.post('/api/v1/location/reverse', headers=headers,
                           json={'latitude': 91, 'longitude': 0}).status_code == 400
    finally:
        location.lookup.cache_clear()


def test_reverse_location_provider_failure_is_recoverable(api, monkeypatch):
    client, _ = api
    headers, _ = login(client)
    location.lookup.cache_clear()
    original = httpx.Client
    monkeypatch.setattr(location.httpx, 'Client', lambda **kwargs: original(
        transport=httpx.MockTransport(lambda request: httpx.Response(429)), **kwargs))
    monkeypatch.setattr(location.time, 'sleep', lambda _: None)
    response = client.post('/api/v1/location/reverse', headers=headers,
                           json={'latitude': 12.5, 'longitude': 77.5})
    assert response.status_code == 503
    assert response.json()['code'] == 'LOCATION_UNAVAILABLE'
