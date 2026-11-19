from datetime import date, timedelta

import pytest
from sqlalchemy import func, select

from app.models import AuditLog, Farm, Harvest
from conftest import login
from test_step1 import farm_body, harvest_body


def record_body():
    details = harvest_body(1)
    details.pop('farm_id')
    return details | {'farm': farm_body()}


def test_one_save_creates_complete_harvest_record(api):
    client, factory = api
    headers, _ = login(client)
    response = client.post('/api/v1/harvest-records', headers=headers, json=record_body())
    assert response.status_code == 201, response.text
    result = response.json()
    assert result['harvest']['farm_id'] == result['farm']['id']
    assert result['harvest']['quantity_qtl'] == '20.000000'
    assert client.get('/api/v1/harvests', headers=headers).json() == [result['harvest']]
    with factory() as db:
        assert db.scalar(select(func.count()).select_from(Farm)) == 1
        assert db.scalar(select(func.count()).select_from(Harvest)) == 1
        assert db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.action == 'RECORD_SAVED')) == 2
    reused = client.post('/api/v1/harvest-records', headers=headers, json=harvest_body(result['farm']['id']))
    assert reused.status_code == 201, reused.text
    assert len(client.get('/api/v1/farms', headers=headers).json()) == 1
    assert len(client.get('/api/v1/harvests', headers=headers).json()) == 2


@pytest.mark.parametrize('changes', [
    {'grade': 'invalid-grade'},
    {'harvest_date': str(date.today() + timedelta(days=1))},
    {'entered_value': 1000},
])
def test_invalid_or_unconfirmed_harvest_saves_nothing(api, changes):
    client, _ = api
    headers, _ = login(client)
    response = client.post('/api/v1/harvest-records', headers=headers, json=record_body() | changes)
    assert response.status_code == 400, response.text
    assert client.get('/api/v1/farms', headers=headers).json() == []
    assert client.get('/api/v1/harvests', headers=headers).json() == []
    retry = client.post('/api/v1/harvest-records', headers=headers, json=record_body())
    assert retry.status_code == 201, retry.text
    assert len(client.get('/api/v1/farms', headers=headers).json()) == 1
    assert len(client.get('/api/v1/harvests', headers=headers).json()) == 1


def test_transaction_failure_leaves_no_separate_farm(api, monkeypatch):
    from app import records

    client, factory = api
    headers, _ = login(client)
    original = records.save

    def fail_after_flush(*args, **kwargs):
        result = original(*args, **kwargs)
        if isinstance(result, Harvest):
            raise RuntimeError('Simulated transaction failure')
        return result

    monkeypatch.setattr(records, 'save', fail_after_flush)
    with pytest.raises(RuntimeError, match='Simulated transaction failure'):
        client.post('/api/v1/harvest-records', headers=headers, json=record_body())
    with factory() as db:
        assert db.scalar(select(func.count()).select_from(Farm)) == 0
        assert db.scalar(select(func.count()).select_from(Harvest)) == 0
        assert db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.action == 'RECORD_SAVED')) == 0


def test_record_save_requires_one_location_and_owner_access(api):
    client, _ = api
    assert client.post('/api/v1/harvest-records', json=record_body()).status_code == 401
    owner, _ = login(client)
    other, _ = login(client, '8765432109')
    result = client.post('/api/v1/harvest-records', headers=owner, json=record_body()).json()
    payload = harvest_body(result['farm']['id'])
    assert client.post('/api/v1/harvest-records', headers=other, json=payload).status_code == 403
    assert client.post('/api/v1/harvest-records', headers=owner, json=payload | {'farm': farm_body()}).status_code == 400
    payload.pop('farm_id')
    assert client.post('/api/v1/harvest-records', headers=owner, json=payload).status_code == 400


def test_delete_harvest_removes_linked_residue_and_updates_records(api):
    from app.models import Residue

    client, factory = api
    owner, _ = login(client)
    result = client.post('/api/v1/harvest-records', headers=owner, json=record_body()).json()
    harvest_id = result['harvest']['id']
    other_harvest = client.post('/api/v1/harvest-records', headers=owner,
                                json=harvest_body(result['farm']['id'])).json()['harvest']
    residue = client.post(f'/api/v1/harvests/{harvest_id}/residues', headers=owner,
                          json={'residue_type': 'straw', 'recoverable_quantity_qtl': 10, 'quantity_kept_qtl': 2})
    assert residue.status_code == 201, residue.text
    response = client.delete(f'/api/v1/harvests/{harvest_id}', headers=owner)
    assert response.status_code == 204, response.text
    assert response.content == b''
    assert client.get('/api/v1/harvests', headers=owner).json() == [other_harvest]
    assert client.get(f'/api/v1/harvests/{harvest_id}', headers=owner).status_code == 404
    assert client.delete(f'/api/v1/harvests/{harvest_id}', headers=owner).status_code == 404
    with factory() as db:
        assert db.get(Residue, residue.json()['id']) is None
        assert db.get(Farm, result['farm']['id']) is not None
        assert db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.action == 'RECORD_DELETED')) == 2


def test_harvest_deletion_requires_owner_access(api):
    client, _ = api
    owner, _ = login(client)
    other, _ = login(client, '8765432109')
    result = client.post('/api/v1/harvest-records', headers=owner, json=record_body()).json()
    harvest_id = result['harvest']['id']
    assert client.delete(f'/api/v1/harvests/{harvest_id}').status_code == 401
    assert client.delete(f'/api/v1/harvests/{harvest_id}', headers=other).status_code == 403
    assert client.get('/api/v1/harvests', headers=owner).json() == [result['harvest']]


def test_date_picker_limits_match_save_validation(api):
    client, _ = api
    owner, _ = login(client)
    limits = client.get('/api/v1/reference-data', headers=owner).json()['date_limits']
    for harvest_key, sale_key in [('harvest_min', 'sale_min'), ('harvest_max', 'sale_max')]:
        response = client.post('/api/v1/harvest-records', headers=owner,
                               json=record_body() | {'harvest_date': limits[harvest_key], 'latest_sale_date': limits[sale_key]})
        assert response.status_code == 201, response.text
    for key, offset, field, code in [
        ('harvest_min', -1, 'harvest_date', 'VAL_HARVEST_DATE'),
        ('harvest_max', 1, 'harvest_date', 'VAL_HARVEST_DATE'),
        ('sale_min', -1, 'latest_sale_date', 'VAL_SALE_DATE'),
        ('sale_max', 1, 'latest_sale_date', 'VAL_SALE_DATE'),
    ]:
        invalid_date = str(date.fromisoformat(limits[key]) + timedelta(days=offset))
        response = client.post('/api/v1/harvest-records', headers=owner,
                               json=record_body() | {field: invalid_date})
        assert response.status_code == 400, response.text
        assert response.json()['code'] == code


def test_harvest_date_limits_handle_leap_day():
    from app.records import record_date_limits

    limits = record_date_limits(date(2024, 2, 29))
    assert limits['harvest_min'] == date(2023, 2, 28)
    assert limits['harvest_max'] == date(2024, 2, 29)
