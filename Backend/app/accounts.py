from .clock import utcnow
import secrets
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends
from sqlalchemy import select, text

from .config import settings
from .db import session
from .models import Consent, OTPState, RefreshToken, User
from .schemas import ConsentInput, OTPRequest, OTPVerify, Profile, RefreshInput
from .security import audit, current_user, decrypt, digest, encrypt, fail, tokens

router = APIRouter()


def phone_state(db, phone):
    key = digest(phone)
    # Serialize even the first request for a number across API processes.
    if db.bind.dialect.name == 'postgresql':
        db.execute(text('SELECT pg_advisory_xact_lock(:key)'),
                   {'key': int(key[:15], 16)})
    return key, db.scalar(select(OTPState).where(OTPState.phone_hash == key).with_for_update())


def send_sms(phone, otp):
    cfg = settings()
    if cfg.sms_mode == 'demo':
        return
    try:
        with httpx.Client(timeout=10) as client:
            response = client.post(cfg.sms_url, headers={'Authorization': f'Bearer {cfg.sms_token}'},
                                   json={'phone': phone, 'otp': otp, 'expires_in_seconds': 300})
            response.raise_for_status()
    except (httpx.HTTPError, ValueError):
        fail('OTP_FAILED', 503)


@router.post('/auth/otp/request')
def request_otp(body: OTPRequest, db=Depends(session)):
    now = utcnow()
    key, state = phone_state(db, body.phone)
    if state is None:
        state = OTPState(phone_hash=key, attempts=0, failures=0)
        db.add(state)
    if state.locked_until and state.locked_until > now:
        fail('AUTH_LOCKED', 429)
    if state.requested_at and now - state.requested_at < timedelta(seconds=settings().otp_resend_seconds):
        fail('AUTH_RATE_LIMITED', 429)
    code = f'{secrets.randbelow(1000000):06d}'
    send_sms(body.phone, code)
    state.code_hash = digest(key + ':' + code)
    state.expires_at = now + timedelta(minutes=5)
    state.requested_at = now
    state.attempts = 0
    state.language, state.role = body.language, body.role
    db.commit()
    result = {'code': 'OTP_SENT', 'expires_in': 300}
    if settings().sms_mode == 'demo':
        result['demo_otp'] = code
    return result


@router.post('/auth/otp/verify')
def verify_otp(body: OTPVerify, db=Depends(session)):
    now = utcnow()
    key, state = phone_state(db, body.phone)
    if state and state.locked_until and state.locked_until > now:
        fail('AUTH_LOCKED', 429)
    if not state or not state.code_hash:
        fail('OTP_INVALID', 401)
    if state.expires_at <= now:
        fail('OTP_EXPIRED', 401)
    if state.attempts >= 3:
        fail('AUTH_LOCKED', 429)
    if not secrets.compare_digest(state.code_hash, digest(key + ':' + body.otp)):
        recent = [stamp for stamp in (state.failure_times or [])
                  if datetime.fromisoformat(stamp) > now - timedelta(hours=1)]
        recent.append(now.isoformat())
        state.failure_times = recent
        state.window_start = datetime.fromisoformat(recent[0])
        state.attempts += 1
        state.failures = len(recent)
        if state.failures >= 5:
            state.locked_until = now + timedelta(hours=1)
        locked = state.attempts >= 3 or state.failures >= 5
        db.commit()
        fail('AUTH_LOCKED' if locked else 'OTP_INVALID', 429 if locked else 401)
    user = db.scalar(select(User).where(User.phone_hash == key))
    if user is None:
        user = User(phone_hash=key, phone_encrypted=encrypt(body.phone), language=state.language,
                    role=state.role, status='pending' if state.role in {'buyer', 'logistics'} else 'active')
        db.add(user)
        db.flush()
    else:
        user.language = state.language
    state.code_hash = None
    result = tokens(db, user)
    audit(db, user.id, 'LOGIN')
    db.commit()
    return result


@router.post('/auth/refresh')
def refresh(body: RefreshInput, db=Depends(session)):
    record = db.scalar(select(RefreshToken).where(
        RefreshToken.token_hash == digest(body.refresh_token)).with_for_update())
    if not record or record.revoked or record.expires_at <= utcnow():
        fail('UNAUTHENTICATED', 401)
    user = db.get(User, record.user_id)
    if user.status not in {'active', 'pending'}:
        fail('UNAUTHENTICATED', 401)
    record.revoked = True
    result = tokens(db, user)
    db.commit()
    return result


@router.post('/auth/logout')
def logout(body: RefreshInput, user=Depends(current_user), db=Depends(session)):
    record = db.scalar(select(RefreshToken).where(
        RefreshToken.token_hash == digest(body.refresh_token)).with_for_update())
    if record and record.user_id == user.id:
        record.revoked = True
    db.commit()
    return {'code': 'LOGGED_OUT'}


def profile(user):
    # Phone is deliberately excluded from profile responses and audit logs.
    return {'id': user.id, 'name': decrypt(user.name_encrypted) if user.name_encrypted else None,
            'language': user.language, 'role': user.role, 'status': user.status}


@router.get('/me')
def get_profile(user=Depends(current_user)):
    return profile(user)


@router.put('/me')
def update_profile(body: Profile, user=Depends(current_user), db=Depends(session)):
    user.name_encrypted = encrypt(body.name) if body.name else None
    user.language = body.language
    db.commit()
    return profile(user)


@router.post('/me/consents', status_code=201)
def grant_consent(body: ConsentInput, user=Depends(current_user), db=Depends(session)):
    if user.role != 'farmer':
        audit(db, user.id, 'FORBIDDEN')
        db.commit()
        fail('FORBIDDEN', 403)
    advisor = db.get(User, body.advisor_id)
    expires = body.expires_at
    if expires.tzinfo is None:
        fail('VALIDATION_ERROR')
    expires = expires.astimezone(timezone.utc).replace(tzinfo=None)
    if not advisor or advisor.role != 'advisor' or advisor.status != 'active' or expires <= utcnow():
        fail('VALIDATION_ERROR')
    record = Consent(owner_id=user.id, advisor_id=advisor.id, expires_at=expires)
    db.add(record)
    db.flush()
    audit(db, user.id, 'CONSENT_GRANTED', 'consent', record.id)
    db.commit()
    return {'id': record.id, 'advisor_id': advisor.id, 'expires_at': expires, 'revoked': False}


@router.get('/me/consents')
def list_consents(user=Depends(current_user), db=Depends(session)):
    return [{'id': c.id, 'advisor_id': c.advisor_id, 'expires_at': c.expires_at, 'revoked': c.revoked}
            for c in db.scalars(select(Consent).where(Consent.owner_id == user.id))]


@router.delete('/me/consents/{consent_id}', status_code=204)
def revoke_consent(consent_id: int, user=Depends(current_user), db=Depends(session)):
    record = db.get(Consent, consent_id)
    if not record:
        fail('NOT_FOUND', 404)
    if record.owner_id != user.id:
        audit(db, user.id, 'FORBIDDEN')
        db.commit()
        fail('FORBIDDEN', 403)
    record.revoked = True
    audit(db, user.id, 'CONSENT_REVOKED', 'consent', record.id)
    db.commit()
