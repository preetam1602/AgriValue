from app.clock import utcnow
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select

from app.models import AuditLog, Consent, OTPState, User
from app.security import decrypt
from conftest import login


def farm_body():
    return {'district': 'Test district', 'village': 'Test village', 'latitude': 12.5, 'longitude': 77.5,
            'entered_area': 2, 'area_unit': 'acre', 'storage_capacity_qtl': 30, 'vehicle_capacity_qtl': 25}


def harvest_body(farm_id):
    return {'farm_id': farm_id, 'crop': 'test-crop', 'variety': 'test-variety', 'grade': 'test-grade',
            'entered_value': 2, 'entered_unit': 'tonne', 'harvest_date': str(date.today()),
            'latest_sale_date': str(date.today() + timedelta(days=20))}


def test_frontend_reference_data_requires_login_and_exposes_only_public_options(api):
    client, _ = api
    assert client.get('/api/v1/reference-data').status_code == 401
    headers, _ = login(client)
    response = client.get('/api/v1/reference-data', headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data['pilot_districts'] == ['Test district']
    assert data['crops']['test-crop'] == {
        'varieties': ['test-variety'], 'grades': ['test-grade'], 'bag_weight_kg': 50}
    assert set(data) == {'pilot_districts', 'crops', 'max_storage_months', 'max_farm_acres'}


def test_registration_encryption_language_and_tokens(api):
    client, factory = api
    headers, token = login(client, language='kn')
    assert token['expires_in'] == 900
    assert client.get('/api/v1/me', headers=headers).json()['language'] == 'kn'
    assert client.put('/api/v1/me', headers=headers, json={'name': 'Test Farmer', 'language': 'kn'}).status_code == 200
    with factory() as db:
        user = db.scalar(select(User))
        assert user.phone_encrypted != '9876543210'
        assert decrypt(user.phone_encrypted) == '9876543210'
        assert 'Test Farmer' not in user.name_encrypted
        assert db.scalar(select(AuditLog).where(AuditLog.action == 'LOGIN'))
    refreshed = client.post('/api/v1/auth/refresh', json={'refresh_token': token['refresh_token']})
    assert refreshed.status_code == 200
    assert client.post('/api/v1/auth/refresh', json={'refresh_token': token['refresh_token']}).status_code == 401
    assert client.post('/api/v1/auth/logout', headers=headers,
                       json={'refresh_token': refreshed.json()['refresh_token']}).status_code == 200
    assert client.post('/api/v1/auth/refresh', json={'refresh_token': refreshed.json()['refresh_token']}).status_code == 401


def test_owner_cru_and_cross_farmer_access(api):
    client, factory = api
    owner, _ = login(client)
    other, _ = login(client, '8765432109')
    farm = client.post('/api/v1/farms', headers=owner, json=farm_body())
    assert farm.status_code == 201, farm.text
    farm_id = farm.json()['id']
    changed = farm_body() | {'storage_capacity_qtl': 40}
    assert client.put(f'/api/v1/farms/{farm_id}', headers=owner, json=changed).json()['storage_capacity_qtl'] == '40.000000'
    harvest = client.post('/api/v1/harvests', headers=owner, json=harvest_body(farm_id))
    assert harvest.status_code == 201, harvest.text
    assert harvest.json()['quantity_qtl'] == '20.000000'
    harvest_id = harvest.json()['id']
    assert client.put(f'/api/v1/harvests/{harvest_id}', headers=owner,
                      json=harvest_body(farm_id) | {'entered_value': 3}).status_code == 200
    residue_body = {'residue_type': 'straw', 'moisture_percent': None,
                    'recoverable_quantity_qtl': 20, 'quantity_kept_qtl': 10}
    residue = client.post(f'/api/v1/harvests/{harvest_id}/residues', headers=owner, json=residue_body)
    assert residue.status_code == 201, residue.text
    residue_id = residue.json()['id']
    assert client.put(f'/api/v1/residues/{residue_id}', headers=owner,
                      json=residue_body | {'quantity_kept_qtl': 5}).status_code == 200
    for route in [f'/farms/{farm_id}', f'/harvests/{harvest_id}', f'/residues/{residue_id}',
                  f'/harvests/{harvest_id}/residues']:
        assert client.get('/api/v1' + route, headers=other).status_code == 403
    assert client.get('/api/v1/farms', headers=other).json() == []
    assert client.get('/api/v1/harvests', headers=other).json() == []
    assert client.put(f'/api/v1/harvests/{harvest_id}', headers=other, json=harvest_body(farm_id)).status_code == 403
    assert client.post('/api/v1/harvests', headers=other, json=harvest_body(farm_id)).status_code == 403
    with factory() as db:
        assert db.scalar(select(AuditLog).where(AuditLog.action == 'FORBIDDEN'))


def test_consent_grant_expiry_revocation_and_attribution(api):
    client, factory = api
    farmer, _ = login(client)
    advisor, _ = login(client, '8765432109', 'advisor')
    farmer_id = client.get('/api/v1/me', headers=farmer).json()['id']
    advisor_id = client.get('/api/v1/me', headers=advisor).json()['id']
    body = farm_body() | {'owner_id': farmer_id}
    assert client.post('/api/v1/farms', headers=advisor, json=body).status_code == 403
    consent = client.post('/api/v1/me/consents', headers=farmer, json={
        'advisor_id': advisor_id, 'expires_at': (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()})
    assert consent.status_code == 201
    farm = client.post('/api/v1/farms', headers=advisor, json=body)
    assert farm.status_code == 201, farm.text
    assert farm.json()['entered_by'] == advisor_id
    farm_id = farm.json()['id']
    assert client.get(f'/api/v1/farms/{farm_id}', headers=advisor).status_code == 200
    with factory() as db:
        record = db.get(Consent, consent.json()['id'])
        record.expires_at = utcnow() - timedelta(seconds=1)
        db.commit()
    assert client.get(f'/api/v1/farms/{farm_id}', headers=advisor).status_code == 403
    with factory() as db:
        db.get(Consent, consent.json()['id']).expires_at = utcnow() + timedelta(days=1)
        db.commit()
    assert client.delete(f'/api/v1/me/consents/{consent.json()["id"]}', headers=farmer).status_code == 204
    assert client.get(f'/api/v1/farms/{farm_id}', headers=advisor).status_code == 403


def test_otp_attempt_limits_and_expiry(api):
    client, factory = api
    phone = '9876543210'
    sent = client.post('/api/v1/auth/otp/request', json={'phone': phone}).json()
    wrong = '000000' if sent['demo_otp'] != '000000' else '111111'
    for expected in [401, 401, 429]:
        assert client.post('/api/v1/auth/otp/verify', json={'phone': phone, 'otp': wrong}).status_code == expected
    assert client.post('/api/v1/auth/otp/verify', json={'phone': phone, 'otp': sent['demo_otp']}).status_code == 429
    with factory() as db:
        db.scalar(select(OTPState)).requested_at -= timedelta(minutes=2)
        db.commit()
    sent = client.post('/api/v1/auth/otp/request', json={'phone': phone}).json()
    wrong = '000000' if sent['demo_otp'] != '000000' else '111111'
    assert client.post('/api/v1/auth/otp/verify', json={'phone': phone, 'otp': wrong}).status_code == 401
    assert client.post('/api/v1/auth/otp/verify', json={'phone': phone, 'otp': wrong}).json()['code'] == 'AUTH_LOCKED'
    assert client.post('/api/v1/auth/otp/request', json={'phone': phone}).status_code == 429
    with factory() as db:
        state = db.scalar(select(OTPState))
        assert state.failures == 5
        state.locked_until = utcnow() - timedelta(seconds=1)
        state.requested_at -= timedelta(minutes=2)
        db.commit()
    sent = client.post('/api/v1/auth/otp/request', json={'phone': phone}).json()
    with factory() as db:
        db.scalar(select(OTPState)).expires_at = utcnow() - timedelta(seconds=1)
        db.commit()
    assert client.post('/api/v1/auth/otp/verify', json={'phone': phone, 'otp': sent['demo_otp']}).json()['code'] == 'OTP_EXPIRED'


def test_validation_units_and_warnings(api):
    client, _ = api
    assert client.post('/api/v1/auth/otp/request', json={'phone': '123'}).json()['code'] == 'VAL_MOBILE'
    owner, _ = login(client)
    farm_id = client.post('/api/v1/farms', headers=owner, json=farm_body()).json()['id']
    body = harvest_body(farm_id)
    for invalid in [{'entered_value': -5}, {'harvest_date': str(date.today() + timedelta(days=1))},
                    {'cash_needed': 5000}, {'latest_sale_date': str(date.today() + timedelta(days=200))},
                    {'crop': 'inactive'}, {'cash_needed': 5000, 'cash_needed_by': str(date.today() - timedelta(days=1))}]:
        assert client.post('/api/v1/harvests', headers=owner, json=body | invalid).status_code == 400
    for unit, entered, expected in [('bags', 4, '2.000000'), ('kg', 200, '2.000000'), ('qtl', 2, '2.000000')]:
        response = client.post('/api/v1/harvests', headers=owner, json=body | {'entered_unit': unit, 'entered_value': entered})
        assert response.json()['quantity_qtl'] == expected
    high = body | {'entered_value': 30}
    assert client.post('/api/v1/harvests', headers=owner, json=high).json()['code'] == 'HIGH_QUANTITY_CONFIRMATION_REQUIRED'
    response = client.post('/api/v1/harvests', headers=owner, json=high | {'confirm_high_quantity': True})
    assert response.json()['warnings'] == ['HIGH_QUANTITY_FOR_AREA']
    harvest_id = response.json()['id']
    assert client.post(f'/api/v1/harvests/{harvest_id}/residues', headers=owner, json={
        'residue_type': 'straw', 'recoverable_quantity_qtl': 10, 'quantity_kept_qtl': 11}).status_code == 400
    response = client.get('/api/v1/me', headers={'Accept-Language': 'kn'})
    assert response.status_code == 401
    assert response.json()['message'] != 'Log in again.'


def test_buyer_denial_resend_replay_and_sms_failure(api, monkeypatch):
    client, _ = api
    farmer, _ = login(client)
    farm_id = client.post('/api/v1/farms', headers=farmer, json=farm_body()).json()['id']
    buyer, _ = login(client, '8765432109', 'buyer')
    assert client.get('/api/v1/me', headers=buyer).json()['status'] == 'pending'
    assert client.get(f'/api/v1/farms/{farm_id}', headers=buyer).json()['code'] == 'FORBIDDEN'
    phone = '7654321098'
    sent = client.post('/api/v1/auth/otp/request', json={'phone': phone}).json()
    assert client.post('/api/v1/auth/otp/request', json={'phone': phone}).status_code == 429
    assert client.post('/api/v1/auth/otp/verify', json={'phone': phone, 'otp': sent['demo_otp']}).status_code == 200
    assert client.post('/api/v1/auth/otp/verify', json={'phone': phone, 'otp': sent['demo_otp']}).status_code == 401
    from app.security import fail
    monkeypatch.setattr('app.accounts.send_sms', lambda *_: fail('OTP_FAILED', 503))
    assert client.post('/api/v1/auth/otp/request', json={'phone': '6543210987'}).json()['code'] == 'OTP_FAILED'


def test_expired_access_refresh_and_tampered_tokens(api):
    import jwt
    from app.config import settings
    from app.models import RefreshToken
    client, factory = api
    headers, token = login(client)
    payload = jwt.decode(token['access_token'], settings().jwt_secret, algorithms=['HS256'])
    payload['exp'] = int((datetime.now(timezone.utc) - timedelta(seconds=1)).timestamp())
    expired = jwt.encode(payload, settings().jwt_secret, algorithm='HS256')
    assert client.get('/api/v1/me', headers={'Authorization': 'Bearer ' + expired}).status_code == 401
    assert client.get('/api/v1/me', headers={'Authorization': 'Bearer invalid-token'}).status_code == 401
    with factory() as db:
        db.scalar(select(RefreshToken)).expires_at = utcnow() - timedelta(seconds=1)
        db.commit()
    assert client.post('/api/v1/auth/refresh', json={'refresh_token': token['refresh_token']}).status_code == 401


def test_rolling_hour_failure_count(api):
    client, factory = api
    phone = '9876543210'
    sent = client.post('/api/v1/auth/otp/request', json={'phone': phone}).json()
    with factory() as db:
        state = db.scalar(select(OTPState))
        # One old failure expires; four recent failures still count, regardless of window start.
        state.window_start = utcnow() - timedelta(minutes=61)
        state.failure_times = [(utcnow() - timedelta(minutes=n)).isoformat() for n in [61, 40, 30, 20, 10]]
        state.failures = 5
        db.commit()
    wrong = '000000' if sent['demo_otp'] != '000000' else '111111'
    response = client.post('/api/v1/auth/otp/verify', json={'phone': phone, 'otp': wrong})
    assert response.status_code == 429
    assert response.json()['code'] == 'AUTH_LOCKED'
    with factory() as db:
        assert db.scalar(select(OTPState)).failures == 5
