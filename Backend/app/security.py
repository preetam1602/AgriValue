from .clock import utcnow
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from cryptography.fernet import Fernet
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select

from .config import settings
from .db import session
from .models import AuditLog, Consent, RefreshToken, User

bearer = HTTPBearer(auto_error=False)


def fail(code, status=400):
    raise HTTPException(status, detail={'code': code})


def digest(value):
    return hmac.new(settings().lookup_secret.encode(), value.encode(), hashlib.sha256).hexdigest()


def encrypt(value):
    return Fernet(settings().encryption_key.encode()).encrypt(value.encode()).decode()


def decrypt(value):
    return Fernet(settings().encryption_key.encode()).decrypt(value.encode()).decode()


def audit(db, actor, action, kind=None, record_id=None):
    db.add(AuditLog(actor_id=actor, action=action, record_type=kind, record_id=record_id))


def current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer), db=Depends(session)):
    try:
        payload = jwt.decode(credentials.credentials, settings().jwt_secret, algorithms=['HS256'],
                             issuer='agrivalue', options={'require': ['exp', 'sub', 'iat', 'iss', 'type']})
        if payload['type'] != 'access':
            fail('UNAUTHENTICATED', 401)
        user = db.get(User, int(payload['sub']))
        if not user or user.status not in {'active', 'pending'}:
            fail('UNAUTHENTICATED', 401)
        return user
    except (AttributeError, ValueError, jwt.PyJWTError):
        fail('UNAUTHENTICATED', 401)


def tokens(db, user):
    now = datetime.now(timezone.utc)
    access = jwt.encode({'sub': str(user.id), 'iat': now, 'exp': now + timedelta(minutes=15),
                         'iss': 'agrivalue', 'type': 'access'}, settings().jwt_secret, algorithm='HS256')
    refresh = secrets.token_urlsafe(48)
    db.add(RefreshToken(token_hash=digest(refresh), user_id=user.id,
                        expires_at=utcnow() + timedelta(days=7)))
    return {'access_token': access, 'refresh_token': refresh, 'token_type': 'bearer', 'expires_in': 900}


def authorize(db, user, owner_id, write=False):
    allowed = user.role == 'farmer' and user.id == owner_id
    if user.role == 'admin' and not write:
        allowed = True
    if user.role == 'advisor':
        allowed = db.scalar(select(Consent.id).where(
            Consent.owner_id == owner_id, Consent.advisor_id == user.id,
            Consent.revoked.is_(False), Consent.expires_at > utcnow())) is not None
    if not allowed:
        audit(db, user.id, 'FORBIDDEN')
        db.commit()
        fail('FORBIDDEN', 403)
