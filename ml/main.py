"""
KAVACH ML Service v2 — main.py
================================
FastAPI service predicting expected gig worker earnings over a disruption
window. Uses delivery-time-derived features from the Kaggle schema.

POST /predict   → single prediction
POST /predict/batch → batch (≤100)
GET  /health    → status
"""

import os, json, logging
import numpy as np
import pandas as pd
import joblib
from datetime import datetime
from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("kavach-ml")

BASE_DIR      = os.path.dirname(os.path.abspath(__file__))
ARTIFACTS_DIR = os.path.join(BASE_DIR, "artifacts")

logger.info("Loading model artifacts...")
xgb_model  = joblib.load(os.path.join(ARTIFACTS_DIR, "xgb_model.pkl"))
lgb_model  = joblib.load(os.path.join(ARTIFACTS_DIR, "lgb_model.pkl"))
meta_model = joblib.load(os.path.join(ARTIFACTS_DIR, "meta_model.pkl"))
with open(os.path.join(ARTIFACTS_DIR, "meta.json")) as f:
    MODEL_META = json.load(f)

FEATURE_COLS  = MODEL_META["feature_cols"]
RESIDUAL_STD  = MODEL_META["residual_std"]
logger.info(f"Model v2 loaded. OOF MAE=₹{MODEL_META['oof_mae']} R²={MODEL_META['oof_r2']}")

from train import engineer_features

app = FastAPI(title="KAVACH ML Service v2",
              description="Predicts expected gig worker earnings over a disruption window",
              version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

# Defaults used when Kaggle fields are not available (inference from worker history)
DEFAULT_WEATHER   = "Sunny"
DEFAULT_TRAFFIC   = "Medium"
DEFAULT_VEHICLE   = "motorcycle"
DEFAULT_ORDER     = "Meal"
DEFAULT_AGE       = 28
DEFAULT_RATING    = 4.0
DEFAULT_MULTI     = 1


class PredictRequest(BaseModel):
    worker_id:    str   = Field(..., example="abc123")
    weekly_income: float = Field(..., ge=0, example=6000)
    city:         str   = Field(..., example="Urban")
    zone:         str   = Field(..., example="adyar")
    window_start: str   = Field(..., example="2026-04-02T19:00:00.000Z")
    window_end:   str   = Field(..., example="2026-04-02T21:00:00.000Z")
    platforms:    List[str] = Field(..., example=["zomato"])
    # Optional Kaggle-schema enrichments (improve accuracy when available)
    weather_condition:    str   = Field(DEFAULT_WEATHER, example="Sunny")
    road_traffic_density: str   = Field(DEFAULT_TRAFFIC, example="Medium")
    delivery_rating:      float = Field(DEFAULT_RATING,  example=4.2)
    multiple_deliveries:  int   = Field(DEFAULT_MULTI,   example=1)
    vehicle_type:         str   = Field(DEFAULT_VEHICLE, example="motorcycle")
    delivery_person_age:  int   = Field(DEFAULT_AGE,     example=28)
    is_festival:          bool  = Field(False,            example=False)

    @validator("platforms")
    def clean_platforms(cls, v):
        return [p.lower().strip() for p in v if p.strip()]


class PredictResponse(BaseModel):
    worker_id:          str
    predicted_earnings: float
    window_hours:       float
    confidence:         float
    city:               str
    zone:               str
    platform:           str
    window_start:       str
    window_end:         str
    orders_per_hour_estimate: float


class BatchPredictRequest(BaseModel):
    requests: List[PredictRequest]

class BatchPredictResponse(BaseModel):
    results: List[PredictResponse]

_SERVICE_START = datetime.utcnow().isoformat()

CITY_MAP = {
    # Onboarding cities mapped to the city buckets used by the ML training data
    "mumbai": "Metropolitian",
    "delhi": "Metropolitian",
    "bengaluru": "Metropolitian",
    "bangalore": "Metropolitian",
    "kolkata": "Metropolitian",
    "chennai": "Urban",
    "hyderabad": "Urban",
    "pune": "Urban",
    "ahmedabad": "Urban",
    "surat": "Urban",
    "lucknow": "Urban",
    "kochi": "Urban",
    "coimbatore": "Urban",
    "indore": "Urban",
    "nagpur": "Urban",
    "chandigarh": "Semi-Urban",
    "jaipur": "Semi-Urban",
    "metropolitian": "Metropolitian",
    "urban": "Urban",
    "semi-urban": "Semi-Urban",
    "metro": "Metropolitian",
}

ZONE_MULT = {
    # Chennai
    "anna_nagar": 1.10, "t_nagar": 1.20, "adyar": 1.15, "marina": 1.22,
    "tambaram": 0.90, "velachery": 1.05, "sholinganallur": 1.08, "porur": 0.95,
    "ambattur": 0.92, "perungudi": 1.04,

    # Mumbai
    "bandra": 1.30, "andheri": 1.25, "dharavi": 1.18, "kurla": 1.16,
    "dadar": 1.20, "borivali": 0.98, "worli": 1.35, "colaba": 1.32,
    "powai": 1.08, "vikhroli": 1.02,

    # Delhi
    "connaught_place": 1.40, "lajpat_nagar": 1.12, "dwarka": 0.94, "rohini": 0.96,
    "saket": 1.20, "noida_sec_62": 1.05, "karol_bagh": 1.10, "janakpuri": 0.95,
    "pitampura": 0.97, "vasant_kunj": 1.08,

    # Bengaluru
    "koramangala": 1.40, "indiranagar": 1.35, "whitefield": 1.15, "hsr_layout": 1.30,
    "electronic_city": 1.05, "mg_road": 1.28, "jayanagar": 1.12, "marathahalli": 1.10,
    "hebbal": 1.08, "yelahanka": 0.95,

    # Hyderabad
    "gachibowli": 1.25, "hitec_city": 1.30, "banjara_hills": 1.35, "jubilee_hills": 1.32,
    "uppal": 0.96, "secunderabad": 1.06, "kukatpally": 1.02, "madhapur": 1.24,
    "ameerpet": 1.10, "lb_nagar": 0.94,

    # Pune
    "hinjewadi": 1.14, "magarpatta": 1.16, "koregaon_park": 1.22, "viman_nagar": 1.10,
    "kothrud": 1.02, "wakad": 1.05, "baner": 1.08, "hadapsar": 1.04,
    "pimpri": 0.96, "chinchwad": 0.95,

    # Kolkata
    "salt_lake": 1.12, "new_town": 1.14, "park_street": 1.24, "howrah": 1.02,
    "dum_dum": 0.98, "behala": 0.97, "jadavpur": 1.00, "garia": 0.94,
    "rajarhat": 1.10, "ballygunge": 1.18,

    # Ahmedabad
    "navrangpura": 1.12, "satellite": 1.10, "bopal": 0.98, "prahlad_nagar": 1.08,
    "maninagar": 1.00, "vastrapur": 1.06, "gota": 0.94, "chandkheda": 0.93,
    "thaltej": 1.05, "bodakdev": 1.14,

    # Jaipur
    "malviya_nagar": 1.04, "vaishali_nagar": 1.02, "c-scheme": 1.15, "mansarovar": 0.98,
    "tonk_road": 1.06, "sirsi_road": 0.94, "sodala": 0.97, "jagatpura": 0.96,
    "sanganer": 0.92, "pratap_nagar": 0.95,

    # Lucknow
    "gomti_nagar": 1.10, "hazratganj": 1.18, "aliganj": 0.98, "indira_nagar": 0.99,
    "alambagh": 0.95, "rajajipuram": 0.92, "vikas_nagar": 0.94, "chinhat": 0.96,
    "sushant_golf_city": 1.06, "mahanagar": 1.00,

    # Surat
    "vesu": 1.08, "adajan": 1.02, "piplod": 1.10, "pal": 0.98,
    "athwa": 1.05, "varachha": 0.97, "katargam": 0.95, "udhna": 0.94,
    "rander": 0.96, "althan": 1.04,

    # Kochi
    "kakkanad": 1.08, "edapally": 1.10, "aluva": 0.96, "fort_kochi": 1.06,
    "thrippunithura": 0.98, "kalamassery": 1.02, "perumbavoor": 0.92, "angamaly": 0.91,
    "vyttila": 1.04, "palarivattom": 1.03,

    # Chandigarh tri-city
    "sector_17": 1.14, "sector_22": 1.08, "sector_35": 1.10, "mohali_phase_7": 1.06,
    "panchkula_sec_20": 0.98, "manimajra": 0.96, "it_park": 1.12, "sector_43": 1.00,
    "zirakpur": 0.95, "kharar": 0.92,

    # Indore
    "vijay_nagar": 1.12, "palasia": 1.08, "rajwada": 1.04, "super_corridor": 1.06,
    "ab_road": 1.02, "bhawarkua": 1.00, "scheme_54": 1.05, "niranjanpur": 0.97,
    "rau": 0.92, "sanwer_road": 0.94,

    # Nagpur
    "dharampeth": 1.06, "sitabuldi": 1.10, "sadar": 1.04, "wardha_road": 1.02,
    "amravati_road": 0.97, "hingna": 0.93, "manish_nagar": 0.98, "pratap_nagar": 1.00,
    "trimurti_nagar": 0.99, "besa": 0.94,

    # Coimbatore
    "gandhipuram": 1.08, "rs_puram": 1.12, "saibaba_colony": 1.04, "singanallur": 0.98,
    "peelamedu": 1.06, "kuniyamuthur": 0.92, "vadavalli": 0.95, "hopes_college": 1.00,
    "ukkadam": 0.97, "podanur": 0.93,
}


def _predict_single(req: PredictRequest) -> PredictResponse:
    try:
        city_type = CITY_MAP.get(req.city.lower().strip(), "Urban")
        zone_mult = ZONE_MULT.get(req.zone.lower().strip().replace(" ","_"), 1.0)
        platform  = req.platforms[0] if req.platforms else "zomato"

        row = {
            "worker_id":             req.worker_id,
            "weekly_income":         req.weekly_income,
            "City":                  city_type,
            "Weatherconditions":     req.weather_condition,
            "Road_traffic_density":  req.road_traffic_density,
            "Festival":              "Yes" if req.is_festival else "No",
            "multiple_deliveries":   req.multiple_deliveries,
            "Delivery_person_Ratings": req.delivery_rating,
            "Delivery_person_Age":   req.delivery_person_age,
            "Type_of_vehicle":       req.vehicle_type,
            "Type_of_order":         DEFAULT_ORDER,
            "platform":              platform,
            "window_start":          req.window_start,
            "window_end":            req.window_end,
            "zone_multiplier":       zone_mult,
            # Estimate delivery time from traffic + weather (used when not provided)
            "Time_taken_min":        _estimate_delivery_time(
                                         req.road_traffic_density,
                                         req.weather_condition,
                                         req.window_start),
            "Time_Orderd":           req.window_start,
            "Time_Order_picked":     req.window_start,
        }

        df = pd.DataFrame([row])
        df = engineer_features(df)
        for col in FEATURE_COLS:
            if col not in df.columns:
                df[col] = 0.0

        X = df[FEATURE_COLS].fillna(0).values.astype(np.float32)
        xp = float(xgb_model.predict(X)[0])
        lp = float(lgb_model.predict(X)[0])
        pred = float(max(0.0, meta_model.predict([[xp,lp]])[0]))
        pred = round(pred, 2)

        window_hours = float(df["window_hours"].iloc[0])
        orders_ph    = float(df["orders_per_hour"].iloc[0])

        confidence = float(np.clip(1.0 - RESIDUAL_STD/(pred+1e-6), 0.50, 0.99))
        if city_type == "Urban" and req.city.lower() not in CITY_MAP:
            confidence *= 0.92
        confidence = round(confidence, 4)

        return PredictResponse(
            worker_id=req.worker_id,
            predicted_earnings=pred,
            window_hours=round(window_hours,2),
            confidence=confidence,
            city=req.city,
            zone=req.zone,
            platform=platform,
            window_start=req.window_start,
            window_end=req.window_end,
            orders_per_hour_estimate=round(orders_ph,2),
        )
    except Exception as e:
        logger.error(f"Prediction error for {req.worker_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _estimate_delivery_time(traffic: str, weather: str, window_start: str) -> float:
    TRAFFIC_PENALTY = {"Low":0,"Medium":5,"High":10,"Jam":18}
    WEATHER_PENALTY = {"Sunny":0,"Cloudy":2,"Windy":4,"Fog":7,"Sandstorms":9,"Stormy":14}
    try:
        hour = pd.to_datetime(window_start).hour
    except Exception:
        hour = 12
    BASE = {0:28,1:25,2:24,3:23,4:24,5:27,6:29,7:32,8:34,9:35,
            10:33,11:36,12:38,13:38,14:35,15:32,16:31,17:34,18:36,
            19:37,20:36,21:34,22:31,23:29}
    return float(np.clip(
        BASE.get(hour,35)
        + TRAFFIC_PENALTY.get(traffic,5)
        + WEATHER_PENALTY.get(weather,0),
        10, 80
    ))


@app.get("/health")
def health():
    return {
        "status": "ok",
        "version": MODEL_META.get("version","v2"),
        "oof_mae": MODEL_META["oof_mae"],
        "oof_r2":  MODEL_META["oof_r2"],
        "data_sources": MODEL_META.get("data_sources",[]),
        "trained_at":   MODEL_META["trained_at"],
        "uptime_since": _SERVICE_START,
    }

@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    logger.info(f"Predict | worker={req.worker_id} city={req.city} "
                f"income={req.weekly_income} platforms={req.platforms} "
                f"weather={req.weather_condition} traffic={req.road_traffic_density}")
    return _predict_single(req)

@app.post("/predict/batch", response_model=BatchPredictResponse)
def predict_batch(batch: BatchPredictRequest):
    if len(batch.requests) > 100:
        raise HTTPException(400, "Batch size limit is 100")
    return BatchPredictResponse(results=[_predict_single(r) for r in batch.requests])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5001, reload=False)
