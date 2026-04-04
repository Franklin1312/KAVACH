# KAVACH ML Service — Model Documentation

> Predicts how much a gig worker **would have earned** during a disruption window,
> so the platform can calculate their income loss and process a fair payout.

---

## Table of Contents

1. [What the model does](#1-what-the-model-does)
2. [Why this approach](#2-why-this-approach)
3. [Data sources](#3-data-sources)
4. [How earnings are derived](#4-how-earnings-are-derived)
5. [Feature engineering](#5-feature-engineering)
6. [Model architecture](#6-model-architecture)
7. [Performance metrics](#7-performance-metrics)
8. [API reference](#8-api-reference)
9. [How it fits into KAVACH](#9-how-it-fits-into-kavach)
10. [Retraining](#10-retraining)
11. [Setup](#11-setup)

---

## 1. What the model does

When a disruption happens (rain, flood, AQI spike, curfew, platform outage), a
worker files a claim. To process that claim fairly, KAVACH needs to answer one
question:

> **"How much would this worker have earned during that time slot, if the
> disruption had never happened?"**

That number is called `predicted_earnings`. The model predicts it.

Once predicted, the backend computes:

```
net_loss      = predicted_earnings - actual_earned
payout_amount = net_loss × coverage_pct × trigger_level_multiplier
```

The model does **not** predict fraud, weather, or eligibility. It predicts
**expected income** for a specific worker in a specific time window.

---

## 2. Why this approach

Gig worker earnings are not fixed salaries. They depend on:

- What time of day it is (dinner hours earn 2× more than 3 AM)
- Which city and zone the worker operates in
- Which platform they use (Uber pays more than Blinkit)
- How long deliveries take (faster deliveries = more orders per hour)
- Weather and traffic (stormy weather slows deliveries but raises per-order pay)
- Whether it is a festival day (surge pricing kicks in)
- The worker's own weekly income level (proxy for experience and efficiency)

A simple average-income approach would be unfair — it would underpay high earners
and overpay low earners during peak hours. The ML model learns all these
interactions from 60,000 training samples and produces a personalized estimate
for each worker and each time window.

---

## 3. Data sources

The model is built on three sources combined:

### 3.1 Kaggle food delivery dataset schema
The training data mirrors the exact schema of the
`gauravmalik26/food-delivery-dataset` from Kaggle — a real Indian food delivery
dataset with 45,000+ records. We use its structure and column definitions:

| Column | What it captures |
|---|---|
| `Time_taken_min` | How long a delivery takes in minutes |
| `Weatherconditions` | Sunny / Cloudy / Windy / Fog / Sandstorms / Stormy |
| `Road_traffic_density` | Low / Medium / High / Jam |
| `City` | Metropolitian / Urban / Semi-Urban |
| `Festival` | Yes / No |
| `multiple_deliveries` | How many orders stacked per trip |
| `Delivery_person_Ratings` | Worker rating (2.5–5.0) |
| `Time_Orderd` | What time the order was placed |

### 3.2 IDInsight 2024 Indian gig worker study
A field study of two-wheeler delivery workers across Indian cities, giving us
real earnings ground truth to calibrate against:

- Gross earnings: **₹170/hr** (including surge windows)
- Average net earnings: **₹115/hr** (after fuel and maintenance costs)
- Consistent full-time drivers: **₹75/hr** net (non-surge periods)
- Casual urban labour baseline: **₹62/hr**

These benchmarks anchor the synthetic training data to reality. The model's
predicted hourly earnings average **₹85.8/hr** — within the real-world range.

### 3.3 Real Zomato/Swiggy peak-hour demand curves
Order volume patterns calibrated to actual Indian food delivery behavior:

- Lunch peak: **12 PM – 2 PM** (demand multiplier: 1.48–1.50×)
- Dinner peak: **7 PM – 9 PM** (demand multiplier: 1.62–1.65×)
- Morning peak: **8 AM – 10 AM** (demand multiplier: 0.95–1.05×)
- Dead hours: **1 AM – 4 AM** (demand multiplier: 0.14–0.22×)

---

## 4. How earnings are derived

The core insight that makes this model work is:

```
orders_per_hour    = 60 / (delivery_time_minutes + pickup_wait + return_buffer)
hourly_earnings    = earnings_per_order × orders_per_hour
predicted_earnings = hourly_earnings × window_hours
```

**Delivery time is the key link.** A worker doing 25-minute deliveries completes
~1.7 orders/hr. A worker stuck in traffic doing 45-minute deliveries completes
~1.0 orders/hr. The Kaggle dataset gives us real delivery time distributions
across cities, weather conditions, and traffic densities — so the model learns
how disruptions affect order throughput, not just per-order pay.

### Per-order earnings formula

```
earnings_per_order =
    city_base_payout           (₹42 Semi-Urban / ₹55 Urban / ₹68 Metro)
  × hour_demand_multiplier     (0.14× at 3am → 1.65× at 8pm)
  × weather_multiplier         (1.00× Sunny → 1.25× Stormy)
  × traffic_multiplier         (1.00× Low → 1.20× Jam)
  × festival_multiplier        (1.00 normal / 1.30 festival)
  × rating_multiplier          (0.80× poor rating → 1.20× excellent)
  × income_multiplier          (proxy for worker experience)
  × weekend_multiplier         (1.10× on weekends)
  × zone_multiplier            (0.88× outer zone → 1.40× premium zone)
  × stacked_delivery_bonus     (+15% per additional stacked order)
```

---

## 5. Feature engineering

47 features are computed from the raw inputs. They fall into 6 groups:

### Group 1: Income features
| Feature | Description |
|---|---|
| `weekly_income` | Raw declared/verified weekly income in INR |
| `income_log` | Log transform — reduces skew for high earners |
| `hourly_base` | `weekly_income / 48` — base hourly rate |

### Group 2: Time features
| Feature | Description |
|---|---|
| `start_hour` | Hour the disruption window starts (0–23) |
| `window_hours` | Duration of the disruption in hours |
| `is_weekend` | 1 if Saturday/Sunday |
| `day_of_week` | 0 (Monday) to 6 (Sunday) |
| `hour_sin`, `hour_cos` | Cyclic encoding — so 23:00 and 01:00 are close |
| `dow_sin`, `dow_cos` | Cyclic encoding of day of week |
| `hour_demand` | Demand multiplier for that hour from the demand curve |
| `is_peak_lunch` | 1 if window starts between 12–14 |
| `is_peak_dinner` | 1 if window starts between 18–21 |
| `is_peak_morning` | 1 if window starts between 8–10 |
| `is_night` | 1 if window starts between 22–4 |

### Group 3: Delivery-time signals (from Kaggle schema)
| Feature | Description |
|---|---|
| `time_taken_min` | Estimated delivery time in minutes |
| `orders_per_hour` | `60 / (time_taken + 15)` — core derived signal |
| `delivery_rating` | Worker's platform rating |
| `multiple_deliveries` | Number of stacked orders per trip |
| `person_age` | Worker age (proxy for experience) |
| `weather_enc` | Encoded: 0 (Sunny) → 5 (Stormy) |
| `traffic_enc` | Encoded: 0 (Low) → 3 (Jam) |
| `weather_severity` | Normalised weather score (0–1) |
| `traffic_severity` | Normalised traffic score (0–1) |
| `is_festival` | 1 on festival days |

### Group 4: Platform features
| Feature | Description |
|---|---|
| `platform_enc` | 0 = Swiggy, 1 = Zomato |
| `is_zomato` | Binary flag |
| `is_swiggy` | Binary flag |
| `vehicle_enc` | 0 (bicycle) → 3 (motorcycle) |
| `order_enc` | 0 (Snack) → 3 (Meal) |

### Group 5: Location features
| Feature | Description |
|---|---|
| `city_enc` | 0 (Semi-Urban) → 2 (Metropolitian) |
| `city_base_payout` | Base INR per order for that city type |
| `zone_multiplier` | Premium zone (1.40×) vs outer zone (0.88×) |

### Group 6: Interaction features
| Feature | What it captures |
|---|---|
| `time_x_traffic` | How traffic worsens delivery time |
| `time_x_weather` | How weather worsens delivery time |
| `orders_x_demand` | Demand × throughput — peak hour efficiency |
| `income_x_orders` | High earner + high throughput = large loss |
| `income_x_demand` | High earner during peak = very large loss |
| `income_x_city` | Metro high earner vs semi-urban low earner |
| `income_x_zone` | Premium zone income amplifier |
| `demand_x_window` | Long window during peak = compounded loss |
| `orders_x_window` | More orders possible over longer window |
| `rating_x_income` | High-rated high-earner loses most |
| `multi_x_earnings` | Stacked delivery bonus × income |
| `festival_x_demand` | Festival during peak = maximum surge |
| `expected_base` | `hourly_base × window_hours × zone_mult × demand` |

---

## 6. Model architecture

### Stacked ensemble

```
Input (47 features)
        │
        ├──────────────────────┐
        ▼                      ▼
   XGBoost                LightGBM
   (900 trees,            (900 trees,
    depth 7)               depth 7)
        │                      │
        └──────────┬───────────┘
                   ▼
          Ridge meta-learner
          (learns optimal blend
           of XGB + LGB predictions)
                   │
                   ▼
          predicted_earnings (INR)
```

### Why this architecture

**XGBoost + LightGBM** are both gradient boosted tree ensembles — the
gold standard for tabular data. Each makes independent predictions. The
**Ridge meta-learner** then learns the optimal linear combination of both,
correcting systematic biases either model has individually. This stacking
approach consistently outperforms any single model on tabular regression.

### Training procedure

- **60,000 training samples** generated from the delivery-time pipeline
- **5-fold cross-validation** — meta-learner trained on out-of-fold (OOF)
  predictions only, preventing data leakage
- **Full retrain** on all 60,000 samples before saving to artifacts

### Hyperparameters

| Parameter | Value | Reason |
|---|---|---|
| `n_estimators` | 900 | Enough trees to converge without overfitting |
| `learning_rate` | 0.04 | Slow learning = better generalisation |
| `max_depth` | 7 | Deep enough for interactions, not overfit |
| `subsample` | 0.8 | Row sampling reduces variance |
| `colsample_bytree` | 0.8 | Feature sampling reduces variance |
| `reg_alpha` | 0.1 | L1 regularisation |
| `reg_lambda` | 1.5 | L2 regularisation |

---

## 7. Performance metrics

Evaluated via 5-fold out-of-fold cross-validation on 60,000 samples:

| Metric | Value | What it means |
|---|---|---|
| **R²** | **0.9874** | Model explains 98.74% of earnings variance |
| **MAE** | **₹16.79** | Average prediction is within ₹16.79 of true value |
| **RMSE** | **₹27.18** | Penalises large errors more heavily |
| Hourly earnings mean | ₹85.8/hr | Within IDInsight real range (₹75–₹170/hr) |

### Confidence score

Each prediction returns a confidence score (0.50–0.99):

```
confidence = 1 - (residual_std / predicted_earnings)
           clipped to [0.50, 0.99]
```

- **> 0.85** — high confidence, strong data signal
- **0.70–0.85** — normal confidence
- **< 0.70** — lower confidence (unknown zone, edge-case hour)

If the ML service is unreachable, the fallback rule-based engine runs and
`predictionSource` returns `"rule_based"` with confidence `0.60`.

---

## 8. API reference

### `GET /health`
```json
{
  "status": "ok",
  "version": "v2-delivery-time-integration",
  "oof_mae": 16.7938,
  "oof_r2": 0.9874,
  "data_sources": ["..."],
  "trained_at": "2026-04-02T19:34:25",
  "uptime_since": "..."
}
```

### `POST /predict`

**Request:**
```json
{
  "worker_id": "abc123",
  "weekly_income": 6000,
  "city": "Urban",
  "zone": "adyar",
  "window_start": "2026-04-02T19:00:00.000Z",
  "window_end":   "2026-04-02T21:00:00.000Z",
  "platforms": ["zomato"],

  "weather_condition":    "Stormy",
  "road_traffic_density": "High",
  "delivery_rating":      4.2,
  "multiple_deliveries":  1,
  "vehicle_type":         "motorcycle",
  "delivery_person_age":  28,
  "is_festival":          false
}
```

**Response:**
```json
{
  "worker_id":               "abc123",
  "predicted_earnings":      275.50,
  "window_hours":            2.0,
  "confidence":              0.81,
  "city":                    "Urban",
  "zone":                    "adyar",
  "platform":                "zomato",
  "window_start":            "2026-04-02T19:00:00.000Z",
  "window_end":              "2026-04-02T21:00:00.000Z",
  "orders_per_hour_estimate": 1.05
}
```

**City mapping:**

| Worker.city | Sends to ML as |
|---|---|
| `mumbai`, `delhi`, `bengaluru` | `Metropolitian` |
| `chennai`, `hyderabad` | `Urban` |

**Trigger → weather/traffic (automatic in ditService.js):**

| Trigger | Weather | Traffic |
|---|---|---|
| `rain` | Stormy | High |
| `flood` | Stormy | Jam |
| `aqi` | Fog | Medium |
| `curfew` | Sunny | Jam |
| `platform_outage` | Sunny | Medium |
| `heat` | Sunny | Medium |

### `POST /predict/batch`
Up to 100 workers in one call:
```json
{ "requests": [ { ...request_1 }, { ...request_2 } ] }
```

---

## 9. How it fits into KAVACH

```
Worker files claim (ClaimsPage.jsx)
          │
          ▼
POST /api/claims/auto-process        ← routes/claims.js
          │
          ▼
enrichAndPredict()                   ← services/ditService.js
  maps triggerType → weather + traffic conditions
          │
          ▼
POST http://localhost:5001/predict   ← ml/main.py
  loads xgb + lgb + ridge
  runs 47-feature prediction
          │
          ▼
{ predicted_earnings, confidence, orders_per_hour_estimate }
          │
          ▼
net_loss = predicted_earnings - actual_earned
payout   = net_loss × policy.coveragePct × LEVEL_MULTIPLIERS[triggerLevel]
          │
          ▼
fraudService → paymentService → notificationService
          │
          ▼
AuditLog: predictionSource, mlConfidence, ordersPerHour recorded
```

---

## 10. Retraining

### With synthetic data (default)
```bash
python generate_data.py   # regenerates training_data.csv (60,000 rows)
python train.py           # retrains all 3 models, overwrites artifacts/
python main.py            # restarts with new models
```

### With real worker data
When KAVACH accumulates real claim data, retrain on that instead:
```bash
python train.py path/to/real_claims.csv
```

Required columns:
```
weekly_income, City, Weatherconditions, Road_traffic_density,
Festival, multiple_deliveries, Delivery_person_Ratings,
Delivery_person_Age, Type_of_vehicle, Type_of_order, platform,
window_start, window_end, zone_multiplier, Time_taken_min,
predicted_earnings   ← label: actual earnings the worker made
```

Even 500 real labelled claims will meaningfully improve accuracy.

---

## 11. Setup

```bash
cd ml

# Install (Python 3.10–3.13)
pip install -r requirements.txt

# Generate 60,000 training samples
python generate_data.py

# Train models (~3 minutes) — saves to artifacts/
python train.py

# Start the service
python main.py
# → http://localhost:5001
```

**backend/.env:**
```
ML_SERVICE_URL=http://localhost:5001
ML_TIMEOUT_MS=8000
```

**File structure:**
```
ml/
├── main.py              FastAPI service
├── train.py             Feature engineering + stacked ensemble trainer
├── generate_data.py     Synthetic data generator
├── requirements.txt     Python dependencies
├── README.md            This file
└── artifacts/
    ├── xgb_model.pkl    Trained XGBoost (6.8 MB)
    ├── lgb_model.pkl    Trained LightGBM (2.5 MB)
    ├── meta_model.pkl   Ridge meta-learner
    └── meta.json        Feature list, metrics, training date
```

---

*KAVACH ML Service — v2 (delivery-time integration)*
*Trained: April 2026 | R² 0.9874 | MAE ₹16.79*
