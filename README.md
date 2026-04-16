# KAVACH — AI-Powered Parametric Income Shield for India's Gig Delivery Workers

---

## 🌟 Platform Highlights & Core Capabilities

KAVACH is a comprehensive, production-ready insure-tech ecosystem. Our architecture unifies artificial intelligence, on-chain immutability, and micro-actuarial models.

*   🧠 **AI Digital Income Twin (DIT):** A stacked ensemble model (XGBoost + LightGBM + Ridge meta-learner) with R² 0.9874 and MAE ₹16.79 that accurately predicts the exact revenue a worker *would have earned* during a disruption window — calibrated on 60,000 training samples and anchored to IDInsight 2024 real-world Indian gig worker earnings data.
*   🚦 **7-Layer Fraud Engine:** GPS zone validation, platform activity cross-validation, new-account cooling-off, historical behavioral baseline, per-worker velocity anomaly detection, duplicate claim prevention, last-minute policy purchase detection, and UPI payout-destination ring detection — all feeding into a Physical Presence Confidence Score (PPCS) for a final auto-approve / soft-flag / verify / manual-review decision.
*   🔗 **Blockchain Audit Trail:** Approved payouts are immutably logged on the **Sepolia ETH Testnet** via Ethers.js — a SHA-256 hash of the payout receipt is embedded in a zero-value self-transfer transaction, creating a publicly verifiable record on Etherscan.
*   📡 **Multi-Source Parametric Triggers:** 7 trigger types (rain, AQI, flood, curfew, platform outage, zone freeze, heat) verified against live OpenWeatherMap, CPCB AQI, and platform heartbeat APIs with ward-level geo-precision across 16 Indian cities.
*   💸 **Zero-Touch Payouts via Razorpay:** Fully automated lifecycle from claim detection to UPI payout (with IMPS fallback), using Razorpay Contacts, Fund Accounts, and Payout APIs. Mock mode is available for local development.
*   🔒 **DPDP Act 2023 Compliance:** End-to-end digital consent capture (GPS, bank details, platform API polling) stored on each worker record with timestamp for full audit-trail accountability.
*   🛡️ **Adverse Selection Lockouts:** Dynamic lockouts halt new policy enrollments during Level 3+ events; 90/120-day engagement tracking (Social Security Code 2020) enforces minimum platform activity before policy eligibility.
*   🌍 **Multilingual PWA:** A React-based Progressive Web App with real-time English / Hindi / Tamil localization via React Context, and a global AI chatbot widget powered by the Claude API — optimized for mobile-first gig demographics.

---

## Table of Contents

1. [Executive Vision](#1-executive-vision)
2. [Persona Selection & Deep Analysis](#2-persona-selection--deep-analysis)
3. [Application Workflow & Persona Scenarios](#3-application-workflow--persona-scenarios)
4. [Weekly Premium Model — How It Works](#4-weekly-premium-model--how-it-works)
5. [Parametric Trigger Architecture](#5-parametric-trigger-architecture)
6. [AI/ML Integration — Actual Implementation](#6-aiml-integration--actual-implementation)
7. [Fraud Detection Architecture](#7-fraud-detection-architecture)
8. [Platform Choice: Progressive Web App (PWA)](#8-platform-choice-progressive-web-app-pwa)
9. [Tech Stack & Architecture](#9-tech-stack--architecture)
10. [Setup & Running the Platform](#10-setup--running-the-platform)
11. [API Reference](#11-api-reference)
12. [Loophole Analysis & Failure-Proofing](#12-loophole-analysis--failure-proofing)
13. [Adversarial Defense & Anti-Spoofing Strategy](#13-adversarial-defense--anti-spoofing-strategy)
14. [Recent Platform Implementations & Scaling](#14-recent-platform-implementations--scaling)

---

## 1. Executive Vision

India has over **12 million** platform-based gig delivery workers. They earn between ₹12,000–₹22,000 per month and have **zero income safety net** when external disruptions — extreme rainfall, flash floods, AQI spikes, civil curfews, or platform outages — force them off the road.

The problem with existing parametric insurance globally is that it pays a **flat, trigger-based payout** regardless of whether the worker actually lost income. This creates moral hazard, premium inflation, and is actuarially unsound at scale.

**KAVACH solves this with a breakthrough concept: the Digital Income Twin (DIT).**

Rather than paying flat amounts when a trigger fires, KAVACH builds a shared ML model that knows precisely what any worker would have earned during any time window, based on their own weekly income, zone, shift, platform, and real-world delivery dynamics. When a disruption occurs:

1. **External triggers confirm** the disruption is real (multi-source validation)
2. **The DIT predicts** what the worker would have earned in that period
3. **Platform activity data confirms** the worker genuinely couldn't work
4. **Payout = Predicted Loss × Coverage % × Trigger Level Multiplier**

This means every payout is individually calibrated, not one-size-fits-all. A part-time student delivering evenings gets paid for their actual off-hours. A full-time professional runner earns proportionally more protection. The model is fair, sustainable, and fraud-resistant by design.

---

## 2. Persona Selection & Deep Analysis

**Chosen Persona: Food Delivery Partners (Zomato & Swiggy)**

### Why Food Delivery?

| Dimension | Food (Zomato/Swiggy) | E-Commerce (Amazon) | Grocery/Q-Commerce (Zepto) |
|---|---|---|---|
| Order frequency | 8–20 orders/day | 5–12 orders/day | 15–30 orders/day |
| Weather sensitivity | Very High (rain = zero orders) | Medium | Very High |
| Peak window | Lunch + Dinner 12–2PM, 7–10PM | All day | All day |
| Income predictability | Moderate-High (patterns clear) | High | Moderate |
| Disruption impact | Orders disappear instantly | Orders shift to later | Orders disappear |
| Fraud risk | Medium | Medium | Lower |
| Data availability | High (Zomato/Swiggy APIs) | High | Medium |

Food delivery workers have the **clearest and most measurable income patterns**, making them the best candidate for the DIT model. Their income disappears the fastest during a disruption (orders stop immediately), and disruptions are the most objectively verifiable (heavy rain visibly halts deliveries platform-wide).

### The Worker Profile — Ravi, 28, Chennai

> Ravi has been a Zomato Gold Partner for 2.5 years. He works 10AM–10PM daily, covering the Anna Nagar and Kilpauk zones. On a normal weekday, he completes 14–18 deliveries and earns ₹700–₹900/day (₹4,800–₹6,300/week). He is also registered on Swiggy for 3 months, earning a supplemental ₹1,500–₹2,000/week.
>
> During Chennai's northeast monsoon in November 2024, he lost 4 working days in a single week — earning ₹0 on those days. His total loss: ₹3,200 that week. He had no recourse.
>
> **KAVACH's answer to Ravi:** Weekly premium of ₹42. Automated payout of ₹2,200 (70% of predicted loss) within 12 minutes of the disruption being confirmed — directly to his UPI account.

### Additional Personas Considered

| Persona | City | Platform | Avg Weekly Income | Key Disruption Risk |
|---|---|---|---|---|
| Ravi | Chennai | Zomato + Swiggy | ₹6,000 | Northeast Monsoon, AQI spikes |
| Priya | Delhi | Swiggy | ₹5,200 | Winter smog (AQI>400), Flash floods |
| Arjun | Mumbai | Zomato | ₹7,100 | Cyclone-induced rain, High tide flooding |
| Suresh | Bengaluru | Swiggy + Zomato | ₹5,800 | Unseasonal rain, waterlogging |

KAVACH is designed for **all four**, with city-specific risk models and localized disruption thresholds.

---

## 3. Application Workflow & Persona Scenarios

### Workflow Overview

```
Worker Onboarding
        │
        ▼
Phone OTP → Registration (name, city, zone, platform, income, UPI, shift)
        │
        ▼
Policy Activation (weekly premium calculated, Razorpay subscription created)
        │
        ▼
[Trigger Monitor runs every 30 minutes via cron]
        │ rain / AQI / flood / curfew / platform_outage / zone_freeze / heat detected
        ▼
POST /api/claims/auto-process
        │
        ├── DIT Prediction (ML service or rule-based fallback)
        │       predicted_earnings - actual_earned = net_loss
        │
        ├── Fraud Score Calculation (7 layers → 0–100)
        │       + Physical Presence Confidence Score (PPCS)
        │
        ├── Payout Decision:
        │       Fraud ≤ 30 & PPCS ≥ 80  → Auto-Approve  (payout in minutes)
        │       Fraud ≤ 60 & PPCS ≥ 50  → Soft Flag     (held 2 hours)
        │       Fraud ≤ 80              → Verify         (WhatsApp photo request)
        │       Fraud > 80              → Manual Review  (up to 24 hours)
        │
        ├── Razorpay UPI Payout (or IMPS fallback)
        │
        └── Blockchain Log (Sepolia ETH — SHA-256 receipt hash on-chain)
                │
                └── WhatsApp Notification to Worker
```

---

### Scenario A: Heavy Rain Disruption — Ravi, Chennai

**Trigger:** OpenWeatherMap reports 78mm rainfall in 3 hours over T. Nagar zone (Level 3).

**What KAVACH does:**
1. Trigger monitor (running every 30 min) detects rainfall above Level 3 threshold (75mm/3hr)
2. Checks Ravi's active policy for this week — policy confirmed active, premium paid
3. Calls ML service: `POST /predict` with `weekly_income=6100, city=Urban, zone=t_nagar, weather=Stormy, traffic=High`
4. ML returns `predicted_earnings=₹340` for the 2-hour disruption window with confidence 0.84
5. Fraud check: GPS zone match ✓, no earnings during window ✓, account age > 14 days ✓, no duplicates ✓ → fraud score 12
6. PPCS calculated from device signals → 91
7. **Auto-approved**: payout = ₹340 × 70% × 1.0 (Level 3 multiplier) = **₹238**
8. Razorpay UPI payout initiated to `ravi@upi`
9. Payout hash logged on Sepolia ETH (verifiable on Etherscan)
10. WhatsApp: *"KAVACH Payout: ₹238 has been sent to your UPI account. Disruption: Heavy Rain (Level 3)."*

---

### Scenario B: Platform Outage — Priya, Delhi

**Trigger:** Swiggy heartbeat API reports p95 latency >8s for 20 minutes (Level 2 outage).

- Payout = predicted_loss × 70% × 0.85 (Level 2 multiplier)
- Platform outage triggers a shorter disruption window (45–90 min per level)
- Fraud check: platform shows zero orders completed → Layer 2 passes cleanly
- Auto-approved payout dispatched

---

### Scenario C: Curfew/Bandh — Arjun, Mumbai

**Trigger:** Section 144 issued for Bandra zone.

- Level 4 curfew trigger (1440-minute window)
- Both police API and PIB confirm → multi-source threshold met
- Payout = net_loss × 85% (premium tier) × 1.0 (Level 4 capped at policy max)
- Maximum payout capped at policy `maxPayout` = 85% of weekly income

---

### Scenario D: Partial Disruption — Multi-Platform Worker (Suresh, Bengaluru)

**Trigger:** AQI 430 in Koramangala zone (Level 4 AQI).

- Suresh earns on both Swiggy and Zomato
- DIT predicts ₹480 in that 4-hour window
- Swiggy shows ₹90 actually earned; Zomato shows zero
- Net loss = ₹480 − ₹90 = ₹390
- Payout = ₹390 × 70% × 1.0 = **₹273** (net, not gross)
- Cross-platform income aggregation prevents double-dipping

---

## 4. Weekly Premium Model — How It Works

### Premium Calculation Formula

```
Premium = (baseAmount × zoneRiskFactor × seasonMultiplier
           − claimsFreeDiscount) × tierMultiplier + surgeLoading

where:
  baseAmount    = weeklyIncome × baseRate
  maxPayout     = weeklyIncome × coveragePct
```

#### Component Breakdown

**Base Rate:** Derived from worker's declared + platform-verified weekly income

| Weekly Income Band | Base Rate (% of income) |
|---|---|
| ₹2,000 – ₹3,500 | 0.85% |
| ₹3,501 – ₹5,500 | 0.80% |
| ₹5,501 – ₹8,000 | 0.75% |
| ₹8,001+ | 0.70% |

**Zone Risk Factor:** Configured per-worker based on city zone historical disruption risk

| Zone Classification | Multiplier |
|---|---|
| Low risk (inland, elevated, historically quiet) | 0.85× |
| Moderate risk (urban core, moderate flood history) | 1.00× |
| High risk (coastal, riverine, historically flooded) | 1.30× |
| Extreme risk (T-18 cyclone zone, flood-prone low-lying) | 1.55× |

**Season Multiplier:** City-specific seasonal loading pulled from `premiumService.js`

| Season | Multiplier | Applies to Cities |
|---|---|---|
| Northeast Monsoon (Oct–Dec) | 1.45× | Chennai, Bengaluru, Coimbatore |
| Southwest Monsoon (Jun–Sep) | 1.55× | Mumbai, Pune, Kolkata, Hyderabad, Ahmedabad, Surat, Kochi, Nagpur, Indore, Bengaluru |
| Winter smog season (Nov–Feb) | 1.20× | Delhi, Jaipur, Lucknow, Chandigarh |
| Dry/summer months | 0.80× | All cities |

**Claims-Free Discount:** Persistent no-claim window earns discounts. Resets on any payout.

| Claims-Free Weeks | Discount |
|---|---|
| 4–7 weeks | −8% |
| 8+ weeks | −15% |

**Surge Loading:** Computed from `historicalDisruption.js` using IMD historical trigger probability per city per season, amplified by zone risk factor. Range: ₹0–₹20, capped to prevent loading overreach.

**Minimum Premium:** ₹15/week (floor applied regardless of formula output).

### Real Example: Ravi's Weekly Premium Calculation

```
Ravi's verified weekly income:     ₹6,100
Base Rate (₹5,501–₹8,000 band):   0.75% × ₹6,100 = ₹45.75
Zone Risk Factor (T. Nagar,
  moderate):                       1.00× → ₹45.75
Season Multiplier (November,
  NE Monsoon peak):                1.45× → ₹66.34
Claims-Free Discount (8 weeks):    −15% → −₹9.95
Surge Loading (historical
  trigger probability):            +₹8.00
Tier Multiplier (Standard):        1.00×
────────────────────────────────────────
FINAL WEEKLY PREMIUM:              ₹65 (rounded)
```

Ravi's maximum coverage for that week: 70% of ₹6,100 = **₹4,270 in protected income**.

For ₹65/week, Ravi protects up to ₹4,270. That is a **65.7× value ratio on premium spent**, making KAVACH extraordinarily accessible.

### Coverage Tiers

| Tier | Payout % of Predicted Loss | Weekly Price Multiplier | Best For |
|---|---|---|---|
| Basic | 50% | 0.7× | Occasional workers, low income |
| Standard | 70% | 1.0× (base) | Full-time partners (recommended) |
| Premium | 85% | 1.35× | Top earners, high-risk zones |

### What the Premium Does NOT Cover

- Health, life, accident, or vehicle repair (strictly excluded)
- Self-caused disruptions (worker switches off the app voluntarily)
- Disruptions not crossing verified parametric thresholds
- Income lost due to customer cancellations, low ratings, or voluntary breaks

---

## 5. Parametric Trigger Architecture

KAVACH uses a **Tiered Multi-Source Trigger Validation** system. Each trigger category requires confirmation from independent data sources before a claim is raised.

### Trigger Types, Thresholds & Disruption Windows

#### ENVIRONMENTAL TRIGGERS

| Event | Primary Source | Threshold | Backup Source | Geo-Precision |
|---|---|---|---|---|
| Heavy Rainfall | IMD Rainfall API | >35mm / 3 hours | OpenWeatherMap | Ward/zone level |
| Extreme Heat | IMD Temperature API | Heat Index >46°C | Skymet Weather API | City level |
| Flash Flood | CWC River Level API | RED alert | NDRF alert + Twitter geo | Zone level |
| Severe AQI | CPCB AQI API | AQI > 400 (Severe) | AirVisual API | Zone level |

#### SOCIAL / CIVIL TRIGGERS

| Event | Primary Source | Threshold | Backup Source | Geo-Precision |
|---|---|---|---|---|
| Curfew / Section 144 | State Police API | Official announcement | PIB press release API | District level |
| Zone Closure | Municipal corporation API | Official closure notice | Google Maps road closure | Street level |

#### PLATFORM TRIGGERS

| Event | Source | Threshold | Backup |
|---|---|---|---|
| Platform Outage | Zomato/Swiggy heartbeat API | p95 latency >8s for 15 min | Downdetector score >500 + Twitter volume |
| Zone Supply Freeze | Platform Partner API | <5 orders in zone in 30 min | Cross-worker validation (multiple workers idle) |

### Trigger Escalation Levels

| Level | Severity | Payout Multiplier | Rain Example |
|---|---|---|---|
| Level 1 — Minor | Threshold barely crossed | 0.60× | 35–50mm/3hr |
| Level 2 — Moderate | Clearly significant | 0.85× | 50–75mm/3hr |
| Level 3 — Major | Severe disruption | 1.00× | 75–100mm/3hr |
| Level 4 — Catastrophic | Force majeure | 1.00× (capped at policy max) | >100mm / cyclone / curfew |

### Default Disruption Window Lengths (minutes)

| Trigger Type | Level 1 | Level 2 | Level 3 | Level 4 |
|---|---|---|---|---|
| Rain | 60 | 120 | 180 | 240 |
| AQI | 240 | 360 | 480 | 720 |
| Flood | 360 | 480 | 720 | 1440 |
| Curfew | 240 | 480 | 720 | 1440 |
| Platform Outage | 45 | 90 | 180 | 360 |
| Zone Freeze | 60 | 120 | 180 | 360 |
| Heat | 180 | 240 | 360 | 480 |

The trigger monitor runs **every 30 minutes** via `node-cron`, checking all active workers and their city/zone conditions. Only workers whose shift window overlaps with the disruption window are eligible for a claim.

### Supported Cities & Zones

KAVACH currently supports **16 cities** across India with **10 delivery zones each**:

| City | Example Zones |
|---|---|
| Chennai | Anna Nagar, T. Nagar, Adyar, Marina, Tambaram, Velachery, Sholinganallur, Porur, Ambattur, Perungudi |
| Mumbai | Bandra, Andheri, Dharavi, Kurla, Dadar, Borivali, Worli, Colaba, Powai, Vikhroli |
| Delhi | Connaught Place, Lajpat Nagar, Dwarka, Rohini, Saket, Noida Sec 62, Karol Bagh, Janakpuri, Pitampura, Vasant Kunj |
| Bengaluru | Koramangala, Indiranagar, Whitefield, HSR Layout, Electronic City, MG Road, Jayanagar, Marathahalli, Hebbal, Yelahanka |
| Hyderabad | Gachibowli, HITEC City, Banjara Hills, Jubilee Hills, Uppal, Secunderabad, Kukatpally, Madhapur, Ameerpet, LB Nagar |
| + 11 more | Pune, Kolkata, Ahmedabad, Jaipur, Lucknow, Surat, Kochi, Chandigarh, Indore, Nagpur, Coimbatore |

Each zone has precise lat/lon coordinates for hyper-local weather and AQI API queries, falling back to city-level coordinates when zone data is unavailable.

---

## 6. AI/ML Integration — Actual Implementation

### The Digital Income Twin (DIT) — Stacked Ensemble Model

The DIT answers one question: *"How much would this worker have earned during that time slot, if the disruption had never happened?"*

**Architecture:**

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
          (optimal blend learned
           on out-of-fold predictions)
                   │
                   ▼
          predicted_earnings (INR)
```

**Training Data:** 60,000 synthetic samples generated from real-world delivery dynamics, calibrated against:
- Kaggle `food-delivery-dataset` (45,000+ real Indian food delivery records) for delivery-time distributions
- IDInsight 2024 Indian gig worker study (₹75–₹170/hr real earnings range)
- Real Zomato/Swiggy peak-hour demand curves (lunch peak 1.48–1.50×, dinner peak 1.62–1.65×)

**Performance (5-fold out-of-fold cross-validation):**

| Metric | Value |
|---|---|
| R² | 0.9874 |
| MAE | ₹16.79 |
| RMSE | ₹27.18 |
| Mean predicted hourly earnings | ₹85.8/hr (within IDInsight real range) |

**Confidence Score:** Each prediction returns `confidence = 1 − (residual_std / predicted_earnings)` clipped to [0.50, 0.99]. Predictions above 0.85 confidence are considered high-quality.

### How Earnings Are Derived

The core insight: delivery time is the key link.

```
orders_per_hour    = 60 / (delivery_time_minutes + pickup_wait + return_buffer)
earnings_per_order = city_base_payout
                   × hour_demand_multiplier   (0.14× at 3am → 1.65× at 8pm)
                   × weather_multiplier       (1.00× Sunny → 1.25× Stormy)
                   × traffic_multiplier       (1.00× Low → 1.20× Jam)
                   × festival_multiplier      (1.30× on festival days)
                   × rating_multiplier        (0.80× poor → 1.20× excellent)
                   × income_multiplier        (proxy for worker experience)
                   × zone_multiplier          (0.88× outer → 1.40× premium)
hourly_earnings    = earnings_per_order × orders_per_hour
predicted_earnings = hourly_earnings × window_hours
```

### 47 Features Across 6 Groups

**Group 1: Income** — `weekly_income`, `income_log`, `hourly_base`

**Group 2: Time** — `start_hour`, `window_hours`, `is_weekend`, `day_of_week`, `hour_sin/cos`, `dow_sin/cos`, `hour_demand`, `is_peak_lunch`, `is_peak_dinner`, `is_peak_morning`, `is_night`

**Group 3: Delivery Signals (Kaggle schema)** — `time_taken_min`, `orders_per_hour`, `delivery_rating`, `multiple_deliveries`, `person_age`, `weather_enc`, `traffic_enc`, `weather_severity`, `traffic_severity`, `is_festival`

**Group 4: Platform** — `platform_enc`, `is_zomato`, `is_swiggy`, `vehicle_enc`, `order_enc`

**Group 5: Location** — `city_enc`, `city_base_payout`, `zone_multiplier`

**Group 6: Interaction** — `time_x_traffic`, `time_x_weather`, `orders_x_demand`, `income_x_orders`, `income_x_demand`, `income_x_city`, `income_x_zone`, `demand_x_window`, `orders_x_window`, `rating_x_income`, `multi_x_earnings`, `festival_x_demand`, `expected_base`

### Trigger → ML Context Mapping

The `ditService.js` automatically maps trigger type to weather and traffic conditions for the ML request:

| Trigger Type | Weather Sent to ML | Traffic Sent to ML |
|---|---|---|
| rain | Stormy | High |
| flood | Stormy | Jam |
| aqi | Fog | High |
| curfew | Sunny | Jam |
| platform_outage | Cloudy | Medium |
| zone_freeze | Cloudy | Jam |
| heat | Sunny | Medium |

### Rule-Based Fallback

If the ML service is unreachable (ECONNREFUSED or timeout after 8 seconds), `ditService.js` automatically falls back to a rule-based prediction:

```
income      = verifiedWeeklyIncome || declaredWeeklyIncome || 5000
hourlyBase  = (income / 6) / 10
prediction  = hourlyBase × hours × dayMultiplier × peakHourMultiplier
```

The `predictionSource` field in the audit log records `"ml"` or `"rule_based"` for transparency.

### ML Service API

The FastAPI service runs on `https://kavach-zepc.onrender.com` (Python).

**`GET /health`** — Returns model metadata, OOF metrics, and uptime.

**`POST /predict`** — Single worker prediction. Required fields:

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

**City mapping for ML (`ditService.js`):**

| Worker City | Sent to ML as |
|---|---|
| mumbai, delhi, bengaluru, kolkata | `Metropolitian` |
| chennai, hyderabad, pune, ahmedabad, surat, lucknow, kochi, coimbatore, indore, nagpur | `Urban` |
| chandigarh, jaipur | `Semi-Urban` |

**`POST /predict/batch`** — Up to 100 workers in one call:

```json
{ "requests": [ { ...request_1 }, { ...request_2 } ] }
```

---

## 7. Fraud Detection Architecture

Fraud is the single greatest risk to parametric insurance viability. KAVACH's fraud system has **7 independent layers** plus a Physical Presence Confidence Score (PPCS).

### Layer 1: GPS Zone Validation

Verifies that the worker has a confirmed city + zone on record. Workers without a verified zone receive a score penalty of +20 and a `ZONE_NOT_VERIFIED` flag.

### Layer 2: Platform Activity Cross-Validation

Compares `actualEarned` against `predictedLoss`. If the worker actually earned more than 50% of the predicted loss during the disruption window, the claim is flagged `EARNING_DURING_DISRUPTION` (+25 score).

### Layer 3: New Account Cooling-Off

| Account Age | Score Penalty | Flag |
|---|---|---|
| < 7 days | +30 | `NEW_ACCOUNT_WEEK_1` |
| 7–14 days | +15 | `NEW_ACCOUNT_WEEK_2` |

### Layer 4: Historical Behavioral Baseline

Checks claim frequency over the rolling 28-day window:

| Recent Approved Claims (4 weeks) | Score Penalty | Flag |
|---|---|---|
| ≥ 4 claims | +20 | `HIGH_CLAIM_FREQUENCY` |
| 3 claims | +10 | `ELEVATED_CLAIM_FREQUENCY` |

### Layer 4.5: Per-Worker Velocity Anomaly

Compares the claim's implied hourly earnings rate against the worker's own 4-week rolling average (`avgEarningsPerHour`, updated weekly by cron):

| Velocity Ratio (claim rate / baseline) | Score Penalty | Flag |
|---|---|---|
| > 2.5× | +20 | `VELOCITY_ANOMALY_SEVERE` |
| 2.0–2.5× | +15 | `VELOCITY_ANOMALY` |
| 1.7–2.0× | +5 | `VELOCITY_ELEVATED` |

Workers with fewer than 3 historical claims (cold start) skip this layer.

### Layer 5: Duplicate Claim Prevention

Checks for any non-rejected claim for the same worker, policy, trigger type, and disruption window within the past 6 hours. Duplicate detected = +50 (`DUPLICATE_CLAIM`).

### Layer 6: Last-Minute Policy Purchase

If the policy was created less than 24 hours ago, the claim is flagged `POLICY_SEASONING_PERIOD` (+25 score).

### Layer 7: UPI Payout Destination Clustering (Ring Detection)

Detects coordinated fraud rings by checking how many workers from the same bank (same UPI handle suffix) and same city submitted claims in the past 1 hour. If the count exceeds 20 → `UPI_CLUSTER_RING_DETECTED` (+30 score).

### Physical Presence Confidence Score (PPCS)

Calculated from device signals sent by the mobile app SDK:

| Signal | Genuine Worker | Spoofer | Penalty |
|---|---|---|---|
| GPS jitter < 0.05 (unnaturally smooth) | Natural micro-drift | Suspiciously smooth | −30 pts |
| Motion continuity absent | Continuous trajectory | No prior motion trail | −25 pts |
| Cell tower doesn't match zone | Zone tower | Home tower | −25 pts |
| Platform app heartbeat absent | App actively polling | App not polling | −20 pts |

PPCS starts at 100 and is deducted based on signals. Range: 0–100.

### Payout Decision Matrix

| Fraud Score | PPCS | Decision | Action |
|---|---|---|---|
| ≤ 30 | ≥ 80 | **Auto-Approve** | Payout within minutes |
| ≤ 60 | ≥ 50 | **Soft Flag** | Approved, held 2 hours for reconciliation |
| ≤ 80 | Any | **Verify** | Worker asked to send geotagged photo via WhatsApp |
| > 80 | Any | **Manual Review** | Up to 24 hours, worker notified |

### Key Anti-Abuse Rules

1. **No retroactive claims:** Policy must have been active for at least 24 hours before the disruption event.
2. **Shift window overlap check:** Only loss within the worker's registered shift hours counts toward payout calculation.
3. **Cross-platform net income:** Multi-platform workers have all platform earnings aggregated — no double-dipping.
4. **IST-aware window calculation:** All shift and disruption windows are computed correctly in IST (UTC+5:30) to prevent timezone gaming.

---

## 8. Platform Choice: Progressive Web App (PWA)

**Decision: Progressive Web App (PWA) built in React**

### Justification

Gig delivery workers in India are mobile-first but operate across a wide range of entry-level Android devices (₹6,000–₹15,000 range) with limited storage and constrained data plans. A PWA gives us the reach of a website with the feel of a native app — no Play Store friction, instant updates, and a minimal install footprint.

A single React codebase serves both the worker-facing app and the insurer admin dashboard, significantly reducing development overhead.

**Key UX Principles:**
- Languages: English, Hindi, Tamil (via React Context i18n — `translations.js` with 2,000+ translation keys)
- WhatsApp as the primary notification channel — more reliable than push notifications on budget Android devices
- Zero-tap claim flow — payouts trigger automatically via cron; worker only sees a notification
- Global AI chatbot widget (Claude API-powered, README-informed) available on all pages

### Frontend Pages

| Route | Component | Access |
|---|---|---|
| `/` | `Onboarding.jsx` | Public (worker login/register or admin login) |
| `/dashboard` | `Dashboard.jsx` | Worker (authenticated) |
| `/policy` | `PolicyPage.jsx` | Worker (authenticated) |
| `/claims` | `ClaimsPage.jsx` | Worker (authenticated) |
| `/admin` | `AdminDashboard.jsx` | Admin only |

---

## 9. Tech Stack & Architecture

### Actual System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        KAVACH PLATFORM                           │
│                                                                  │
│   ┌─────────────────┐              ┌──────────────────────┐      │
│   │   Worker PWA    │              │   Admin Dashboard    │      │
│   │  (React 18)     │              │  (React 18)          │      │
│   └────────┬────────┘              └──────────┬───────────┘      │
│            │                                  │                  │
│   ┌────────▼──────────────────────────────────▼────────────┐     │
│   │         Node.js / Express API (port 5000)              │     │
│   │      Auth · Routing · JWT · CORS · Morgan              │     │
│   └──────┬──────────┬──────────┬──────────┬───────────────┘     │
│          │          │          │          │                      │
│   ┌──────▼──┐  ┌────▼────┐ ┌──▼──────┐ ┌─▼──────────┐          │
│   │ /auth   │  │/policies│ │/claims  │ │/triggers   │          │
│   │ /workers│  │         │ │         │ │/admin      │          │
│   │ /chat   │  │ Premium │ │ Fraud   │ │/webhooks   │          │
│   │         │  │ Engine  │ │ Engine  │ │            │          │
│   └─────────┘  └────┬────┘ └──┬──────┘ └────────────┘          │
│                     │         │                                  │
│               ┌─────▼─────────▼─────────┐                       │
│               │      MongoDB (Mongoose)  │                       │
│               │  Workers · Policies ·   │                       │
│               │  Claims · AuditLogs     │                       │
│               └─────────────────────────┘                       │
│                                                                  │
│   ┌───────────────────────────────────────────────────────┐      │
│   │              ML Service — FastAPI (port 5001)         │      │
│   │   POST /predict · POST /predict/batch · GET /health   │      │
│   │   XGBoost + LightGBM + Ridge stacked ensemble         │      │
│   │   Artifacts: xgb_model.pkl, lgb_model.pkl,            │      │
│   │              meta_model.pkl, meta.json                 │      │
│   └───────────────────────────────────────────────────────┘      │
│                                                                  │
│   ┌───────────────────────────────────────────────────────┐      │
│   │        Scheduled Jobs (node-cron, IST timezone)       │      │
│   │  Mon 00:01 — Weekly policy renewal + claims-free inc  │      │
│   │  Every 30m — Trigger monitor for all active workers   │      │
│   │  Mon 01:00 — Worker behavioral baseline update        │      │
│   │  Daily 00:00 — Stale claim escalation to manual review│      │
│   └───────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────┘

EXTERNAL INTEGRATIONS
────────────────────────────────────────────────────────────────────
 Weather / Environment
   OpenWeatherMap API        ──►  triggerService.js (rain, heat)
   CPCB AQI API              ──►  triggerService.js (AQI)
   CWC Flood Level API        ──►  triggerService.js (flood)
   IMD (reference)            ──►  historicalDisruption.js

 Platform
   Zomato/Swiggy heartbeat   ──►  triggerService.js (platform_outage, zone_freeze)

 Payments
   Razorpay API               ──►  paymentService.js (UPI AutoPay + UPI/IMPS Payout)
   Razorpay Webhooks          ──►  webhooks.js (payment confirmation)

 Notifications
   WhatsApp Business API      ──►  notificationService.js (claim + policy events)

 Blockchain
   Sepolia ETH Testnet        ──►  blockchainService.js (payout receipt hashing)
   Ethers.js                  ──►  0-value self-transfer with JSON payload in data field
```

### Technology Choices

| Layer | Technology | Justification |
|---|---|---|
| Frontend | React 18 (PWA) | Single codebase for worker app + insurer dashboard |
| API Layer | Node.js + Express 4 | Fast async I/O; JWT auth; `morgan` logging |
| ML Service | Python + FastAPI + Uvicorn | XGBoost, LightGBM, scikit-learn ecosystem |
| Database | MongoDB (Mongoose 8) | Flexible schema; 2dsphere index for geo queries |
| Scheduler | node-cron | Embedded cron; 4 jobs; IST timezone support |
| Blockchain | Ethers.js + Sepolia ETH | Immutable payout audit trail; zero gas cost (testnet) |
| Payments | Razorpay | UPI AutoPay (premiums) + UPI/IMPS Payout API (claims) |
| Messaging | WhatsApp Business API (Meta Graph v18) | Primary channel for Indian gig workers |
| Chatbot | Claude API (claude-sonnet-4-20250514) | README-informed answers; multi-turn history |
| Charts | Recharts | Admin dashboard analytics visualization |
| Localization | React Context (translations.js) | English, Hindi, Tamil; 2,000+ keys |

---

## 10. Setup & Running the Platform

### Prerequisites

- Node.js 18+
- Python 3.10–3.13
- MongoDB (local or Atlas)
- A `.env` file in `backend/`

### Backend Setup

```bash
cd backend
npm install

# Copy and fill in your environment variables
cp .env.example .env
```

**`backend/.env` variables:**

```env
# Database
MONGODB_URI=mongodb://localhost:27017/kavach

# Auth
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# WhatsApp Business API (Meta Graph)
WHATSAPP_TOKEN=your_whatsapp_token
WHATSAPP_PHONE_ID=your_phone_id

# Razorpay
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_ACCOUNT_NUMBER=...

# ML Service
ML_SERVICE_URL=http://localhost:5001
ML_TIMEOUT_MS=8000

# Blockchain (Sepolia ETH)
POLYGON_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
POLYGON_PRIVATE_KEY=your_sepolia_private_key

# External APIs
OPENWEATHERMAP_API_KEY=...
AQI_API_KEY=...

# Admin credentials
ADMIN_PHONE=9999900000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=Kavach@Admin2026

# Development mode (set to false for real Razorpay + WhatsApp calls)
ENABLE_MOCK=true
NODE_ENV=development
CLIENT_URL=http://localhost:3000
```

```bash
# Seed sample workers (optional)
node scripts/seedWorkers.js

# Start backend
npm run dev         # development (nodemon)
npm start           # production
```

The backend starts on `http://localhost:5000`. On startup it:
1. Connects to MongoDB
2. Checks ML service health (warns and falls back if unreachable)
3. Starts all 4 cron jobs

### ML Service Setup

```bash
cd ml

# Install dependencies (Python 3.10–3.13)
pip install -r requirements.txt

# Generate 60,000 training samples
python generate_data.py

# Train the stacked ensemble (~3 minutes)
# Saves xgb_model.pkl, lgb_model.pkl, meta_model.pkl, meta.json to artifacts/
python train.py

# Start the FastAPI service
python main.py
# → http://localhost:5001
```

Pre-trained artifacts are included in `ml/artifacts/` so you can skip training and go straight to `python main.py`.

### Frontend Setup

```bash
cd frontend
npm install

# Start dev server (proxies API calls to localhost:5000)
npm start
# → http://localhost:3000

# Production build
npm run build
```

### Quick Start (All Three Services)

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — ML Service
cd ml && python main.py

# Terminal 3 — Frontend
cd frontend && npm start
```

---

## 11. API Reference

All API routes are prefixed with `/api`. Worker routes require `Authorization: Bearer <token>` (JWT). Admin routes require an admin JWT.

### Authentication — `/api/auth`

| Method | Route | Description |
|---|---|---|
| POST | `/send-otp` | Send OTP to worker phone |
| POST | `/verify-otp` | Verify OTP, returns JWT |
| POST | `/register` | Register new worker (name, city, zone, platforms, income, UPI, shift) |
| POST | `/admin/login` | Admin login with username + password, returns admin JWT |

### Workers — `/api/workers`

| Method | Route | Description |
|---|---|---|
| GET | `/` | Get current worker profile |
| PATCH | `/` | Update worker profile |

### Policies — `/api/policies`

| Method | Route | Description |
|---|---|---|
| GET | `/active` | Get this week's active policy |
| POST | `/` | Create / renew policy for worker |
| GET | `/history` | Past policies |

### Claims — `/api/claims`

| Method | Route | Description |
|---|---|---|
| GET | `/` | Worker's claim history |
| POST | `/auto-process` | Trigger-based auto claim (body: `triggerType`, `triggerLevel`, `triggerSources`, `disruptionStart`, `disruptionEnd`, `actualEarned`) |
| POST | `/manual` | Manual claim submission |

### Triggers — `/api/triggers`

| Method | Route | Description |
|---|---|---|
| GET | `/status` | Check all trigger conditions for worker's city/zone |
| POST | `/simulate` | Simulate a disruption for demo (body: `triggerType`, `level`) |

### Admin — `/api/admin`

| Method | Route | Description |
|---|---|---|
| GET | `/stats` | Platform stats: workers, policies, claims, BCR, fraud distribution |
| GET | `/workers` | All workers with filters |
| GET | `/claims` | All claims with filters |
| GET | `/audit-logs` | Audit trail |
| POST | `/claims/:id/approve` | Manually approve a claim + trigger payout |
| POST | `/claims/:id/reject` | Manually reject a claim |
| POST | `/stress-test` | Simulate mass disruption event across portfolio |

### Webhooks — `/api/webhooks`

| Method | Route | Description |
|---|---|---|
| POST | `/razorpay` | Razorpay payment event handler (payment.captured, payout.processed, subscription events) |

### Chat — `/api/chat`

| Method | Route | Description |
|---|---|---|
| POST | `/` | Send message to KAVACH AI chatbot (README-informed, Claude API backend) |

### Health Check

```
GET /health → { status: "ok", service: "kavach-api", env: "development" }
```

---

## 12. Loophole Analysis & Failure-Proofing

| Loophole | Attack Vector | Defense |
|---|---|---|
| **Zone gaming** | Worker registers in safe zone, switches GPS to flooded zone | GPS trajectory analysis; PPCS cell tower check exposes home location |
| **Colluding workers** | Group fakes a "zone freeze" (community consensus) | UPI clustering + coordinated arrival-time spike detection; Isolation Forest on behavioral uniformity |
| **New account flooding** | Multiple accounts claim in first week | DPDP-linked phone = 1 identity; 30-point score penalty for week-1 accounts |
| **Pre-disruption app shutdown** | Worker turns off app before rain starts | DIT baseline comparison: if app was offline before disruption = "voluntarily offline" = no payout |
| **Last-minute policy purchase** | Policy bought as cyclone warning is issued | 24-hour policy seasoning period; +25 fraud score for policies < 24hr old |
| **API manipulation** | False weather data injection | Multi-source validation; all trigger API responses logged in AuditLog |
| **AQI fraud (indoor workers)** | Worker claims AQI disruption but completed orders anyway | Layer 2 cross-validates actual earnings against predicted loss |
| **Multiple platform double-dipping** | Claims Zomato disruption while earning on Swiggy | Cross-platform net income aggregation; `net_loss = predicted − sum(all_actual_earned)` |
| **Historical earning inflation** | Worker self-reports high income to inflate DIT | DIT uses `verifiedWeeklyIncome` when available; declared income subject to platform cross-check |
| **Velocity gaming** | Worker inflates claim window to get higher predicted loss | Velocity anomaly layer (4.5) compares hourly rate against worker's own 4-week baseline |

---

## 13. Adversarial Defense & Anti-Spoofing Strategy

This section addresses the threat scenario where a coordinated syndicate uses GPS-spoofing applications to fake their location inside a weather disruption zone while physically resting at home.

### The Differentiation — Genuine Worker vs. GPS Spoofer

A spoofed GPS signal is just a coordinate. A genuine worker leaves a fingerprint across multiple simultaneous data streams. The spoofing app can fake the coordinate — it cannot fake all correlated signals at once.

| Signal | Genuine Stranded Worker | GPS Spoofer at Home |
|---|---|---|
| **GPS jitter** | Natural micro-variation (0.5–3m, irregular cadence) | Unnaturally smooth or instant coordinate jump |
| **Device motion continuity** | Continuous accelerometer + location trail into zone | Location appears in zone at trigger time with no prior trajectory |
| **Cell tower IDs** | Match delivery zone; differ from home address tower | Match home address registered at onboarding |
| **Platform app heartbeat** | Zomato/Swiggy actively polling for orders | App polling stops or behaves inconsistently |

These four signals compute the **Physical Presence Confidence Score (PPCS)**. A payout is only auto-approved when PPCS ≥ 80 AND fraud score ≤ 30.

### Detecting Coordinated Fraud Rings

Individual spoofers are caught by PPCS. Coordinated rings are detected through graph-layer analysis:

- **Registration clustering:** Genuine zones have accounts registered across months/years. Rings recruited via Telegram show accounts created in the same narrow window.
- **Coordinated arrival time-spike:** Genuine workers drift into a disruption zone organically over 30–60 minutes. Ring members following instructions all "arrive" within minutes of each other.
- **Behavioral uniformity score:** In genuine disruptions, workers show varied behavior. Ring members following a script show unnaturally uniform idle patterns simultaneously.
- **UPI payout destination clustering:** If claimants from the same event share UPI handles from the same bank branch, the ring's financial infrastructure is exposed (Layer 7: `UPI_CLUSTER_RING_DETECTED`).

### Tiered Response Protocol — Protecting Honest Workers

The system never hard-rejects a claim on a single anomalous signal. It escalates proportionally:

**Tier 1 — Auto-Approve (PPCS ≥ 80, Fraud ≤ 30):** Payout in minutes. No action required. The experience for the vast majority of honest workers.

**Tier 2 — Soft Flag (PPCS ≥ 50, Fraud ≤ 60):** Payout approved, held 2 hours. WhatsApp: *"Your KAVACH payout is being processed. No action needed. Payout arrives by [time]."* No burden on the worker.

**Tier 3 — Verify (Fraud ≤ 80):** Payout held. WhatsApp requests a quick geotagged photo. Takes 10 seconds. CV model validates location consistency. If no response in 4 hours → manual review, never auto-rejected.

**Tier 4 — Manual Review (Fraud > 80):** Claim held. Worker notified in neutral language. One-tap appeal option provided. Never told they are "suspected of fraud."

### Why This Defeats the 500-Worker Syndicate

1. GPS spoofing produces smooth coordinates → **PPCS collapses on jitter + motion continuity**
2. Workers physically at home → **cell tower IDs expose home location**
3. Platform app behavior inconsistent → **heartbeat check fails**
4. All 500 arrive simultaneously → **coordinated arrival spike detected**
5. Accounts recently recruited → **registration clustering flagged**
6. Uniform idle behavior → **Isolation Forest flags behavioral uniformity**
7. Shared UPI infrastructure → **payout graph ring exposed**

A genuine worker stranded in the same zone passes all signals naturally. **The defense is invisible to honest workers and insurmountable to coordinated attackers.**

---

## 14. Recent Platform Implementations & Scaling

### 🌍 Localization & User Experience
- **Full Regional Translation System:** End-to-end localization with 2,000+ translation keys across English, Hindi, and Tamil — covering Onboarding, Dashboard, Policy, Claims, and Admin views.
- **Global AI Chatbot Widget:** Claude API-powered chatbot (`chatbotService.js`) with README-informed context, multi-turn conversation history (last 8 messages), topic-section routing, and keyword-based knowledge extraction. Available on all authenticated routes via `ChatbotWidget.jsx`.
- **Language Selector:** Persistent language preference stored in React Context; `LanguageSelector.jsx` component available globally.

### 🛡️ Compliance & Regulatory Framework
- **DPDP Act 2023 Consent Flow:** Three-consent capture during onboarding (GPS tracking, bank details, platform API polling). `dpdpConsent` object with `consentedAt` timestamp stored on every Worker document.
- **Social Security Code 2020 Engagement Tracking:** `platformActiveDays` and `engagementQualified` fields on Worker model track the 90/120-day active-day threshold for single vs. multi-platform workers.
- **Admin Compliance Dashboard:** Granular DPDP consent status visible per worker in `AdminDashboard.jsx`.

### 🚫 Risk Mitigation
- **Pre-emptive Adverse Selection Lockout:** New policy enrollment is blocked for workers in cities/zones currently experiencing Level 3+ alerts. Logic runs at policy creation time in `policies.js`.
- **Seasonal Trigger Probability:** `historicalDisruption.js` reads IMD historical disruption data from `historical_disruption.csv` and computes per-city seasonal trigger probabilities, directly feeding the surge loading calculation in `premiumService.js`.

### 🛠️ Core Engine Implementation
- **Automated Claim Processing Pipeline:** Full end-to-end zero-touch flow — trigger detected → DIT prediction → fraud scoring → payout decision → Razorpay disbursement → Sepolia ETH log → WhatsApp notification → AuditLog entry.
- **IST-Aware Shift Window Calculation:** `buildDateAtTime()` in `claims.js` correctly handles IST (UTC+5:30) shift boundaries for accurate overlap calculation between disruption windows and worker shifts.
- **4 Scheduled Cron Jobs:**
  - **Monday 00:01 IST** — Expire last week's policies, increment claims-free counters, auto-renew policies for verified workers
  - **Every 30 minutes** — Trigger monitor scans OpenWeatherMap, CPCB AQI, platform heartbeats for all active workers; initiates auto-claim if triggered
  - **Monday 01:00 IST** — Recompute `avgEarningsPerHour` and `avgOrdersPerHour` per worker from 4-week rolling claim history (requires ≥ 3 approved claims for meaningful baseline)
  - **Daily 00:00 IST** — Escalate stale pending claims (>24 hours) to `manual_review`
- **Blockchain Integration:** `blockchainService.js` generates a SHA-256 hash of the payout receipt (claim ID, worker ID, amount, trigger type, fraud score, Razorpay ref, timestamp) and logs it on Sepolia ETH as a zero-value self-transfer with the full JSON payload in the `data` field — readable directly on Etherscan. Non-fatal: payout succeeds even if blockchain logging fails.

### 📊 Administration & Analytics
- **Admin Dashboard Analytics:** BCR (Burning Cost Ratio) calculation; claims by trigger type; claims by city; 7-day daily claim trend; fraud score distribution (0–30, 31–60, 61–80, 81–100 buckets); worker city/zone breakdown with expandable groups.
- **Stress-Test Simulation:** Admin tool to project portfolio impact under worst-case monsoon scenarios across 2K/5K/10K worker portfolios.
- **Simulated Portfolio Validation:** Tested with 2,000+ active workers and 3,000+ realistic claims; BCR maintained below 50% target at simulated scale.

### 🤖 ML Service
- **Stacked Ensemble (XGBoost + LightGBM + Ridge):** Trained on 60,000 synthetic samples via 5-fold cross-validation. R² 0.9874, MAE ₹16.79. Pre-trained artifacts shipped in `ml/artifacts/`.
- **Delivery-Time Integration:** Kaggle food delivery dataset schema used to derive `orders_per_hour` as the central predictive signal — capturing how disruptions reduce order throughput, not just per-order pay.
- **Rule-Based Fallback:** Automatic fallback when ML service is unreachable; `predictionSource` recorded in AuditLog.
- **Retraining Pipeline:** `generate_data.py` + `train.py` can retrain on fresh synthetic data in ~3 minutes; or supply real claim data with `python train.py path/to/real_claims.csv`.

---

## Summary: Why KAVACH Wins

| Dimension | Traditional Parametric | KAVACH |
|---|---|---|
| Payout accuracy | Flat amount (over/under pays everyone) | Precise per-worker predicted loss (R² 0.9874) |
| Fraud resistance | Single layer (claim threshold) | 7-layer engine + PPCS + ring detection |
| Pricing fairness | One-size zone premium | Hyper-local + behavioral + seasonal + surge |
| Trigger reliability | Single API source | Multi-source validation (3+ independent feeds) |
| Multi-platform workers | Ignores secondary platforms | Cross-platform net income aggregation |
| New worker handling | No history = flat estimate | Rule-based fallback; cohort model for cold start |
| Coverage granularity | Full day / half day | Shift-window precision (IST-aware) |
| Worker communication | App notification | WhatsApp-first + AI chatbot |
| Audit trail | Internal database | Immutable on-chain (Sepolia ETH, Etherscan-verifiable) |
| Business sustainability | High fraud → unsustainable | Built-in fraud defense → validated <50% BCR |

---

*KAVACH is not just parametric insurance. It is the first system to give gig workers a true income mirror — one that knows exactly what they lost, pays exactly what they're owed, and does it in under 30 minutes — every time.*

---

**Phase 2 Prototype:** [https://kavach-sage-iota.vercel.app/]
**Phase 1 Demo Video:** [https://drive.google.com/drive/folders/15QooszWazdxGJhgMfVfFb2STf7PS5G2z]
**Phase 2 Demo Video:** [https://drive.google.com/drive/folders/15QooszWazdxGJhgMfVfFb2STf7PS5G2z]
