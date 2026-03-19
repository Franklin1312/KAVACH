# KAVACH — AI-Powered Parametric Income Shield for India's Gig Delivery Workers

---

## Table of Contents

1. [Executive Vision](#1-executive-vision)
2. [Persona Selection & Deep Analysis](#2-persona-selection--deep-analysis)
3. [The Core Innovation: Digital Income Twin (DIT)](#3-the-core-innovation-digital-income-twin-dit)
4. [Application Workflow & Persona Scenarios](#4-application-workflow--persona-scenarios)
5. [Weekly Premium Model — How It Works](#5-weekly-premium-model--how-it-works)
6. [Parametric Trigger Architecture](#6-parametric-trigger-architecture)
7. [AI/ML Integration Plan](#7-aiml-integration-plan)
8. [Fraud Detection Architecture](#8-fraud-detection-architecture)
9. [Platform Choice: Web + Mobile (Progressive Web App)](#9-platform-choice-web--mobile-progressive-web-app)
10. [Tech Stack & Architecture](#10-tech-stack--architecture)
11. [6-Week Development Plan](#11-6-week-development-plan)
12. [Loophole Analysis & Failure-Proofing](#12-loophole-analysis--failure-proofing)
13. [Business Viability](#13-business-viability)
14. [Phase 1 Prototype Scope](#14-phase-1-prototype-scope)

---

## 1. Executive Vision

India has over **12 million** platform-based gig delivery workers. They earn between ₹12,000–₹22,000 per month and have **zero income safety net** when external disruptions — extreme rainfall, flash floods, AQI spikes, civil curfews, or platform outages — force them off the road.

The problem with existing parametric insurance globally is that it pays a **flat, trigger-based payout** regardless of whether the worker actually lost income. This creates moral hazard, premium inflation, and is actuarially unsound at scale.

**KAVACH solves this with a breakthrough concept: the Digital Income Twin (DIT).**

Rather than paying flat amounts when a trigger fires, KAVACH builds a personalized AI model for each worker — their Digital Income Twin — that knows precisely what they would have earned during any time window, based on their own historical earning patterns, zone, shift, and platform. When a disruption occurs:

1. **External triggers confirm** the disruption is real (multi-source validation)
2. **The DIT predicts** what the worker would have earned in that period
3. **Platform activity data confirms** the worker genuinely couldn't work
4. **Payout = Predicted Loss**, not a flat amount

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

## 3. The Core Innovation: Digital Income Twin (DIT)

The Digital Income Twin is the intellectual core of KAVACH. It is a **personalized earning prediction model** built per worker.

### What the DIT Learns

During onboarding + the first 4 weeks of data collection, the DIT model learns:

```
Earning_Predicted(worker_id, time_window) = f(
  day_of_week,
  hour_of_day,
  week_of_month,        ← month-end rush vs mid-month slump
  zone_order_density,   ← Anna Nagar vs Velachery differ at 7PM
  season,               ← Monsoon period changes baseline
  platform_load,        ← Zomato server performance
  local_event_calendar, ← IPL match = surge; election day = curfew risk
  worker_tenure,        ← experienced worker earns 20% more
  worker_tier           ← Zomato Gold vs Silver bonus structure
)
```

### Why This Beats Flat Parametric

| Scenario | Flat Parametric (Basic) | KAVACH DIT |
|---|---|---|
| Heavy rain on a Monday morning (worker's off day) | Pays ₹500 payout | ₹0 (DIT knows worker doesn't work Mondays) |
| Rain during lunch rush (12–2 PM, peak hours) | Pays ₹500 payout | Pays ₹420 (actual 2-hour earning loss) |
| New worker (week 1, no history) | Pays ₹500 payout | Uses city-zone cohort average |
| Worker was already sick and not working | Pays ₹500 payout | Platform shows 0 activity BEFORE rain = no loss = no payout |
| Worker works on Swiggy during Zomato disruption | Pays ₹500 payout | Net income calculated across platforms; partial payout only |

The DIT makes KAVACH **the only parametric insurance product in India that pays what was actually lost** — not an arbitrary estimate.

### DIT Cold Start Problem (New Workers)

For workers with less than 4 weeks of data:
- **Week 1–2:** Use city + zone + platform cohort median earnings model
- **Week 3:** Blend cohort model (70%) + personal data (30%)
- **Week 4+:** Transition to full personal DIT model

---

## 4. Application Workflow & Persona Scenarios

### Workflow Overview

```
WORKER ONBOARDING
     │
     ▼
[1] REGISTRATION & KYC
     • Phone number + Aadhaar verification
     • Platform ID linkage (Zomato Partner ID / Swiggy Partner ID)
     • Zone selection (home zone + active delivery zones)
     • Income declaration (cross-verified with platform data)
     │
     ▼
[2] RISK PROFILING
     • AI risk score generated (zone risk, season, platform seniority)
     • Weekly premium quoted
     • Coverage tier selection (Basic 50% / Standard 70% / Premium 85%)
     │
     ▼
[3] WEEKLY POLICY ACTIVATION
     • UPI AutoPay mandate for weekly premium (e.g., every Monday)
     • Policy active from 00:01 Monday to 23:59 Sunday
     • Worker receives WhatsApp confirmation
     │
     ▼
[4] REAL-TIME DISRUPTION MONITORING (automated, continuous)
     • Weather APIs + AQI monitors + traffic + civil alert feeds
     • Disruption threshold crossed → Trigger Evaluation Engine fires
     │
     ▼
[5] AUTOMATED CLAIM PROCESS
     • System cross-validates disruption (3-source confirmation)
     • Worker's platform activity confirmed zero/reduced
     • DIT calculates predicted income loss for the window
     • Fraud engine runs anomaly checks
     • Payout amount computed and approved (or flagged for manual review)
     │
     ▼
[6] PAYOUT
     • UPI transfer to registered account within 12–30 minutes
     • WhatsApp/SMS notification with full breakdown
     • Worker dashboard updated
```

---

### Scenario A: Heavy Rain Disruption (Ravi, Chennai, Tuesday, 7 PM)

**Situation:** Northeast monsoon rainfall reaches 45mm/hour in Anna Nagar zone at 7:05 PM.

| Step | Action | System Response |
|---|---|---|
| 7:05 PM | IMD rainfall API reports 45mm/hr in pin codes 600040, 600101 | Trigger monitoring detects threshold breach |
| 7:07 PM | Cross-validated with OpenWeatherMap (47mm/hr) + Twitter/X flood alerts API (geo-tagged #ChennaiRains in zone) | 3/3 sources confirm → Trigger fires |
| 7:08 PM | Zomato Partner API shows Ravi: 0 new orders assigned in last 20 mins, app active but no delivery | Activity validation: genuine stoppage |
| 7:09 PM | DIT model: "Ravi typically earns ₹280 between 7–9 PM on Tuesdays" | Predicted loss window: 7–9 PM = ₹280 |
| 7:09 PM | Fraud engine: 23 other Zomato partners in same zone also idle. Score: LOW FRAUD RISK | Green flag |
| 7:10 PM | Payout: 70% coverage × ₹280 = ₹196, auto-approved | UPI transfer initiated |
| 7:12 PM | Ravi receives ₹196 in his UPI account + WhatsApp: "KAVACH Alert: ₹196 income protection payout for rain disruption, 7–9 PM, Anna Nagar" | Worker notified |

**If rain stops at 9 PM:** System re-evaluates every 30 minutes. If Ravi resumes orders by 9:30 PM, his DIT notes the actual resumed earnings and no further payout is issued.

---

### Scenario B: Platform Outage (Swiggy App Down, Priya, Delhi, Friday)

**Situation:** Swiggy backend goes down from 1:00 PM to 3:30 PM on a Friday due to server issues.

- **Trigger source:** Swiggy API response time >10 seconds continuously for 15 minutes (monitored via heartbeat) + Downdetector API spike + social media volume
- **DIT predicts:** Priya earns ₹310 on Friday 1–3 PM (peak lunch slot)
- **Validation:** Swiggy Partner App shows 0 order assignments; GPS shows Priya stationary at pickup zone (she was ready to work, not resting at home)
- **Payout:** 70% × ₹310 = ₹217 within 15 minutes of outage confirmation

---

### Scenario C: Curfew/Bandh (Suresh, Bengaluru)

**Situation:** An unplanned district-level curfew imposed at 6 AM, effective until 8 PM.

- **Trigger source:** Karnataka government press release API + Bengaluru Police Twitter feed + geo-tagged news API (all within 10 minutes of curfew announcement)
- **DIT predicts:** Suresh earns ₹620 on a typical Thursday (8 AM–8 PM combined Zomato + Swiggy)
- **Pre-emptive policy trigger:** System flags the policy active before Suresh even wakes up
- **Payout:** 70% × ₹620 = ₹434 processed at 8:01 AM

**Key edge case handled:** If Suresh somehow manages to still complete 4 deliveries via a less restricted zone — his actual earnings are deducted. Payout = 70% × (₹620 - ₹180 actual earned) = ₹308. Not ₹434. The DIT tracks actual platform earnings in real time.

---

### Scenario D: Partial Disruption + Multi-Platform Worker (Arjun, Mumbai)

**Situation:** Waterlogging blocks deliveries in South Mumbai but not Bandra. Arjun works in South Mumbai for Zomato.

- **Trigger:** Flood zone localized to pin codes 400001–400005 only
- **KAVACH's hyper-local engine** confirms: Arjun's active zone IS in the flood zone (GPS verified)
- **Arjun is also registered on Swiggy**, but Swiggy routes him to Bandra — he earns ₹200 there
- **DIT predicts:** Total expected = ₹800 for the day (combined both platforms)
- **Net verified loss:** ₹800 - ₹200 (Swiggy earnings) = ₹600
- **Payout:** 70% × ₹600 = ₹420

**This prevents double-dipping:** Arjun cannot claim full income loss when he was still earning on a second platform.

---

## 5. Weekly Premium Model — How It Works

### Pricing Philosophy

KAVACH uses a **micro-actuarial weekly pricing model** — not monthly, not annual. Every Monday, the premium for the coming week is recalculated using the latest data about:
- Historical disruption frequency in the worker's zone (rolling 90 days)
- Predicted weather risk for the upcoming week (7-day forecast)
- Worker's own claims history and fraud score
- Current season risk multiplier

### Premium Calculation Formula

```
Weekly Premium = (Base_Rate × Zone_Risk_Factor × Season_Multiplier)
                 - Claims_Free_Discount
                 + Surge_Risk_Loading
```

#### Component Breakdown

**Base Rate:** Derived from worker's declared + platform-verified weekly income

| Weekly Income Band | Base Rate (% of income) |
|---|---|
| ₹2,000 – ₹3,500 | 0.85% |
| ₹3,501 – ₹5,500 | 0.80% |
| ₹5,501 – ₹8,000 | 0.75% |
| ₹8,001+ | 0.70% |

**Zone Risk Factor:** ML-derived from 5 years of weather, flood, and civil disruption data per pin code

| Zone Classification | Multiplier |
|---|---|
| Low risk (inland, elevated, historically quiet) | 0.85× |
| Moderate risk (urban core, moderate flood history) | 1.00× |
| High risk (coastal, riverine, historically flooded) | 1.30× |
| Extreme risk (T-18 cyclone zone, flood-prone low-lying) | 1.55× |

**Season Multiplier:**

| Season | Multiplier | Applies to Cities |
|---|---|---|
| Northeast Monsoon (Oct–Dec) | 1.45× | Chennai, Bengaluru |
| Southwest Monsoon (Jun–Sep) | 1.55× | Mumbai, Bengaluru |
| Winter smog season (Nov–Feb) | 1.20× | Delhi, NCR |
| Dry/summer months | 0.80× | All cities |

**Claims-Free Discount:** Persistent 4-week no-claim window earns -8% off next week's premium. Sustained 8+ weeks no-claim = -15%. Resets on any payout.

**Surge Risk Loading:** If the 7-day weather forecast shows >70% probability of a trigger-level event, a surge loading of +₹5–₹15 is added. Workers are notified in advance and can opt out (losing coverage for that week only).

### Real Example: Ravi's Weekly Premium Calculation

```
Ravi's verified weekly income:     ₹6,100
Base Rate (₹5,501–₹8,000 band):   0.75% × ₹6,100 = ₹45.75
Zone Risk Factor (Anna Nagar,
  coastal-adjacent, moderate):     1.00× → ₹45.75
Season Multiplier (November,
  NE Monsoon peak):                1.45× → ₹66.34
Claims-Free Discount (8 weeks):    -15% → -₹9.95
Surge Loading (cyclone warning
  in forecast):                    +₹8.00
────────────────────────────────────────
FINAL WEEKLY PREMIUM:              ₹64.39 → rounded to ₹65
```

Ravi's maximum coverage for that week: 70% of ₹6,100 = **₹4,270 in protected income**.

For ₹65/week, Ravi protects up to ₹4,270 in potential income. That is a **65.7× value ratio on premium spent**, making KAVACH extraordinarily accessible.

### Coverage Tiers

| Tier | Payout % of Predicted Loss | Weekly Price Multiplier | Best For |
|---|---|---|---|
| Basic | 50% | 0.7× | Occasional workers, low income |
| Standard | 70% | 1.0× (base) | Full-time partners (recommended) |
| Premium | 85% | 1.35× | Top earners, high-risk zones |

### What the Premium Does NOT Cover

- Health, life, accident, or vehicle repair (strictly excluded per problem statement)
- Self-caused disruptions (worker switches off the app voluntarily)
- Disruptions not crossing verified parametric thresholds
- Income lost due to customer cancellations, low ratings, or voluntary breaks

---

## 6. Parametric Trigger Architecture

KAVACH uses a **Tiered Multi-Source Trigger Validation** system. A payout trigger requires a minimum of 3 independent data sources to confirm the disruption event. Single-source triggers are never auto-approved.

### Trigger Categories & Thresholds

#### ENVIRONMENTAL TRIGGERS

| Event | Primary Source | Threshold | Backup Source | Geo-Precision |
|---|---|---|---|---|
| Heavy Rainfall | IMD Rainfall API | >35mm / 3 hours | OpenWeatherMap | Pin code level |
| Extreme Heat | IMD Temperature API | Heat Index >46°C | Weather.com | City level |
| Flash Flood | CWC (Central Water Commission) River API | Level alert RED | NDRF alert + Twitter geo | Zone level |
| Severe AQI | CPCB AQI API | AQI > 400 (Severe) | AirVisual API | Zone level |
| Cyclone Warning | IMD Cyclone Alert | Yellow/Orange/Red warning | Govt press API | City/district |

#### SOCIAL / CIVIL TRIGGERS

| Event | Primary Source | Threshold | Backup Source | Geo-Precision |
|---|---|---|---|---|
| Curfew / Section 144 | State Police Twitter API | Official announcement | PIB press release API | District level |
| Bandh / Strike | News NLP classifier (trained) | 3+ credible news sources within 1 hour | Union official announcements | City level |
| Zone Closure | Municipal corporation API | Official closure notice | Google Maps road closure data | Street level |

#### PLATFORM TRIGGERS (Novel — not in standard parametric products)

| Event | Source | Threshold | Backup |
|---|---|---|---|
| Platform Outage | Zomato/Swiggy heartbeat API | API p95 latency >8s for 15 minutes | Downdetector score >500 + Twitter volume |
| Zone Supply Freeze | Platform Partner API | <5 orders assigned in zone in 30 min | Cross-worker validation (15+ workers idle) |
| Restaurant Zone Closure | Platform data + Google Places | >60% of zone restaurants marked closed | MCD/GHMC closure notices |

### 3-Source Confirmation Logic

```
TRIGGER_CONFIRMED = (
    primary_source_threshold_met = TRUE
    AND (backup_source_1_confirms OR backup_source_2_confirms)
    AND worker_zone_intersects_disruption_zone = TRUE
    AND worker_was_active_at_trigger_time = TRUE
)
```

This design means:
- A weather API glitch alone cannot trigger payouts
- A viral but unverified Twitter rumor alone cannot trigger payouts
- Even confirmed rain in another city part of Chennai does not trigger Ravi's policy if his zone is unaffected

### Trigger Escalation Levels

| Level | Severity | Payout % Multiplier | Threshold |
|---|---|---|---|
| Level 1 — Minor | Threshold barely crossed | 0.6× | 35–50mm rain in 3hr |
| Level 2 — Moderate | Clearly significant | 0.85× | 50–75mm rain in 3hr |
| Level 3 — Major | Severe disruption | 1.0× | 75–100mm rain in 3hr |
| Level 4 — Catastrophic | Force majeure event | 1.0× (capped at policy max) | >100mm / cyclone / curfew |

Levels 1 and 2 are **partial payouts** — reflecting that workers may still manage some deliveries despite a moderate disruption. This is actuarially more honest and prevents "light rain = full payout" abuse.

---

## 7. AI/ML Integration Plan

### Component 1: Digital Income Twin (DIT) — Earning Prediction Model

**Algorithm:** Gradient Boosted Trees (XGBoost) per worker

**Features:**
- Hour of day (24 categorical + cyclical encoding)
- Day of week (7 categorical)
- Week of month (1–5)
- Month (seasonal encoding)
- Zone order density (from platform API, real-time)
- Platform (Zomato / Swiggy / combined)
- Worker tenure (months on platform)
- Worker rating tier (Gold / Silver / Bronze)
- Local event flags (IPL, elections, festivals — from Google Calendar API + custom event DB)
- Historical 7-day moving average earnings

**Training:** On each worker's own platform earnings data (with consent). Cold-start: city-zone cohort median until 4 weeks of personal data available.

**Output:** Predicted earnings in INR for any given time window (down to 30-minute intervals)

**Retraining frequency:** Weekly incremental retraining with latest 7 days of data

---

### Component 2: Zone Risk Scoring Model

**Algorithm:** Random Forest on geospatial + historical disruption data

**Features:**
- Historical rainfall events per pin code (5 years, IMD data)
- Historical flood events (CWC data)
- Elevation data (SRTM 30m resolution)
- Distance to coast / river
- Urban drainage quality score (municipal data)
- Historical civil disruption frequency
- Population density

**Output:** Zone risk score (0.5–2.0) used directly in premium calculation

**Updates:** Quarterly model re-run with latest climate and municipal data

---

### Component 3: Dynamic Weekly Premium Engine

**Algorithm:** Rule-based engine backed by ML-derived coefficients

**Inputs:** DIT-verified income, zone risk score, season model, claims history, 7-day weather forecast risk score

**Output:** Weekly premium in INR, per tier

---

### Component 4: Fraud Anomaly Detection Model

**Algorithm:** Isolation Forest + LSTM-based sequence anomaly detector

**See Section 8 for full detail.**

---

### Component 5: NLP Disruption Classifier (for social/civil triggers)

**Algorithm:** Fine-tuned BERT (multilingual, to handle Hindi, Tamil, Hinglish tweets/news)

**Input:** Live Twitter/X stream, Google News RSS, government press release feeds

**Purpose:** Classify social media posts and news articles as "confirmed disruption event" vs "rumor" vs "unrelated"

**Training data:** Historical tagged corpus of bandh/curfew/strike announcements from 2019–2024, 5 major Indian cities

---

### Component 6: Computer Vision — Receipt/Photo Validation (Phase 3 optional)

When fraud risk score is ELEVATED, KAVACH can optionally request a geotagged photo or a dashboard screenshot from the worker as secondary confirmation. A lightweight CV model validates:
- GPS metadata matches claimed zone
- Timestamp matches disruption window
- Photo content is consistent (rain/flooded road visible, or delivery bag visible but worker stationary)

---

## 8. Fraud Detection Architecture

Fraud is the single greatest risk to parametric insurance viability. KAVACH's fraud system has **7 independent layers** — a fraudster must defeat all 7 simultaneously for a false claim to succeed.

### Layer 1: Zone-Event Correlation

**Question:** Was the worker genuinely in the disruption zone?

- GPS location at trigger time cross-checked against disruption zone polygon
- Worker must be within zone for >20 minutes in the 30-minute pre-trigger window
- Spoofing detection: GPS reading frequency and coordinate jitter analyzed (real GPS has minor natural jitter; spoofed GPS is suspiciously smooth or teleports)

### Layer 2: Platform Activity Cross-Validation

**Question:** Did the platform data actually show no deliveries?

- API call to Zomato/Swiggy Partner endpoint: number of orders completed in trigger window
- If worker completed >2 orders during a supposed full-disruption period → claim rejected
- If platform shows worker was "offline" (app closed) before disruption started → suspicious flag (worker may have preemptively gone offline to claim)

### Layer 3: Community Consensus Validation

**Question:** Is this worker the only one claiming, or did the whole zone stop?

- In genuine disruptions, **15+ workers in the same zone** show identical idle patterns
- If fewer than 3 workers in a zone are showing zero activity → anomaly flag
- If a single worker is claiming but 20 nearby workers are still active → high fraud risk score, escalates to manual review

This layer alone eliminates virtually all individual false claim attempts, because a real disruption affects everyone, not just one person.

### Layer 4: Historical Behavioral Baseline

**Question:** Does this worker's claim pattern look normal?

- Each worker has a **behavioral fingerprint**: frequency of claims, timing of claims, zones of claims
- New users with no history who immediately claim on week 1: elevated scrutiny
- Workers with sudden changes in zone just before a disruption event: flagged (zone-switching to enter a disruption zone)
- Workers whose claim rate significantly exceeds their zone cohort: escalated

### Layer 5: Duplicate Claim Prevention

- Each policy covers one loss event per trigger window
- A single disruption event cannot generate multiple claims from the same worker
- Cross-platform check: worker claiming on KAVACH for Zomato outage but platform shows Swiggy income earned = deducted from payout
- Multi-account detection: Aadhaar + phone linkage ensures one identity = one policy

### Layer 6: Earnings Continuity Audit

**Question:** Did the worker's actual earnings suddenly resume the moment the payout was processed?

- Platform data monitored post-payout
- Pattern: worker claims full disruption → receives payout → immediately completes 8 orders within 30 minutes of payout = suspicious "waiting it out" behavior
- This pattern scored and used in long-term fraud modeling

### Layer 7: Real-Time Fraud Score (Isolation Forest)

All the above signals are aggregated in real-time into a fraud score (0–100).

| Score Range | Action |
|---|---|
| 0–30 | Auto-approve payout |
| 31–60 | Approve with audit flag for post-payout review |
| 61–80 | Hold payout, request secondary confirmation from worker (geotagged photo, or WhatsApp confirmation) |
| 81–100 | Reject claim, escalate to manual review team + notify worker of reason |

### Key Anti-Abuse Rules

1. **No retroactive claims:** Worker must be an active policy holder BEFORE the disruption event. Last-minute policy purchases minutes before a known cyclone are rejected (window: policy must have been active for at least 24 hours).
2. **Geographic consistency:** Worker cannot suddenly change their registered zone the day before a localized flood.
3. **Platform linkage required:** Unlinked platform ID = no automated claim. Manual-only with additional KYC.
4. **Cooling-off period for new accounts:** Week 1 policies: claims require human review regardless of fraud score.

---

## 9. Platform Choice: Web + Mobile (Progressive Web App)

**Decision: Progressive Web App (PWA)**

### Justification

| Criterion | Native App | PWA |
|---|---|---|
| Development cost | High (separate iOS + Android) | Single codebase |
| Gig worker device profile | Mid-range Android, 3G/4G | PWA works on 3G |
| Offline capability | App-dependent | Service Worker enables offline |
| Update mechanism | App Store approval delay | Instant |
| Deep link to WhatsApp flows | Limited | Full support |
| Low storage devices | ~80MB app | ~2MB PWA |
| Admin/insurer dashboard | Separate web app needed | Same codebase |

PWA is the only rational choice for a product aimed at gig workers in Tier 2 and Tier 3 cities who are using entry-level Android devices on constrained data plans.

**Key UX Principles for the PWA:**
- Primary language: English + Hindi + Tamil + Telugu + Kannada (i18n from Day 1)
- Zero-tap claim confirmation (claim auto-initiates; worker only confirms if fraud flagged)
- WhatsApp as the primary notification channel (not push notifications, which workers disable)
- Dashboard loads in <2 seconds on 3G (critical for adoption in non-metro cities)

---

## 10. Tech Stack & Architecture

### System Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  KAVACH PLATFORM                      │
│                                                       │
│  ┌──────────────┐     ┌──────────────────────────┐   │
│  │  Worker PWA   │     │   Admin/Insurer Dashboard │   │
│  │  (React.js)   │     │   (React.js)              │   │
│  └──────┬───────┘     └───────────┬──────────────┘   │
│         │                         │                   │
│  ┌──────▼─────────────────────────▼──────────────┐   │
│  │           API Gateway (Node.js/Express)         │   │
│  └──────────────────────┬─────────────────────────┘   │
│                         │                             │
│    ┌────────────────────┼─────────────────────────┐   │
│    │                    │                          │   │
│  ┌─▼──────────┐  ┌─────▼────────┐  ┌────────────▼─┐  │
│  │Policy &    │  │Trigger &     │  │ML Services   │  │
│  │Premium     │  │Claims Engine │  │(FastAPI)     │  │
│  │Service     │  │(Node.js)     │  │              │  │
│  │(Node.js)   │  │              │  │- DIT Model   │  │
│  └─────┬──────┘  └──────┬───────┘  │- Fraud Model │  │
│        │                │          │- Zone Risk   │  │
│        │                │          │- NLP Engine  │  │
│        │         ┌──────▼───────┐  └──────────────┘  │
│        │         │ Trigger      │                     │
│        │         │ Orchestrator │                     │
│        │         │ (Redis Queue)│                     │
│        │         └──────┬───────┘                     │
│        │                │                             │
│  ┌─────▼────────────────▼──────────────────────────┐  │
│  │                  PostgreSQL                      │  │
│  │  (Workers | Policies | Claims | Audit Logs)      │  │
│  └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘

EXTERNAL INTEGRATIONS:
- IMD Rainfall API         → Trigger Orchestrator
- OpenWeatherMap API       → Trigger Orchestrator
- CPCB AQI API            → Trigger Orchestrator
- CWC Flood Level API     → Trigger Orchestrator
- Twitter/X Streaming API → NLP Engine → Trigger Orchestrator
- Zomato Partner API      → Claims Engine + DIT Training
- Swiggy Partner API      → Claims Engine + DIT Training
- Razorpay API            → Payment/Payout Service
- WhatsApp Business API   → Notification Service
- Aadhaar/DigiLocker API  → KYC Service
```

### Technology Choices

| Layer | Technology | Justification |
|---|---|---|
| Frontend | React.js (PWA) | PWA-first, TypeScript, fast development |
| API Layer | Node.js + Express | Fast async I/O for real-time trigger handling |
| ML Services | Python + FastAPI | Data science ecosystem (pandas, scikit-learn, XGBoost) |
| Database | PostgreSQL | ACID compliance, geospatial support (PostGIS) |
| Cache / Queue | Redis | Real-time trigger queue, session cache, rate limiting |
| Scheduler | Apache Airflow | Weekly premium calculation, DIT retraining pipelines |
| ML Ops | MLflow | Model versioning, experiment tracking, DIT model registry |
| Infrastructure | AWS (or GCP) | EC2/ECS for services, RDS for PostgreSQL, S3 for model artifacts |
| Messaging | WhatsApp Business API | Primary communication channel for gig workers |
| Payments | Razorpay | UPI AutoPay for premiums, UPI Payout for claims |
| KYC | Aadhaar API (Sandbox) | Identity verification |
| Geospatial | PostGIS + Turf.js | Zone polygon intersection checks |
| Monitoring | Grafana + Prometheus | Real-time system monitoring |

---

## 11. 6-Week Development Plan

### Phase 1: Weeks 1–2 — Ideation & Foundation (Current Phase)

**Deliverables:**
- [x] This README.md
- [ ] 2-minute strategy video
- [ ] GitHub repository with folder structure
- [ ] Wireframes for worker onboarding flow (Figma)
- [ ] DIT model proof-of-concept (Jupyter Notebook with synthetic data)
- [ ] Mock weekly premium calculator (interactive HTML)

**Team Focus:**
- Architecture design and finalization
- API research and mock data setup
- Database schema design
- Figma wireframes for all 4 core screens (onboarding, dashboard, policy, claims)

---

### Phase 2: Weeks 3–4 — Automation & Protection

**Deliverables:**
- Worker registration + KYC flow (functional)
- Platform ID linkage (Zomato/Swiggy — mock API simulation)
- Policy creation with dynamic weekly premium calculator
- DIT model: basic version running on synthetic data
- 5 automated trigger monitors (rain, AQI, curfew, platform outage, zone freeze)
- Claims management: auto-trigger → auto-approve flow (end-to-end, with mocked payout)
- Basic fraud engine: layers 1–3 implemented

**Key Milestones:**
- End-to-end automated claim flow works for at least 2 trigger types
- Weekly premium recalculates on schedule
- Worker dashboard shows policy status, coverage amount, claim history

---

### Phase 3: Weeks 5–6 — Scale & Optimise

**Deliverables:**
- Full fraud detection system: all 7 layers
- Razorpay integration: UPI AutoPay for premiums + UPI Payout API for claims
- WhatsApp Business API for notifications
- Insurer analytics dashboard: loss ratios, zone risk maps, predictive next-week disruption analytics
- Worker dashboard: earnings protected this week, claims history, DIT insight ("You would have earned ₹420 in that window")
- Performance: claim auto-approval pipeline to run in <5 minutes end-to-end
- Multi-language support: Hindi + Tamil interface in addition to English

---

## 12. Loophole Analysis & Failure-Proofing

This section documents every scenario where the system could be gamed or fail — and our defense.

| Loophole | Attack Vector | Defense |
|---|---|---|
| **Zone gaming** | Worker registers in a safe zone, switches GPS to a flooded zone during disruption | GPS trajectory analysis: worker must show consistent location history in zone for >7 days; sudden zone change = freeze claim for manual review |
| **Colluding workers** | Group of workers coordinate to fake a "zone freeze" event (Community Validation Layer 3 requires 15+ workers idle) | Isolation Forest on earnings patterns: genuine disruptions have normal distribution of idle workers; coordinated fraud shows suspicious clustering in account age and registration date |
| **New account flooding** | Creating multiple accounts to claim in first week | Aadhaar linkage = 1 person = 1 account. Cooling-off period for week-1 claims. Device fingerprinting (1 device = 1 account flag) |
| **Pre-disruption app shutdown** | Worker turns off the app before the rain starts (no orders → no income to compare against) to later claim "I couldn't work" | DIT compares to baseline. If worker's app was offline BEFORE disruption = "voluntarily offline" = no payout. Only workers with the app ONLINE but unable to receive orders get paid. |
| **Last-minute policy purchase** | Worker buys policy right as a cyclone warning is issued | 24-hour policy seasoning period. Policy purchased after a public weather alert for that region is issued = auto-pended for that specific event. |
| **API manipulation** | Developer gains API access and injects false weather data | Multi-source validation (3 independent sources). Our infrastructure never trusts a single feed. All triggers logged with raw API responses for audit. |
| **Platform API unavailability** | Zomato/Swiggy does not give API access | Phase 1–2 uses mocked/simulated APIs. Phase 3 explores platform partnership. Fallback: worker provides app screenshot → CV model validates. |
| **AQI fraud (indoor workers claiming)** | Worker who delivers by motorbike claims AQI disruption but was working anyway | GPS + platform data: if orders were completed, no payout regardless of trigger. AQI payout requires BOTH: AQI threshold crossed AND zero order completions in that window. |
| **Trigger threshold manipulation** | Worker pressures insurer to lower trigger thresholds | Thresholds are hard-coded in smart contract logic (Phase 3: optionally on-chain for immutability). Changes require dual governance approval (insurer + actuarial team). |
| **Multiple platform double-dipping** | Worker claims Zomato disruption, earns on Swiggy, claims full loss | Cross-platform income aggregation. Net income = Zomato earned + Swiggy earned. Payout = 70% × (DIT_predicted - net_actual_earned). |
| **Historical earning inflation** | Worker manipulates historical earnings to inflate DIT predictions | DIT is trained on direct platform API data, not worker-self-reported figures. Worker cannot inflate the baseline — only the platform data can do so. |

---

## 13. Business Viability

### Unit Economics (Steady-State, Per Worker)

```
Average weekly premium:           ₹58
Claim frequency (food delivery,
  Chennai, monsoon period):       ~18% of weeks
Average payout per claim:         ₹285
Expected weekly claim cost:       0.18 × ₹285 = ₹51.30

Gross profit per worker/week:     ₹58 - ₹51.30 = ₹6.70 (~11.6% margin)
Annual gross profit per worker:   ₹6.70 × 52 = ₹348
```

At 100,000 enrolled workers: ~₹3.48 crore annual gross profit
At 1,000,000 enrolled workers: ~₹34.8 crore annual gross profit

**Break-even requires approximately 50,000 active policy holders** to cover platform costs.

India's gig delivery workforce: ~12 million. KAVACH's TAM is enormous.

### Revenue Model

1. **Premium income** (primary) — weekly premiums from workers
2. **Platform B2B licensing** — Zomato/Swiggy pay KAVACH to offer KAVACH as a first-party benefit to their partners (competitive advantage for platforms in worker retention)
3. **Reinsurance pool participation** — excess premium pooled with reinsurer; catastrophic events (cyclones) reinsured at category level
4. **Predictive analytics API** — weather/disruption risk data sold to delivery platforms for route planning and supply/demand forecasting

### Regulatory Compliance

- Insurance business in India is regulated by IRDAI (Insurance Regulatory and Development Authority of India)
- KAVACH operates as a **parametric micro-insurance product** under the IRDAI Regulatory Sandbox framework (applicable to insure-tech innovations)
- Partner insurer model: KAVACH technology platform + licensed insurance partner (e.g., HDFC Ergo, ICICI Lombard) underwrites the actual risk
- KAVACH = technology layer; licensed insurer = risk carrier. This bypasses direct IRDAI license requirement in the hackathon/PoC phase.

---

## 14. Phase 1 Prototype Scope

The Phase 1 prototype demonstrates the following **minimal viable flows**:

### Interactive Mock Prototype (PWA — Desktop/Mobile)

1. **Worker Onboarding Flow:**
   - Step 1: Phone + Aadhaar entry (mock KYC)
   - Step 2: Platform selection (Zomato / Swiggy / Both)
   - Step 3: Zone selection on a map (Chennai zones hardcoded for demo)
   - Step 4: Weekly income entry → DIT baseline set
   - Step 5: Premium quote displayed (calculated dynamically using formula in Section 5)
   - Step 6: Coverage tier selection
   - Step 7: UPI AutoPay setup (mocked)
   - Step 8: Policy activated confirmation screen

2. **Worker Dashboard:**
   - Active policy card (coverage amount, expiry: Sunday)
   - Current week earnings protected
   - Live disruption alerts banner (mock real-time feed)
   - Claims history

3. **Simulated Disruption Trigger:**
   - Button: "Simulate Chennai Rain Event (45mm/hr)"
   - System shows 3-source validation in real-time (animated)
   - Shows DIT calculation: "Ravi's predicted loss: ₹280"
   - Fraud check: "22 other workers idle in zone — Low risk"
   - Payout approved: ₹196 → UPI (mocked)

4. **Interactive Weekly Premium Calculator:**
   - Sliders for income, zone risk, season
   - Live premium calculation output

### DIT Proof-of-Concept (Jupyter Notebook)

- Synthetic dataset: 6 months of simulated delivery earnings for 50 workers
- Trained XGBoost model demonstrating earning prediction accuracy (RMSE < ₹50 per 2-hour window)
- Feature importance visualization
- Cohort vs. personal model comparison

---


## Team

| Role | Responsibility |
|---|---|
| Product Lead | Requirement analysis, UX design, persona research |
| Backend Engineer | API Gateway, Policy Service, Claims Engine, Trigger Orchestrator |
| ML Engineer | DIT model, Fraud Model, Zone Risk Model, NLP Classifier |
| Frontend Engineer | PWA — Worker onboarding, Dashboard, Admin interface |
| DevOps | AWS infrastructure, CI/CD, monitoring |

---

## Summary: Why KAVACH Wins

| Criterion | Basic Parametric Solution | KAVACH |
|---|---|---|
| Payout accuracy | Flat amount (over/under pays everyone) | Precise per-worker predicted loss |
| Fraud resistance | Single layer (claim threshold) | 7-layer defense, community validation |
| Pricing fairness | One-size zone premium | Hyper-local + behavioral + seasonal |
| Trigger reliability | Single API source | 3-source minimum confirmation |
| Multi-platform workers | Ignores Swiggy if Zomato claim | Cross-platform net income calculation |
| New worker handling | No history = no coverage or flat estimate | Cohort model for cold start |
| Coverage granularity | Full day / half day | 30-minute interval precision |
| Worker communication | App notification | WhatsApp-first (what workers actually use) |
| Business sustainability | High fraud → unsustainable | Built-in fraud defense → viable unit economics |

---

*KAVACH is not just parametric insurance. It is the first system to give gig workers a true income mirror — one that knows exactly what they lost, pays exactly what they're owed, and does it in under 30 minutes — every time.*

---

**Repository:** [GitHub/GitLab link — to be added]
**Demo Video:** [2-minute video link — to be added]


