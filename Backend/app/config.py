from functools import lru_cache
import json
from pathlib import Path

from cryptography.fernet import Fernet
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')
    database_url: str
    jwt_secret: str
    lookup_secret: str
    encryption_key: str
    environment: str = 'production'
    sms_mode: str = 'http'
    sms_url: str = ''
    sms_token: str = ''
    geocoding_url: str = 'https://nominatim.openstreetmap.org/reverse'
    pilot_districts: list[str] = []
    crops: dict = {}
    max_farm_acres: float = 100
    max_storage_months: int = 6
    otp_resend_seconds: int = 60

    @property
    def allow_manual_district(self):
        return self.environment == 'development' and not self.pilot_districts

    @model_validator(mode='after')
    def secure_settings(self):
        if self.environment == 'development' and not self.crops:
            self.crops = json.loads(Path(__file__).with_name('development_crops.json').read_text(encoding='utf-8'))
        if len(self.jwt_secret) < 32 or len(self.lookup_secret) < 32:
            raise ValueError('JWT_SECRET and LOOKUP_SECRET must contain at least 32 characters')
        Fernet(self.encryption_key.encode())
        if self.sms_mode not in {'demo', 'http'}:
            raise ValueError('SMS_MODE must be demo or http')
        if self.environment == 'production':
            if self.sms_mode == 'demo' or not self.database_url.startswith('postgresql'):
                raise ValueError('Production requires PostgreSQL and a real SMS adapter')
            if not self.sms_url.startswith('https://') or not self.sms_token:
                raise ValueError('Production requires HTTPS SMS_URL and SMS_TOKEN')
        return self


@lru_cache
def settings():
    return Settings()
