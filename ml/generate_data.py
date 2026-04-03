"""
KAVACH — Data Generator (v2)
==============================
Mirrors the exact Kaggle food-delivery schema, then derives earnings
from delivery time + peak hour logic.

Key idea:
  earnings_per_order = base_payout × demand_mult × weather_mult
                       × traffic_mult × festival_mult × rating_mult
  orders_per_hour    = 60 / (time_taken + pickup_wait + return_buffer)
  hourly_earnings    = earnings_per_order × orders_per_hour
  predicted_earnings = hourly_earnings × window_hours

Ground-truth anchors:
  - IDInsight 2024: Indian delivery workers earn ₹75–170/hr gross
  - Real Kaggle schema: Time_Orderd, Time_taken(min), Weatherconditions,
    Road_traffic_density, City, Festival, multiple_deliveries
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import random

SEED = 42
np.random.seed(SEED)
random.seed(SEED)

CITIES = ["Metropolitian", "Urban", "Semi-Urban"]
CITY_BASE_PAYOUT = {"Metropolitian": 68, "Urban": 55, "Semi-Urban": 42}
PLATFORMS = ["zomato", "swiggy"]

WEATHER_CONDITIONS = ["Sunny", "Cloudy", "Windy", "Fog", "Sandstorms", "Stormy"]
WEATHER_MULTIPLIER = {"Sunny":1.00,"Cloudy":1.02,"Windy":1.05,"Fog":1.12,"Sandstorms":1.18,"Stormy":1.25}
WEATHER_TIME_PENALTY = {"Sunny":0,"Cloudy":2,"Windy":4,"Fog":7,"Sandstorms":9,"Stormy":14}

TRAFFIC_CONDITIONS = ["Low", "Medium", "High", "Jam"]
TRAFFIC_MULTIPLIER = {"Low":1.00,"Medium":1.05,"High":1.10,"Jam":1.20}
TRAFFIC_TIME_PENALTY = {"Low":0,"Medium":5,"High":10,"Jam":18}

ORDER_TYPES = ["Snack", "Meal", "Drinks", "Buffet"]
VEHICLE_TYPES = ["motorcycle", "scooter", "electric_scooter", "bicycle"]

HOUR_DEMAND = {
     0:0.30, 1:0.22, 2:0.18, 3:0.14, 4:0.17,
     5:0.30, 6:0.50, 7:0.70, 8:0.95, 9:1.05,
    10:0.92,11:1.08,12:1.48,13:1.50,14:1.22,
    15:0.95,16:0.92,17:1.08,18:1.45,19:1.62,
    20:1.65,21:1.42,22:1.00,23:0.55,
}

BASE_DELIVERY_TIME = {
     0:28, 1:25, 2:24, 3:23, 4:24,
     5:27, 6:29, 7:32, 8:34, 9:35,
    10:33,11:36,12:38,13:38,14:35,
    15:32,16:31,17:34,18:36,19:37,
    20:36,21:34,22:31,23:29,
}

ZONE_MULTIPLIERS = {
    "Metropolitian": [1.30,1.35,1.25,1.20,1.15,1.40,1.28,1.10],
    "Urban":         [1.15,1.20,1.05,1.10,1.08,1.12,0.95,1.00],
    "Semi-Urban":    [0.90,0.95,1.00,0.88,0.92,0.97,0.85,0.93],
}


def generate_row(worker_id, weekly_income, platform, window_start, window_end, city_type, zone_mult):
    hour       = window_start.hour
    is_weekend = window_start.weekday() >= 5
    festival   = random.random() < 0.08

    weather  = random.choices(WEATHER_CONDITIONS, weights=[40,25,15,8,6,6])[0]
    traffic  = random.choices(TRAFFIC_CONDITIONS, weights=[20,35,30,15])[0]
    vehicle  = random.choices(VEHICLE_TYPES, weights=[45,30,15,10])[0]
    order_t  = random.choices(ORDER_TYPES, weights=[20,50,20,10])[0]
    age      = random.randint(20,45)
    rating   = round(random.uniform(2.5,5.0),1)
    multi    = random.choices([0,1,2,3], weights=[50,30,15,5])[0]

    # Delivery time in minutes (the core Kaggle column)
    time_taken = float(np.clip(
        BASE_DELIVERY_TIME[hour]
        + WEATHER_TIME_PENALTY[weather]
        + TRAFFIC_TIME_PENALTY[traffic]
        + random.gauss(0, 4),
        10, 80
    ))

    pickup_offset = random.randint(5, 12)
    time_order_picked = window_start + timedelta(minutes=pickup_offset)

    # Earnings per order
    earnings_per_order = max(0.0,
        CITY_BASE_PAYOUT[city_type]
        * HOUR_DEMAND[hour]
        * WEATHER_MULTIPLIER[weather]
        * TRAFFIC_MULTIPLIER[traffic]
        * (1.30 if festival else 1.00)
        * float(np.clip(0.85 + (rating - 3.0)*0.10, 0.80, 1.20))   # rating mult
        * float(np.clip(weekly_income / 7000.0, 0.35, 2.5))          # income mult
        * (1.10 if is_weekend else 1.00)
        * zone_mult
        * (1 + multi * 0.15)       # stacked deliveries bonus
        + random.gauss(0, 5)
    )

    # Orders per hour derived from delivery time (the KEY link)
    cycle_minutes = time_taken + pickup_offset + 3.0   # +3 return buffer
    orders_per_hour = float(np.clip(60.0 / cycle_minutes, 0.5, 3.5))

    hourly_earnings  = earnings_per_order * orders_per_hour
    window_hours     = float(np.clip((window_end - window_start).total_seconds()/3600, 0.5, 12))
    predicted_earnings = round(max(0.0, hourly_earnings * window_hours), 2)

    return {
        "Delivery_person_ID":      worker_id,
        "Delivery_person_Age":     age,
        "Delivery_person_Ratings": rating,
        "Time_Orderd":             window_start.strftime("%H:%M:%S"),
        "Time_Order_picked":       time_order_picked.strftime("%H:%M:%S"),
        "Time_taken_min":          round(time_taken, 1),
        "Weatherconditions":       weather,
        "Road_traffic_density":    traffic,
        "City":                    city_type,
        "Festival":                "Yes" if festival else "No",
        "multiple_deliveries":     multi,
        "Type_of_order":           order_t,
        "Type_of_vehicle":         vehicle,
        "platform":                platform,
        "weekly_income":           round(weekly_income, 2),
        "window_start":            window_start.isoformat(),
        "window_end":              window_end.isoformat(),
        "window_hours":            round(window_hours, 2),
        "start_hour":              hour,
        "is_weekend":              int(is_weekend),
        "day_of_week":             window_start.weekday(),
        "zone_multiplier":         round(zone_mult, 3),
        "city_base_payout":        CITY_BASE_PAYOUT[city_type],
        "orders_per_hour":         round(orders_per_hour, 3),
        "earnings_per_order":      round(earnings_per_order, 2),
        "hourly_earnings":         round(hourly_earnings, 2),
        "predicted_earnings":      predicted_earnings,
    }


def generate_dataset(n=60000):
    print(f"Generating {n} samples — delivery-time → earnings pipeline...")
    base_date = datetime(2025,1,1)
    records = []
    for _ in range(n):
        city_type     = random.choices(CITIES, weights=[40,40,20])[0]
        zone_mult     = random.choice(ZONE_MULTIPLIERS[city_type])
        platform      = random.choice(PLATFORMS)
        weekly_income = float(np.clip(np.random.lognormal(np.log(7000),0.42),2500,25000))
        worker_id     = f"RES-{city_type[:3].upper()}-{random.randint(10000,99999)}"
        day_offset    = random.randint(0,364)
        start_hour    = random.randint(0,22)
        window_hrs    = random.choices([1,2,3,4,5,6], weights=[0.25,0.30,0.20,0.12,0.08,0.05])[0]
        window_start  = base_date + timedelta(days=day_offset, hours=start_hour)
        window_end    = window_start + timedelta(hours=window_hrs)
        records.append(generate_row(worker_id,weekly_income,platform,window_start,window_end,city_type,zone_mult))

    df = pd.DataFrame(records)
    print(f"Shape: {df.shape}")
    print(f"\nEarnings (INR):\n{df['predicted_earnings'].describe().round(1).to_string()}")
    print(f"\nHourly (INR/hr):\n{df['hourly_earnings'].describe().round(1).to_string()}")
    print(f"\nTime taken (min):\n{df['Time_taken_min'].describe().round(1).to_string()}")
    return df

if __name__ == "__main__":
    import os
    df = generate_dataset(60000)
    out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "training_data.csv")
    df.to_csv(out_path, index=False)
    print(f"\nSaved → {out_path}")