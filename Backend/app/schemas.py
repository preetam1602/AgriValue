from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Input(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)


class OTPRequest(Input):
    phone: str = Field(pattern=r'^[6-9][0-9]{9}$')
    language: Literal['kn', 'en'] = 'en'
    role: Literal['farmer', 'advisor', 'buyer', 'logistics', 'fpo'] = 'farmer'


class OTPVerify(Input):
    phone: str = Field(pattern=r'^[6-9][0-9]{9}$')
    otp: str = Field(pattern=r'^[0-9]{6}$')


class RefreshInput(Input):
    refresh_token: str = Field(min_length=32, max_length=256)


class Profile(Input):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    language: Literal['kn', 'en']


class ConsentInput(Input):
    advisor_id: int = Field(gt=0)
    expires_at: datetime


class FarmInput(Input):
    owner_id: int | None = Field(default=None, gt=0)
    district: str = Field(min_length=1, max_length=100)
    village: str = Field(min_length=1, max_length=100)
    latitude: Decimal = Field(ge=-90, le=90, decimal_places=7)
    longitude: Decimal = Field(ge=-180, le=180, decimal_places=7)
    entered_area: Decimal = Field(gt=0, max_digits=16, decimal_places=6)
    area_unit: Literal['acre', 'hectare', 'gunta']
    storage_capacity_qtl: Decimal = Field(ge=0, max_digits=16, decimal_places=6)
    vehicle_capacity_qtl: Decimal = Field(ge=0, max_digits=16, decimal_places=6)


class HarvestDetails(Input):
    crop: str = Field(min_length=1, max_length=100)
    variety: str = Field(min_length=1, max_length=100)
    grade: str = Field(min_length=1, max_length=100)
    entered_value: Decimal = Field(gt=0, max_digits=16, decimal_places=6)
    entered_unit: Literal['kg', 'qtl', 'tonne', 'bags']
    harvest_date: date
    latest_sale_date: date
    cash_needed: Decimal | None = Field(default=None, gt=0, max_digits=16, decimal_places=2)
    cash_needed_by: date | None = None
    confirm_high_quantity: bool = False

    @model_validator(mode='after')
    def cash_pair(self):
        if (self.cash_needed is None) != (self.cash_needed_by is None):
            raise ValueError('Cash amount and deadline must be supplied together')
        return self


class HarvestInput(HarvestDetails):
    farm_id: int = Field(gt=0)


class HarvestRecordInput(HarvestDetails):
    farm_id: int | None = Field(default=None, gt=0)
    farm: FarmInput | None = None

    @model_validator(mode='after')
    def one_location(self):
        if (self.farm_id is None) == (self.farm is None):
            raise ValueError('Supply one existing location or new location details')
        return self


class ResidueInput(Input):
    residue_type: str = Field(min_length=1, max_length=100)
    moisture_percent: Decimal | None = Field(default=None, ge=0, le=100, decimal_places=2)
    recoverable_quantity_qtl: Decimal = Field(ge=0, max_digits=16, decimal_places=6)
    quantity_kept_qtl: Decimal = Field(ge=0, max_digits=16, decimal_places=6)

    @model_validator(mode='after')
    def kept_limit(self):
        if self.quantity_kept_qtl > self.recoverable_quantity_qtl:
            raise ValueError('Kept quantity exceeds recoverable quantity')
        return self
