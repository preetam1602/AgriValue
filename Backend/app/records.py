from .clock import utcnow
import calendar
from datetime import date, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, Response
from sqlalchemy import delete, select
from sqlalchemy.sql.sqltypes import Numeric

from .config import settings
from .db import session
from .models import Consent, Farm, Harvest, Residue
from .schemas import FarmInput, HarvestInput, HarvestRecordInput, ResidueInput
from .security import audit, authorize, current_user, fail

router = APIRouter()


@router.get('/reference-data')
def reference_data(user=Depends(current_user)):
    cfg = settings()
    return {
        'pilot_districts': cfg.pilot_districts,
        'allow_manual_district': cfg.allow_manual_district,
        'crops': {code: {'varieties': crop.get('varieties', []),
                         'grades': crop.get('grades', []),
                         'bag_weight_kg': crop.get('bag_weight_kg')}
                  for code, crop in cfg.crops.items() if crop.get('active')},
        'max_storage_months': cfg.max_storage_months,
        'max_farm_acres': cfg.max_farm_acres,
        'date_limits': record_date_limits(),
    }


def get(db, model, record_id):
    record = db.get(model, record_id)
    if record is None:
        fail('NOT_FOUND', 404)
    return record


def output(record, warnings=None):
    result = {}
    for col in record.__table__.columns:
        value = getattr(record, col.name)
        if value is not None and isinstance(col.type, Numeric):
            value = format(value, f'.{col.type.scale}f')
        result[col.name] = value
    result['warnings'] = warnings or []
    return result


def save(db, record, values, user, kind, commit=True):
    for key, value in values.items():
        setattr(record, key, value)
    if record.id is None:
        record.entered_by = user.id
    record.updated_by = user.id
    db.add(record)
    db.flush()
    audit(db, user.id, 'RECORD_SAVED', kind, record.id)
    if commit:
        db.commit()
    return record


def visible_farms(db, user):
    query = select(Farm)
    if user.role == 'admin':
        return query
    if user.role == 'farmer':
        return query.where(Farm.owner_id == user.id)
    if user.role == 'advisor':
        owners = select(Consent.owner_id).where(
            Consent.advisor_id == user.id, Consent.revoked.is_(False),
            Consent.expires_at > utcnow())
        return query.where(Farm.owner_id.in_(owners))
    authorize(db, user, -1)


def farm_values(body):
    cfg = settings()
    if not cfg.pilot_districts and not cfg.allow_manual_district:
        fail('PILOT_NOT_CONFIGURED', 503)
    district = body.district.strip()
    if not district or (not cfg.allow_manual_district and district not in cfg.pilot_districts):
        fail('VAL_DISTRICT')
    if not body.village.strip():
        fail('VALIDATION_ERROR')
    factor = {'acre': Decimal('1'), 'hectare': Decimal('2.4710538147'), 'gunta': Decimal('0.025')}
    acres = (body.entered_area * factor[body.area_unit]).quantize(Decimal('0.000001'))
    if acres <= 0 or acres > Decimal(str(cfg.max_farm_acres)):
        fail('VAL_FARM_AREA')
    values = body.model_dump(exclude={'owner_id'})
    values['district'] = district
    values['village'] = body.village.strip()
    values['area_acres'] = acres
    return values


@router.post('/farms', status_code=201)
def create_farm(body: FarmInput, user=Depends(current_user), db=Depends(session)):
    owner_id = body.owner_id if body.owner_id is not None else user.id
    authorize(db, user, owner_id, write=True)
    return output(save(db, Farm(owner_id=owner_id), farm_values(body), user, 'farm'))


@router.get('/farms')
def list_farms(user=Depends(current_user), db=Depends(session)):
    return [output(f) for f in db.scalars(visible_farms(db, user).order_by(Farm.id))]


@router.get('/farms/{farm_id}')
def get_farm(farm_id: int, user=Depends(current_user), db=Depends(session)):
    farm = get(db, Farm, farm_id)
    authorize(db, user, farm.owner_id)
    return output(farm)


@router.put('/farms/{farm_id}')
def update_farm(farm_id: int, body: FarmInput, user=Depends(current_user), db=Depends(session)):
    farm = get(db, Farm, farm_id)
    authorize(db, user, farm.owner_id, write=True)
    if body.owner_id is not None and body.owner_id != farm.owner_id:
        audit(db, user.id, 'FORBIDDEN')
        db.commit()
        fail('FORBIDDEN', 403)
    return output(save(db, farm, farm_values(body), user, 'farm'))


def add_months(day, months):
    month = day.month - 1 + months
    year = day.year + month // 12
    month = month % 12 + 1
    return date(year, month, min(day.day, calendar.monthrange(year, month)[1]))


def record_date_limits(today=None):
    today = today or date.today()
    try:
        earliest = today.replace(year=today.year - 1)
    except ValueError:
        earliest = today.replace(year=today.year - 1, day=28)
    return {'harvest_min': earliest, 'harvest_max': today,
            'sale_min': today, 'sale_max': add_months(today, settings().max_storage_months)}


def harvest_values(body, farm):
    cfg = settings()
    if not cfg.crops:
        fail('CROPS_NOT_CONFIGURED', 503)
    crop = cfg.crops.get(body.crop)
    if not crop or not crop.get('active'):
        fail('VAL_CROP')
    if body.variety not in crop.get('varieties', []) or body.grade not in crop.get('grades', []):
        fail('VAL_CROP')
    limits = record_date_limits()
    today = limits['harvest_max']
    if not limits['harvest_min'] <= body.harvest_date <= limits['harvest_max']:
        fail('VAL_HARVEST_DATE')
    if not limits['sale_min'] <= body.latest_sale_date <= limits['sale_max']:
        fail('VAL_SALE_DATE')
    if body.cash_needed_by and body.cash_needed_by < today:
        fail('VAL_CASH_DEADLINE')
    factors = {'kg': Decimal('0.01'), 'qtl': Decimal(1), 'tonne': Decimal(10)}
    if body.entered_unit == 'bags':
        weight = Decimal(str(crop.get('bag_weight_kg', 0)))
        if weight <= 0:
            fail('BAG_WEIGHT_NOT_CONFIGURED', 503)
        factor = weight / 100
    else:
        factor = factors[body.entered_unit]
    quantity = (body.entered_value * factor).quantize(Decimal('0.000001'))
    if quantity <= 0 or quantity >= Decimal('10000000000'):
        fail('VAL_QUANTITY')
    warnings = []
    threshold = crop.get('high_quantity_qtl_per_acre')
    if threshold is not None and quantity > farm.area_acres * Decimal(str(threshold)):
        warnings.append('HIGH_QUANTITY_FOR_AREA')
        if not body.confirm_high_quantity:
            fail('HIGH_QUANTITY_CONFIRMATION_REQUIRED')
    values = body.model_dump(exclude={'confirm_high_quantity'})
    values['quantity_qtl'] = quantity
    return values, warnings


@router.post('/harvest-records', status_code=201)
def create_harvest_record(body: HarvestRecordInput, user=Depends(current_user), db=Depends(session)):
    new_farm = body.farm is not None
    if new_farm:
        owner_id = body.farm.owner_id if body.farm.owner_id is not None else user.id
        authorize(db, user, owner_id, write=True)
        location_values = farm_values(body.farm)
        farm = Farm(owner_id=owner_id, **location_values)
    else:
        farm = get(db, Farm, body.farm_id)
        authorize(db, user, farm.owner_id, write=True)
    details = HarvestInput(**body.model_dump(exclude={'farm', 'farm_id'}), farm_id=farm.id or 1)
    values, warnings = harvest_values(details, farm)
    try:
        if new_farm:
            save(db, farm, location_values, user, 'farm', commit=False)
        values['farm_id'] = farm.id
        harvest = save(db, Harvest(), values, user, 'harvest', commit=False)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {'farm': output(farm), 'harvest': output(harvest, warnings)}


@router.post('/harvests', status_code=201)
def create_harvest(body: HarvestInput, user=Depends(current_user), db=Depends(session)):
    farm = get(db, Farm, body.farm_id)
    authorize(db, user, farm.owner_id, write=True)
    values, warnings = harvest_values(body, farm)
    return output(save(db, Harvest(), values, user, 'harvest'), warnings)


@router.get('/harvests')
def list_harvests(user=Depends(current_user), db=Depends(session)):
    farm_ids = visible_farms(db, user).with_only_columns(Farm.id)
    return [output(h) for h in db.scalars(select(Harvest).where(Harvest.farm_id.in_(farm_ids)).order_by(Harvest.id))]


def accessible_harvest(db, user, harvest_id, write=False):
    harvest = get(db, Harvest, harvest_id)
    authorize(db, user, get(db, Farm, harvest.farm_id).owner_id, write)
    return harvest


@router.get('/harvests/{harvest_id}')
def get_harvest(harvest_id: int, user=Depends(current_user), db=Depends(session)):
    return output(accessible_harvest(db, user, harvest_id))


@router.put('/harvests/{harvest_id}')
def update_harvest(harvest_id: int, body: HarvestInput, user=Depends(current_user), db=Depends(session)):
    harvest = accessible_harvest(db, user, harvest_id, True)
    farm = get(db, Farm, body.farm_id)
    authorize(db, user, farm.owner_id, write=True)
    if harvest.farm_id != body.farm_id:
        fail('VALIDATION_ERROR')
    values, warnings = harvest_values(body, farm)
    return output(save(db, harvest, values, user, 'harvest'), warnings)


@router.delete('/harvests/{harvest_id}', status_code=204)
def delete_harvest(harvest_id: int, user=Depends(current_user), db=Depends(session)):
    harvest = accessible_harvest(db, user, harvest_id, True)
    try:
        residue_ids = db.scalars(select(Residue.id).where(Residue.harvest_id == harvest_id)).all()
        db.execute(delete(Residue).where(Residue.harvest_id == harvest_id))
        for residue_id in residue_ids:
            audit(db, user.id, 'RECORD_DELETED', 'residue', residue_id)
        db.delete(harvest)
        audit(db, user.id, 'RECORD_DELETED', 'harvest', harvest_id)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return Response(status_code=204)


@router.post('/harvests/{harvest_id}/residues', status_code=201)
def create_residue(harvest_id: int, body: ResidueInput, user=Depends(current_user), db=Depends(session)):
    accessible_harvest(db, user, harvest_id, True)
    return output(save(db, Residue(harvest_id=harvest_id), body.model_dump(), user, 'residue'))


@router.get('/harvests/{harvest_id}/residues')
def list_residues(harvest_id: int, user=Depends(current_user), db=Depends(session)):
    accessible_harvest(db, user, harvest_id)
    return [output(r) for r in db.scalars(select(Residue).where(Residue.harvest_id == harvest_id).order_by(Residue.id))]


@router.get('/residues/{residue_id}')
def get_residue(residue_id: int, user=Depends(current_user), db=Depends(session)):
    residue = get(db, Residue, residue_id)
    accessible_harvest(db, user, residue.harvest_id)
    return output(residue)


@router.put('/residues/{residue_id}')
def update_residue(residue_id: int, body: ResidueInput, user=Depends(current_user), db=Depends(session)):
    residue = get(db, Residue, residue_id)
    accessible_harvest(db, user, residue.harvest_id, True)
    return output(save(db, residue, body.model_dump(), user, 'residue'))
