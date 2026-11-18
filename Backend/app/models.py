from .clock import utcnow
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class Role(Base):
    __tablename__ = 'roles'
    name: Mapped[str] = mapped_column(String(20), primary_key=True)


class User(Base):
    __tablename__ = 'users'
    id: Mapped[int] = mapped_column(primary_key=True)
    phone_hash: Mapped[str] = mapped_column(String(64), unique=True)
    phone_encrypted: Mapped[str] = mapped_column(Text)
    name_encrypted: Mapped[str | None] = mapped_column(Text)
    language: Mapped[str] = mapped_column(String(2), default='en')
    role: Mapped[str] = mapped_column(ForeignKey('roles.name'), default='farmer')
    status: Mapped[str] = mapped_column(String(20), default='active')


class OTPState(Base):
    __tablename__ = 'otp_states'
    phone_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    code_hash: Mapped[str | None] = mapped_column(String(64))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime)
    requested_at: Mapped[datetime | None] = mapped_column(DateTime)
    attempts: Mapped[int] = mapped_column(default=0)
    failures: Mapped[int] = mapped_column(default=0)
    failure_times: Mapped[list] = mapped_column(JSON, default=list)
    window_start: Mapped[datetime | None] = mapped_column(DateTime)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime)
    language: Mapped[str] = mapped_column(String(2), default='en')
    role: Mapped[str] = mapped_column(String(20), default='farmer')


class RefreshToken(Base):
    __tablename__ = 'refresh_tokens'
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)


class Consent(Base):
    __tablename__ = 'consents'
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey('users.id'))
    advisor_id: Mapped[int] = mapped_column(ForeignKey('users.id'))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)


class Farm(Base):
    __tablename__ = 'farms'
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    entered_by: Mapped[int] = mapped_column(ForeignKey('users.id'))
    updated_by: Mapped[int] = mapped_column(ForeignKey('users.id'))
    district: Mapped[str] = mapped_column(String(100))
    village: Mapped[str] = mapped_column(String(100))
    latitude: Mapped[Decimal] = mapped_column(Numeric(10, 7))
    longitude: Mapped[Decimal] = mapped_column(Numeric(10, 7))
    area_acres: Mapped[Decimal] = mapped_column(Numeric(16, 6))
    entered_area: Mapped[Decimal] = mapped_column(Numeric(16, 6))
    area_unit: Mapped[str] = mapped_column(String(10))
    storage_capacity_qtl: Mapped[Decimal] = mapped_column(Numeric(16, 6))
    vehicle_capacity_qtl: Mapped[Decimal] = mapped_column(Numeric(16, 6))


class Harvest(Base):
    __tablename__ = 'harvests'
    id: Mapped[int] = mapped_column(primary_key=True)
    farm_id: Mapped[int] = mapped_column(ForeignKey('farms.id'), index=True)
    entered_by: Mapped[int] = mapped_column(ForeignKey('users.id'))
    updated_by: Mapped[int] = mapped_column(ForeignKey('users.id'))
    crop: Mapped[str] = mapped_column(String(100))
    variety: Mapped[str] = mapped_column(String(100))
    grade: Mapped[str] = mapped_column(String(100))
    quantity_qtl: Mapped[Decimal] = mapped_column(Numeric(16, 6))
    entered_value: Mapped[Decimal] = mapped_column(Numeric(16, 6))
    entered_unit: Mapped[str] = mapped_column(String(10))
    harvest_date: Mapped[date] = mapped_column(Date)
    latest_sale_date: Mapped[date] = mapped_column(Date)
    cash_needed: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))
    cash_needed_by: Mapped[date | None] = mapped_column(Date)


class Residue(Base):
    __tablename__ = 'residues'
    id: Mapped[int] = mapped_column(primary_key=True)
    harvest_id: Mapped[int] = mapped_column(ForeignKey('harvests.id'), index=True)
    entered_by: Mapped[int] = mapped_column(ForeignKey('users.id'))
    updated_by: Mapped[int] = mapped_column(ForeignKey('users.id'))
    residue_type: Mapped[str] = mapped_column(String(100))
    moisture_percent: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    recoverable_quantity_qtl: Mapped[Decimal] = mapped_column(Numeric(16, 6))
    quantity_kept_qtl: Mapped[Decimal] = mapped_column(Numeric(16, 6))


class AuditLog(Base):
    __tablename__ = 'audit_log'
    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey('users.id'))
    action: Mapped[str] = mapped_column(String(60))
    record_type: Mapped[str | None] = mapped_column(String(30))
    record_id: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
