"""
KAVACH ML Model Trainer (v2)
=============================
Trains a stacked XGBoost + LightGBM + Ridge ensemble.
New features derived from the Kaggle delivery-time schema:
  - Time_taken_min → orders_per_hour → hourly_earnings
  - Weatherconditions, Road_traffic_density, Festival as real signals
  - City type (Metropolitian/Urban/Semi-Urban) as Kaggle uses it
"""

import os, sys, json, warnings
import numpy as np
import pandas as pd
import joblib
from datetime import datetime

from sklearn.model_selection import KFold
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import xgboost as xgb
import lightgbm as lgb

warnings.filterwarnings("ignore")
SEED = 42

ARTIFACTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts")
os.makedirs(ARTIFACTS_DIR, exist_ok=True)

# ── Encodings (matching Kaggle values) ───────────────────────────────────────
WEATHER_ENC = {"Sunny":0,"Cloudy":1,"Windy":2,"Fog":3,"Sandstorms":4,"Stormy":5}
TRAFFIC_ENC = {"Low":0,"Medium":1,"High":2,"Jam":3}
CITY_ENC    = {"Semi-Urban":0,"Urban":1,"Metropolitian":2}
VEHICLE_ENC = {"bicycle":0,"electric_scooter":1,"scooter":2,"motorcycle":3}
ORDER_ENC   = {"Snack":0,"Drinks":1,"Buffet":2,"Meal":3}
PLATFORM_ENC= {"swiggy":0,"zomato":1}

HOUR_DEMAND = {
     0:0.30, 1:0.22, 2:0.18, 3:0.14, 4:0.17,
     5:0.30, 6:0.50, 7:0.70, 8:0.95, 9:1.05,
    10:0.92,11:1.08,12:1.48,13:1.50,14:1.22,
    15:0.95,16:0.92,17:1.08,18:1.45,19:1.62,
    20:1.65,21:1.42,22:1.00,23:0.55,
}


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    # Parse datetimes
    df["window_start"] = pd.to_datetime(df["window_start"])
    df["window_end"]   = pd.to_datetime(df["window_end"])

    if "window_hours" not in df.columns:
        df["window_hours"] = ((df["window_end"]-df["window_start"])
                              .dt.total_seconds()/3600).clip(0.5,12)
    if "start_hour" not in df.columns:
        df["start_hour"] = df["window_start"].dt.hour
    if "is_weekend" not in df.columns:
        df["is_weekend"] = (df["window_start"].dt.dayofweek>=5).astype(int)
    if "day_of_week" not in df.columns:
        df["day_of_week"] = df["window_start"].dt.dayofweek

    # Encode Kaggle categorical columns
    df["weather_enc"]  = df["Weatherconditions"].map(WEATHER_ENC).fillna(0).astype(int)
    df["traffic_enc"]  = df["Road_traffic_density"].map(TRAFFIC_ENC).fillna(1).astype(int)
    df["city_enc"]     = df["City"].map(CITY_ENC).fillna(1).astype(int)
    df["vehicle_enc"]  = df["Type_of_vehicle"].map(VEHICLE_ENC).fillna(2).astype(int)
    df["order_enc"]    = df["Type_of_order"].map(ORDER_ENC).fillna(3).astype(int)
    df["platform_enc"] = df["platform"].map(PLATFORM_ENC).fillna(0).astype(int)
    df["is_festival"]  = (df["Festival"]=="Yes").astype(int)
    df["is_zomato"]    = (df["platform"]=="zomato").astype(int)
    df["is_swiggy"]    = (df["platform"]=="swiggy").astype(int)

    # Core Kaggle-derived signals
    df["time_taken_min"]      = pd.to_numeric(df["Time_taken_min"], errors="coerce").fillna(35)
    df["delivery_rating"]     = pd.to_numeric(df["Delivery_person_Ratings"], errors="coerce").fillna(4.0)
    df["multiple_deliveries"] = pd.to_numeric(df["multiple_deliveries"], errors="coerce").fillna(0)
    df["person_age"]          = pd.to_numeric(df["Delivery_person_Age"], errors="coerce").fillna(28)

    # Orders per hour from delivery time (KEY derived feature)
    df["orders_per_hour"] = (60.0 / (df["time_taken_min"] + 15.0)).clip(0.5, 3.5)

    # Time features
    df["hour_demand"]     = df["start_hour"].map(HOUR_DEMAND).fillna(1.0)
    df["is_peak_lunch"]   = ((df["start_hour"]>=12)&(df["start_hour"]<=14)).astype(int)
    df["is_peak_dinner"]  = ((df["start_hour"]>=18)&(df["start_hour"]<=21)).astype(int)
    df["is_peak_morning"] = ((df["start_hour"]>=8) &(df["start_hour"]<=10)).astype(int)
    df["is_night"]        = ((df["start_hour"]>=22)|(df["start_hour"]<=4)).astype(int)

    df["hour_sin"] = np.sin(2*np.pi*df["start_hour"]/24)
    df["hour_cos"] = np.cos(2*np.pi*df["start_hour"]/24)
    df["dow_sin"]  = np.sin(2*np.pi*df["day_of_week"]/7)
    df["dow_cos"]  = np.cos(2*np.pi*df["day_of_week"]/7)

    # Income features
    df["hourly_base"]  = df["weekly_income"] / 48.0
    df["income_log"]   = np.log1p(df["weekly_income"])

    # Location
    df["city_base_payout"] = df["city_enc"].map({0:42.0,1:55.0,2:68.0})
    if "zone_multiplier" not in df.columns:
        df["zone_multiplier"] = 1.0

    # Weather/traffic severity scores
    df["weather_severity"] = df["weather_enc"] / 5.0
    df["traffic_severity"] = df["traffic_enc"] / 3.0

    # Interaction features
    df["time_x_traffic"]       = df["time_taken_min"] * df["traffic_severity"]
    df["time_x_weather"]       = df["time_taken_min"] * df["weather_severity"]
    df["orders_x_demand"]      = df["orders_per_hour"] * df["hour_demand"]
    df["income_x_orders"]      = df["hourly_base"] * df["orders_per_hour"]
    df["income_x_demand"]      = df["hourly_base"] * df["hour_demand"]
    df["income_x_city"]        = df["hourly_base"] * df["city_base_payout"] / 55.0
    df["income_x_zone"]        = df["hourly_base"] * df["zone_multiplier"]
    df["demand_x_window"]      = df["hour_demand"] * df["window_hours"]
    df["orders_x_window"]      = df["orders_per_hour"] * df["window_hours"]
    df["rating_x_income"]      = df["delivery_rating"] * df["hourly_base"]
    df["multi_x_earnings"]     = df["multiple_deliveries"] * df["hourly_base"]
    df["festival_x_demand"]    = df["is_festival"] * df["hour_demand"]
    df["expected_base"]        = (df["hourly_base"] * df["window_hours"]
                                   * df["zone_multiplier"] * df["hour_demand"])
    return df


FEATURE_COLS = [
    # Income
    "weekly_income","income_log","hourly_base",
    # Window
    "window_hours","start_hour",
    # Time features
    "is_weekend","day_of_week",
    "hour_sin","hour_cos","dow_sin","dow_cos",
    "hour_demand","is_peak_lunch","is_peak_dinner","is_peak_morning","is_night",
    # Kaggle delivery-time signals
    "time_taken_min","orders_per_hour","delivery_rating",
    "multiple_deliveries","person_age",
    "weather_enc","traffic_enc","weather_severity","traffic_severity",
    "is_festival",
    # Platform
    "platform_enc","is_zomato","is_swiggy",
    # Vehicle & order type
    "vehicle_enc","order_enc",
    # Location
    "city_enc","city_base_payout","zone_multiplier",
    # Interactions
    "time_x_traffic","time_x_weather",
    "orders_x_demand","income_x_orders","income_x_demand",
    "income_x_city","income_x_zone",
    "demand_x_window","orders_x_window",
    "rating_x_income","multi_x_earnings",
    "festival_x_demand","expected_base",
]


def train(data_path: str):
    print("="*60)
    print("KAVACH ML Model Training (v2 — delivery-time integration)")
    print("="*60)

    df = pd.read_csv(data_path)
    print(f"Loaded {len(df):,} samples | columns: {list(df.columns)}")

    df = engineer_features(df)
    X  = df[FEATURE_COLS].fillna(0).values.astype(np.float32)
    y  = df["predicted_earnings"].values
    print(f"Features: {len(FEATURE_COLS)} | Target range: ₹{y.min():.0f}–₹{y.max():.0f}")

    kf = KFold(n_splits=5, shuffle=True, random_state=SEED)
    xgb_oof = np.zeros(len(X))
    lgb_oof = np.zeros(len(X))
    xgb_models, lgb_models = [], []

    xgb_params = dict(n_estimators=900,learning_rate=0.04,max_depth=7,
                      subsample=0.8,colsample_bytree=0.8,min_child_weight=3,
                      reg_alpha=0.1,reg_lambda=1.5,random_state=SEED,
                      n_jobs=-1,verbosity=0)
    lgb_params = dict(n_estimators=900,learning_rate=0.04,max_depth=7,
                      subsample=0.8,colsample_bytree=0.8,min_child_samples=20,
                      reg_alpha=0.1,reg_lambda=1.5,random_state=SEED,
                      n_jobs=-1,verbosity=-1)

    for fold,(tr_idx,val_idx) in enumerate(kf.split(X),1):
        xm = xgb.XGBRegressor(**xgb_params)
        xm.fit(X[tr_idx], y[tr_idx])
        xgb_oof[val_idx] = xm.predict(X[val_idx])
        xgb_models.append(xm)

        lm = lgb.LGBMRegressor(**lgb_params)
        lm.fit(X[tr_idx], y[tr_idx])
        lgb_oof[val_idx] = lm.predict(X[val_idx])
        lgb_models.append(lm)

        fold_mae = mean_absolute_error(y[val_idx],
                   (xgb_oof[val_idx]+lgb_oof[val_idx])/2)
        print(f"  Fold {fold} MAE: ₹{fold_mae:.2f}")

    # Meta-learner
    oof_stack = np.column_stack([xgb_oof, lgb_oof])
    meta = Ridge(alpha=1.0)
    meta.fit(oof_stack, y)
    final_pred = meta.predict(oof_stack)

    mae  = mean_absolute_error(y, final_pred)
    rmse = np.sqrt(mean_squared_error(y, final_pred))
    r2   = r2_score(y, final_pred)
    mape = np.mean(np.abs((y - final_pred) / np.clip(y, 1.0, None))) * 100

    print(f"\n── OOF Metrics ─────────────────────────────")
    print(f"  MAE  : ₹{mae:.2f}")
    print(f"  RMSE : ₹{rmse:.2f}")
    print(f"  R²   : {r2:.4f}")
    print(f"  MAPE : {mape:.2f}%")

    # Retrain on full data
    print("\nRetraining on full data for deployment...")
    xgb_f = xgb.XGBRegressor(**xgb_params); xgb_f.fit(X, y)
    lgb_f = lgb.LGBMRegressor(**lgb_params); lgb_f.fit(X, y)
    stack_f = np.column_stack([xgb_f.predict(X), lgb_f.predict(X)])
    meta_f = Ridge(alpha=1.0); meta_f.fit(stack_f, y)

    residual_std = float(np.std(np.abs(oof_stack.mean(axis=1) - y)))

    joblib.dump(xgb_f,  os.path.join(ARTIFACTS_DIR,"xgb_model.pkl"))
    joblib.dump(lgb_f,  os.path.join(ARTIFACTS_DIR,"lgb_model.pkl"))
    joblib.dump(meta_f, os.path.join(ARTIFACTS_DIR,"meta_model.pkl"))

    meta_info = {
        "feature_cols": FEATURE_COLS,
        "oof_mae": round(mae,4),
        "oof_rmse": round(rmse,4),
        "oof_r2": round(r2,4),
        "oof_mape": round(mape,4),
        "residual_std": round(residual_std,4),
        "n_samples": len(df),
        "trained_at": datetime.utcnow().isoformat(),
        "version": "v2-delivery-time-integration",
        "data_sources": [
            "Kaggle food-delivery schema (Weatherconditions, Road_traffic_density, Time_taken_min, City, Festival, multiple_deliveries)",
            "IDInsight 2024 Indian gig worker earnings study",
            "Real Zomato/Swiggy peak-hour demand curves"
        ]
    }
    with open(os.path.join(ARTIFACTS_DIR,"meta.json"),"w") as f:
        json.dump(meta_info, f, indent=2)

    print(f"\n✓ Artifacts saved to ./artifacts/")
    return meta_info


if __name__ == "__main__":
    _here = os.path.dirname(os.path.abspath(__file__))
    data_path = sys.argv[1] if len(sys.argv)>1 else os.path.join(_here, "training_data.csv")
    if not os.path.exists(data_path):
        print("Generating training data first...")
        from generate_data import generate_dataset
        df = generate_dataset(60000)
        df.to_csv(data_path, index=False)
    train(data_path)