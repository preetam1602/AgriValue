from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .accounts import router as accounts
from .config import settings
from .records import router as records
from .location import router as location

app = FastAPI(title='AgriValue — Step 1', version='0.1.0')
app.include_router(accounts, prefix='/api/v1', tags=['Accounts'])
app.include_router(records, prefix='/api/v1', tags=['Farms, harvests and residues'])
app.include_router(location, prefix='/api/v1', tags=['Location'])

MESSAGES = {
    'LOCATION_UNAVAILABLE': ('Address lookup is unavailable. Enter the district and village manually.', 'ವಿಳಾಸ ಹುಡುಕಾಟ ಲಭ್ಯವಿಲ್ಲ. ಜಿಲ್ಲೆ ಮತ್ತು ಗ್ರಾಮವನ್ನು ನಮೂದಿಸಿ.'),
    'VALIDATION_ERROR': ('Check the supplied values.', 'ನಮೂದಿಸಿದ ಮೌಲ್ಯಗಳನ್ನು ಪರಿಶೀಲಿಸಿ.'),
    'VAL_MOBILE': ('Enter a valid mobile number.', 'ಸರಿಯಾದ ಮೊಬೈಲ್ ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ.'),
    'UNAUTHENTICATED': ('Log in again.', 'ಮತ್ತೆ ಲಾಗಿನ್ ಮಾಡಿ.'),
    'FORBIDDEN': ('Access denied.', 'ಪ್ರವೇಶ ನಿರಾಕರಿಸಲಾಗಿದೆ.'),
    'NOT_FOUND': ('Record not found.', 'ದಾಖಲೆ ಕಂಡುಬಂದಿಲ್ಲ.'),
    'AUTH_LOCKED': ('Too many attempts. Try again later.', 'ಹೆಚ್ಚು ಪ್ರಯತ್ನಗಳಾಗಿವೆ. ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.'),
    'AUTH_RATE_LIMITED': ('Wait before requesting another OTP.', 'ಮತ್ತೊಂದು OTP ಕೇಳುವ ಮೊದಲು ಕಾಯಿರಿ.'),
    'OTP_INVALID': ('Incorrect OTP.', 'ತಪ್ಪಾದ OTP.'),
    'OTP_EXPIRED': ('OTP expired. Request another.', 'OTP ಅವಧಿ ಮುಗಿದಿದೆ. ಮತ್ತೊಂದು ಕೇಳಿ.'),
    'OTP_FAILED': ('Unable to send OTP. Please retry.', 'OTP ಕಳುಹಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.'),
    'VAL_DISTRICT': ('Choose a configured pilot district.', 'ನಿಗದಿತ ಪ್ರಾಯೋಗಿಕ ಜಿಲ್ಲೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ.'),
    'VAL_FARM_AREA': ('Farm area is outside the allowed range.', 'ಜಮೀನಿನ ವಿಸ್ತೀರ್ಣವು ಅನುಮತಿಸಿದ ಮಿತಿಯಲ್ಲಿಲ್ಲ.'),
    'VAL_CROP': ('Choose an active crop, variety and grade.', 'ಸಕ್ರಿಯ ಬೆಳೆ, ತಳಿ ಮತ್ತು ದರ್ಜೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ.'),
    'VAL_HARVEST_DATE': ('Choose the date you harvested, within the past year and no later than today.', 'ಕೊಯ್ಲು ಕಳೆದ ಒಂದು ವರ್ಷದೊಳಗೆ ಆಗಿರಬೇಕು.'),
    'VAL_SALE_DATE': ('Check the latest sale date.', 'ಕೊನೆಯ ಮಾರಾಟ ದಿನಾಂಕವನ್ನು ಪರಿಶೀಲಿಸಿ.'),
    'VAL_CASH_DEADLINE': ('Cash deadline cannot be in the past.', 'ಹಣ ಬೇಕಾಗುವ ದಿನಾಂಕ ಹಿಂದಿನದಾಗಿರಬಾರದು.'),
    'VAL_QUANTITY': ('Enter a valid positive quantity.', 'ಸರಿಯಾದ ಧನಾತ್ಮಕ ಪ್ರಮಾಣವನ್ನು ನಮೂದಿಸಿ.'),
    'HIGH_QUANTITY_CONFIRMATION_REQUIRED': ('Quantity is unusually high for this area. Confirm to continue.', 'ಈ ವಿಸ್ತೀರ್ಣಕ್ಕೆ ಪ್ರಮಾಣವು ಹೆಚ್ಚಾಗಿದೆ. ಮುಂದುವರಿಯಲು ದೃಢೀಕರಿಸಿ.'),
    'PILOT_NOT_CONFIGURED': ('Pilot districts have not been configured.', 'ಪ್ರಾಯೋಗಿಕ ಜಿಲ್ಲೆಗಳನ್ನು ನಿಗದಿಪಡಿಸಿಲ್ಲ.'),
    'CROPS_NOT_CONFIGURED': ('Crop settings have not been configured.', 'ಬೆಳೆಯ ಸೆಟ್ಟಿಂಗ್‌ಗಳನ್ನು ನಿಗದಿಪಡಿಸಿಲ್ಲ.'),
    'BAG_WEIGHT_NOT_CONFIGURED': ('Bag weight has not been configured.', 'ಚೀಲದ ತೂಕವನ್ನು ನಿಗದಿಪಡಿಸಿಲ್ಲ.'),
}


def error(request, code, status):
    language = request.headers.get('accept-language', 'en').split(',')[0].split('-')[0].split(';')[0].strip()
    messages = MESSAGES.get(code, MESSAGES['VALIDATION_ERROR'])
    return JSONResponse(status_code=status, content={'code': code, 'message': messages[language == 'kn']})


@app.exception_handler(HTTPException)
async def http_error(request: Request, exc: HTTPException):
    code = exc.detail.get('code', 'VALIDATION_ERROR') if isinstance(exc.detail, dict) else 'VALIDATION_ERROR'
    return error(request, code, exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    # Never echo validation input: it can contain phone numbers or OTPs.
    code = 'VAL_MOBILE' if any(e['loc'][-1] == 'phone' for e in exc.errors()) else 'VALIDATION_ERROR'
    return error(request, code, 400)


@app.middleware('http')
async def transport_security(request: Request, call_next):
    # Terminate TLS at a trusted reverse proxy; configure uvicorn's trusted proxy IPs.
    if settings().environment == 'production' and request.url.scheme != 'https':
        return JSONResponse(status_code=400, content={'code': 'HTTPS_REQUIRED'})
    response = await call_next(request)
    response.headers['Cache-Control'] = 'no-store'
    if settings().environment == 'production':
        response.headers['Strict-Transport-Security'] = 'max-age=31536000'
    return response
