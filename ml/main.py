from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import numpy as np

app = FastAPI(title="KAVACH ML Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Request / Response models ────────────────────────────────────────────────
class PredictRequest(BaseModel):
    worker_id:     str
    weekly_income: float
    city:          str
    zone:          str
    window_start:  str
    window_end:    str
    platforms:     List[str]

class PredictResponse(BaseModel):
    worker_id:          str
    predicted_earnings: float
    window_hours:       float
    confidence:         float

class PremiumRequest(BaseModel):
    weekly_income:    float
    zone_risk_factor: float
    city:             str
    claims_free_weeks: int
    tier:             str

# ─── Peak hour config ─────────────────────────────────────────────────────────
PEAK_HOURS = {
    "zomato": [(12, 14, 1.4), (19, 22, 1.5), (8, 10, 0.8)],
    "swiggy": [(12, 14, 1.3), (19, 22, 1.5), (15, 17, 0.9)],
    "blinkit": [(9, 21, 1.0)],
}

DAY_MULTIPLIERS = {0: 1.2, 1: 0.85, 2: 0.85, 3: 0.90, 4: 0.95, 5: 1.15, 6: 1.3}

SEASON_MULTIPLIERS = {
    "chennai":   {"ne_monsoon": (10, 12, 1.45), "sw_monsoon": (6, 9, 1.20), "default": 0.80},
    "mumbai":    {"sw_monsoon": (6, 9, 1.55), "default": 0.80},
    "delhi":     {"smog": (11, 2, 1.20), "default": 0.80},
    "bengaluru": {"ne_monsoon": (10, 12, 1.45), "sw_monsoon": (6, 9, 1.20), "default": 0.80},
}

def get_hour_multiplier(hour: int, platform: str) -> float:
    peaks = PEAK_HOURS.get(platform, PEAK_HOURS["zomato"])
    for start, end, mult in peaks:
        if start <= hour < end:
            return mult
    return 0.6

def get_season_multiplier(city: str, month: int) -> float:
    seasons = SEASON_MULTIPLIERS.get(city, {})
    for key, (start, end, mult) in seasons.items():
        if key == "default":
            continue
        if start <= month <= end:
            return mult
    return seasons.get("default", 0.80)

def predict_earnings_rule_based(
    weekly_income: float,
    city: str,
    platform: str,
    window_start: datetime,
    window_end: datetime,
) -> float:
    daily_base  = weekly_income / 6
    hourly_base = daily_base / 10
    hours       = max(0.5, (window_end - window_start).total_seconds() / 3600)
    day_mult    = DAY_MULTIPLIERS.get(window_start.weekday(), 1.0)
    hour_mult   = get_hour_multiplier(window_start.hour, platform)
    season_mult = get_season_multiplier(city, window_start.month)
    predicted   = hourly_base * hours * day_mult * hour_mult
    return max(50.0, round(predicted, 2))

# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "kavach-ml"}

@app.post("/predict", response_model=PredictResponse)
def predict_earnings(req: PredictRequest):
    try:
        window_start = datetime.fromisoformat(req.window_start.replace("Z", "+00:00"))
        window_end   = datetime.fromisoformat(req.window_end.replace("Z", "+00:00"))
    except Exception:
        window_start = datetime.utcnow()
        window_end   = datetime.utcnow()

    platform = req.platforms[0] if req.platforms else "zomato"
    hours    = max(0.5, (window_end - window_start).total_seconds() / 3600)

    predicted = predict_earnings_rule_based(
        weekly_income=req.weekly_income,
        city=req.city,
        platform=platform,
        window_start=window_start,
        window_end=window_end,
    )

    return PredictResponse(
        worker_id=req.worker_id,
        predicted_earnings=predicted,
        window_hours=round(hours, 2),
        confidence=0.82,
    )

@app.post("/premium")
def calculate_premium_ml(req: PremiumRequest):
    """
    ML-enhanced premium calculation.
    In production: XGBoost model trained on historical claims data.
    For now: enhanced rule-based with seasonal awareness.
    """
    income       = req.weekly_income
    zone_factor  = req.zone_risk_factor
    city         = req.city
    cf_weeks     = req.claims_free_weeks
    tier         = req.tier

    # Base rate
    if income <= 3500:   base_rate = 0.0085
    elif income <= 5500: base_rate = 0.0080
    elif income <= 8000: base_rate = 0.0075
    else:                base_rate = 0.0070

    month           = datetime.utcnow().month
    season_mult     = get_season_multiplier(city, month)
    base_amount     = income * base_rate
    after_zone      = base_amount * zone_factor
    after_season    = after_zone * season_mult
    discount        = 0.15 if cf_weeks >= 8 else 0.08 if cf_weeks >= 4 else 0
    after_discount  = after_season * (1 - discount)
    surge           = 14 if zone_factor >= 1.3 and season_mult >= 1.45 else 8 if zone_factor >= 1.3 or season_mult >= 1.45 else 0
    tier_mult       = 0.70 if tier == "basic" else 1.35 if tier == "premium" else 1.0
    coverage_pct    = 0.50 if tier == "basic" else 0.85 if tier == "premium" else 0.70
    final_amount    = max(15, round((after_discount + surge) * tier_mult))
    max_payout      = round(income * coverage_pct)

    return {
        "final_amount":    final_amount,
        "max_payout":      max_payout,
        "coverage_pct":    coverage_pct,
        "season_mult":     season_mult,
        "surge_loading":   surge,
        "discount_pct":    discount,
    }

@app.get("/zone-risk/{city}/{zone}")
def get_zone_risk(city: str, zone: str):
    """Zone risk scoring — in production: ML model on historical flood/rain data"""
    high_risk = ["marina", "adyar", "dharavi", "kurla", "fort", "colaba"]
    low_risk  = ["tambaram", "whitefield", "electronic_city", "noida", "dwarka"]
    zone_key  = zone.lower().replace(" ", "_")

    if any(h in zone_key for h in high_risk):
        risk = 1.30
    elif any(l in zone_key for l in low_risk):
        risk = 0.85
    else:
        risk = 1.0

    return {"city": city, "zone": zone, "risk_factor": risk, "classification": "high" if risk >= 1.3 else "low" if risk <= 0.85 else "moderate"}
