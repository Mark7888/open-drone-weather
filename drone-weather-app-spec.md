# DroneCast — Mobile App Specification
**Platform:** Android (Expo, managed workflow)  
**Version:** 1.0 — Initial Specification  
**Last updated:** 2026-03-11

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [App Architecture](#3-app-architecture)
4. [Screens & Navigation](#4-screens--navigation)
5. [Data Layer](#5-data-layer)
6. [Weather API Integration](#6-weather-api-integration)
7. [Flight Score Algorithm](#7-flight-score-algorithm)
8. [Sun & Light Calculations](#8-sun--light-calculations)
9. [Drone Profiles](#9-drone-profiles)
10. [Caching Strategy](#10-caching-strategy)
11. [Offline Mode](#11-offline-mode)
12. [UI & Design System](#12-ui--design-system)
13. [Settings](#13-settings)
14. [Saved Locations](#14-saved-locations)
15. [Screen-by-Screen Specification](#15-screen-by-screen-specification)
16. [Data Models & Types](#16-data-models--types)
17. [Out of Scope](#17-out-of-scope)

---

## 1. Overview

**DroneCast** is an Android application that helps drone pilots decide when and where it is safe and optimal to fly. It fetches weather forecasts from the Open-Meteo API, calculates a flight-quality score for every hour of every day based on the active drone's specifications, and presents this as a calendar-style heatmap where color instantly communicates flyability. Pilots can drill into any hour for a full data breakdown, understand exactly why a score was calculated the way it was, and plan their sessions around the best windows of the day and week.

### Core Goals

- Instant visual overview of flyable time across 3 weeks (21 days)
- Honest, explainable scoring — no black boxes
- Works offline if data was previously fetched
- Fully configurable per drone model and pilot preferences

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native via **Expo SDK** (managed workflow) |
| Language | TypeScript |
| Navigation | **Expo Router** (file-based routing) |
| State Management | **Zustand** (lightweight global store) |
| Persistent Storage | **expo-secure-store** for settings/profiles; **expo-file-system** for weather cache |
| Location | **expo-location** |
| Sun Calculations | **suncalc** (npm) |
| HTTP Client | Native `fetch` |
| UI Primitives | React Native core + **react-native-reanimated** for animations |
| Gesture Handling | **react-native-gesture-handler** |
| Theme | Custom design tokens with `useColorScheme` hook |
| Icons | **@expo/vector-icons** (MaterialCommunityIcons) |

---

## 3. App Architecture

```
app/
  (tabs)/
    index.tsx          ← Main calendar screen
    drones.tsx         ← Drone profiles screen
    settings.tsx       ← Settings screen
  day/[date].tsx       ← Day detail screen (modal/push)
  location-search.tsx  ← Location search & favorites (modal)

store/
  weatherStore.ts      ← Fetched weather data, loading state, last-fetch time
  settingsStore.ts     ← Units, theme override, golden hour toggle
  droneStore.ts        ← Drone profiles, active drone
  locationStore.ts     ← Saved locations, active location

lib/
  api/
    openMeteo.ts       ← API request builder & response parser
  calc/
    flightScore.ts     ← Scoring algorithm
    sunCalc.ts         ← Wrapper around suncalc
  cache/
    weatherCache.ts    ← Read/write/invalidate cache on expo-file-system
  utils/
    units.ts           ← Unit conversion helpers
    time.ts            ← Date/time helpers

constants/
  dronePresets.json    ← DJI placeholder profiles
  scoring.ts           ← Scoring weights and threshold constants
```

### State Flow

```
App opens
  → Load settings, drone profiles, saved locations from storage
  → Load cached weather for active location (if exists)
  → Render calendar immediately from cache
  → Trigger background refresh (fetch new data if stale or first load)
  → On new data: update store → calendar re-renders with fresh scores

User pulls to refresh
  → Force fetch regardless of cache age
  → Update cache and store

User switches drone
  → Recalculate scores from existing weatherStore data (no API call)
  → Calendar re-renders

User switches location
  → Check cache for that location
  → Render from cache if available
  → Trigger background refresh
```

---

## 4. Screens & Navigation

| Screen | Route | Trigger |
|---|---|---|
| Main Calendar | `/` | App launch / tab |
| Day Detail | `/day/[date]` | Tap a day rectangle |
| Location Search | `/location-search` | Tap location selector |
| Drone Profiles | `/drones` | Bottom tab |
| Settings | `/settings` | Bottom tab |
| No Data / Offline | Inline on `/` | No cache + no connection |

Navigation structure: **bottom tab bar** with 3 tabs (Calendar, Drones, Settings). Location Search and Day Detail are presented as full-screen modals pushed over the tab bar.

---

## 5. Data Layer

### Zustand Stores

#### `weatherStore`
```ts
{
  data: WeatherData | null,         // parsed API response for active location
  locationKey: string,              // identifies which location this data belongs to
  lastFetched: number | null,       // unix timestamp
  isLoading: boolean,
  error: string | null,
  fetch: (location: Location) => Promise<void>,
  forceRefresh: (location: Location) => Promise<void>,
}
```

#### `settingsStore`
```ts
{
  units: {
    temperature: 'C' | 'F',
    wind: 'kmh' | 'ms' | 'mph',
    distance: 'km' | 'mi',
  },
  themeOverride: 'system' | 'light' | 'dark',
  goldenHourEnabled: boolean,
  // persist: expo-secure-store
}
```

#### `droneStore`
```ts
{
  profiles: DroneProfile[],
  activeDroneId: string,
  // persist: expo-secure-store
}
```

#### `locationStore`
```ts
{
  saved: SavedLocation[],
  active: SavedLocation | null,
  // persist: expo-secure-store
}
```

---

## 6. Weather API Integration

### Provider

**Open-Meteo** — free, no API key required.  
Base URL: `https://api.open-meteo.com/v1/forecast`

### Request Parameters

```
latitude={lat}
longitude={lon}
hourly=temperature_2m,
       relativehumidity_2m,
       precipitation_probability,
       precipitation,
       weathercode,
       cloudcover,
       visibility,
       windspeed_10m,
       windspeed_80m,
       windspeed_120m,
       windgusts_10m,
       windgusts_80m,
       winddirection_80m
timezone=auto
forecast_days=16
wind_speed_unit=kmh
temperature_unit=celsius
```

> Unit conversion to user preference happens client-side after fetch, so raw data is always stored in metric (km/h, °C).

### Response Shape (parsed)

```ts
interface HourlyWeather {
  time: string;                    // ISO8601
  temperature: number;             // °C
  humidity: number;                // %
  precipitationProbability: number;// %
  precipitation: number;           // mm
  weatherCode: number;             // WMO code
  cloudCover: number;              // %
  visibility: number;              // metres
  windSpeed10m: number;            // km/h
  windSpeed80m: number;            // km/h
  windSpeed120m: number;           // km/h
  windGust10m: number;             // km/h
  windGust80m: number;             // km/h
  windDirection80m: number;        // degrees
}

interface WeatherData {
  location: { lat: number; lon: number; name: string };
  fetchedAt: number;               // unix ms
  hourly: HourlyWeather[];         // 16 days × 24 hours = 384 entries
}
```

### WMO Weather Code Groups (used for hard-blocker detection)

| Group | Codes | Meaning |
|---|---|---|
| Rain | 51–67, 80–82 | Drizzle, rain, rain showers |
| Snow | 71–77, 85–86 | Snow |
| Thunderstorm | 95–99 | Storm (hard blocker) |
| Fog | 45, 48 | Fog / depositing rime fog |

---

## 7. Flight Score Algorithm

### Overview

Each hourly slot is assigned a **score from 0 to 100**, where 100 = perfect conditions and 0 = do not fly. The score is composed of a **hard blocker check** followed by a **weighted soft-factor calculation**.

---

### Step 1 — Hard Blockers

If **any** of the following are true, the score is immediately set to **0** and calculation stops:

| Blocker | Condition |
|---|---|
| Rain | `precipitationProbability >= 40%` OR `weatherCode` in rain/snow/thunderstorm group |
| Wind (80m) | `windSpeed80m > drone.maxWindSpeed80m` |
| Wind gust (80m) | `windGust80m > drone.maxGustSpeed` |
| Temperature too cold | `temperature < drone.minTemperature` |
| Temperature too hot | `temperature > drone.maxTemperature` |

> Rationale: If any blocker is triggered, there is no safe flying regardless of other factors. Score = 0, color = red.

---

### Step 2 — Soft Factor Scoring

Each factor produces a **sub-score 0–100** and is multiplied by its weight. Weights sum to 1.0.

| Factor | Weight | How sub-score is calculated |
|---|---|---|
| Wind speed at 80m | **0.35** | Linear interpolation: 0 km/h → 100, `drone.maxWindSpeed80m` → 0 |
| Wind gust at 80m | **0.20** | Linear interpolation: 0 km/h → 100, `drone.maxGustSpeed` → 0 |
| Wind speed at 120m | **0.15** | Same scale as 80m wind. Score below 60 triggers a warning flag |
| Wind speed at 10m (surface) | **0.10** | Linear interpolation: 0 → 100, `drone.maxWindSpeed10m` → 0 |
| Temperature | **0.10** | Peak at drone's optimal temp range center; degrades toward min/max |
| Humidity | **0.05** | 0–60% → 100; 60–`drone.maxHumidity` → linear decay to 0 |
| Cloud cover | **0.03** | 0% → 100, 100% → 60 (clouds are not a safety issue, just quality) |
| Visibility | **0.02** | >5000m → 100; 1000–5000m → linear; <1000m → 0 |

**Final score = Σ(sub-score × weight), rounded to integer.**

#### Temperature Sub-Score Detail
```
optimalCenter = (drone.minTemperature + drone.maxTemperature) / 2
optimalRange  = (drone.maxTemperature - drone.minTemperature) * 0.4
if abs(temperature - optimalCenter) <= optimalRange → 100
else → linear decay to 0 at min/max
```

---

### Step 3 — 120m Wind Warning Flag

Regardless of overall score, if:
- `windSpeed120m > drone.maxWindSpeed80m * 0.85` (within 15% of limit)
- AND overall score > 0 (not already blocked)

→ set `warn120m: true` on that hour's result. This shows a warning icon in the detail view.

---

### Score → Color Mapping

| Score | Color | Meaning |
|---|---|---|
| 85–100 | Cyan `#00E5FF` | Excellent |
| 65–84 | Green `#4CAF50` | Good |
| 40–64 | Yellow `#FFC107` | Marginal |
| 1–39 | Red `#F44336` | Poor |
| 0 | Deep Red `#B71C1C` | Blocked (hard stop) |

For gradient rendering on the calendar strip, scores are interpolated smoothly between adjacent hours using the color scale above.

---

### Scoring Result Shape

```ts
interface HourScore {
  hour: number;           // 0–23
  score: number;          // 0–100
  blocked: boolean;
  blockerReasons: BlockerReason[];
  factorBreakdown: FactorScore[];
  warn120m: boolean;
}

interface FactorScore {
  factor: string;         // e.g. "Wind at 80m"
  rawValue: number;       // e.g. 34.2 km/h
  subScore: number;       // 0–100
  weight: number;
  contribution: number;   // subScore × weight
}

interface BlockerReason {
  factor: string;
  rawValue: number;
  threshold: number;
  unit: string;
}
```

---

### "Best Window" Calculation

- Only consider hours between `sunrise` and `sunset` for that day
- Find the longest contiguous run of hours with `score >= 65` (Good or Excellent)
- If no such window exists, find the highest single-hour score between sunrise and sunset
- "Best Day" across the week: day with the highest **average score** across its sunrise→sunset hours

---

## 8. Sun & Light Calculations

Library: **suncalc** (`npm install suncalc`)

### Computed per day per location

```ts
SunCalc.getTimes(date, lat, lon) → {
  dawn,           // civil twilight start
  sunrise,
  goldenHourEnd,  // end of morning golden hour
  goldenHour,     // start of evening golden hour (confusingly named)
  sunset,
  dusk            // civil twilight end
}
```

### Usage on calendar strip

| Region | Visual treatment |
|---|---|
| Before `dawn` | 40% dark overlay on gradient |
| `dawn` → `sunrise` | 20% overlay (transition) |
| `sunrise` → `sunset` | No overlay (full score color visible) |
| `sunset` → `dusk` | 20% overlay |
| After `dusk` | 40% dark overlay |

### Golden Hour Markers (when enabled in settings)

- Thin horizontal lines at `goldenHourEnd` (morning) and `goldenHour` (evening) on the day detail view
- Small sun icon label beside each line
- On the calendar strip: subtle golden tick mark

### Sunrise/Sunset Markers

- Visible on both calendar strip (small icon) and day detail view (labeled line)
- Always shown regardless of golden hour setting

---

## 9. Drone Profiles

### Schema

```ts
interface DroneProfile {
  id: string;
  name: string;                  // e.g. "DJI Mini 4 Pro"
  isPreset: boolean;
  maxWindSpeed10m: number;       // km/h — surface, takeoff/landing
  maxWindSpeed80m: number;       // km/h — primary flight altitude
  maxWindSpeed120m: number;      // km/h — ceiling altitude
  maxGustSpeed: number;          // km/h — gusts at 80m
  minTemperature: number;        // °C
  maxTemperature: number;        // °C
  maxHumidity: number;           // % RH
  optimalTempMin: number;        // °C — for sub-score calculation
  optimalTempMax: number;        // °C
}
```

### dronePresets.json (placeholder structure)

```json
[
  {
    "id": "dji-mini-4-pro",
    "name": "DJI Mini 4 Pro",
    "isPreset": true,
    "maxWindSpeed10m": 30,
    "maxWindSpeed80m": 38,
    "maxWindSpeed120m": 38,
    "maxGustSpeed": 42,
    "minTemperature": -10,
    "maxTemperature": 40,
    "maxHumidity": 85,
    "optimalTempMin": 5,
    "optimalTempMax": 30
  },
  {
    "id": "dji-mavic-3",
    "name": "DJI Mavic 3",
    "isPreset": true,
    "maxWindSpeed10m": 33,
    "maxWindSpeed80m": 43,
    "maxWindSpeed120m": 43,
    "maxGustSpeed": 47,
    "minTemperature": -10,
    "maxTemperature": 40,
    "maxHumidity": 85,
    "optimalTempMin": 5,
    "optimalTempMax": 30
  },
  {
    "id": "dji-air-3",
    "name": "DJI Air 3",
    "isPreset": true,
    "maxWindSpeed10m": 30,
    "maxWindSpeed80m": 38,
    "maxWindSpeed120m": 38,
    "maxGustSpeed": 42,
    "minTemperature": -10,
    "maxTemperature": 40,
    "maxHumidity": 85,
    "optimalTempMin": 5,
    "optimalTempMax": 30
  },
  {
    "id": "dji-mini-3-pro",
    "name": "DJI Mini 3 Pro",
    "isPreset": true,
    "maxWindSpeed10m": 28,
    "maxWindSpeed80m": 38,
    "maxWindSpeed120m": 38,
    "maxGustSpeed": 40,
    "minTemperature": -10,
    "maxTemperature": 40,
    "maxHumidity": 80,
    "optimalTempMin": 5,
    "optimalTempMax": 30
  },
  {
    "id": "dji-fpv",
    "name": "DJI FPV",
    "isPreset": true,
    "maxWindSpeed10m": 28,
    "maxWindSpeed80m": 36,
    "maxWindSpeed120m": 36,
    "maxGustSpeed": 40,
    "minTemperature": -10,
    "maxTemperature": 40,
    "maxHumidity": 80,
    "optimalTempMin": 5,
    "optimalTempMax": 30
  },
  {
    "id": "custom",
    "name": "Custom Drone",
    "isPreset": false,
    "maxWindSpeed10m": 30,
    "maxWindSpeed80m": 38,
    "maxWindSpeed120m": 38,
    "maxGustSpeed": 42,
    "minTemperature": -10,
    "maxTemperature": 40,
    "maxHumidity": 85,
    "optimalTempMin": 5,
    "optimalTempMax": 30
  }
]
```

> **Note:** All values above are placeholders. Real specs must be filled in from official DJI documentation before release.

### Custom Profile Rules

- User can create unlimited custom profiles
- Custom profiles have all the same fields as presets
- Preset profiles cannot be edited or deleted, only duplicated into a custom profile
- Custom profiles can be renamed, edited, duplicated, deleted

---

## 10. Caching Strategy

### Storage Location

Weather cache is stored using **expo-file-system** in the app's **cache directory** (`FileSystem.cacheDirectory`). This means:
- It is **separate** from app settings and user data (stored in `documentDirectory` via expo-secure-store)
- It **can be cleared** by the user in Settings without affecting drone profiles, saved locations, or preferences
- Android can also clear it under storage pressure independently

### Cache File Structure

```
cache/
  weather_{locationKey}_{YYYY-MM-DD}.json
```

`locationKey` = `${lat.toFixed(4)}_${lon.toFixed(4)}` (enough precision, filesystem-safe)  
The date in the filename is the **date the data was fetched** (today's date).

### Cache Invalidation Logic

```
On app open:
  1. Load cache file for active location
  2. If file exists → render immediately
  3. If file is from today → still refresh in background silently
  4. Always attempt a background fetch on open (unless offline)
  5. On fetch success → overwrite cache, update store

On pull-to-refresh:
  1. Force fetch regardless
  2. Overwrite cache on success

On location switch:
  1. Load cache for new location if it exists → render immediately
  2. Trigger background fetch

Never auto-fetch on navigation between screens or on tab switches.
```

### Clear Cache (from Settings)

Deletes all files matching `weather_*.json` from the cache directory. Does **not** touch expo-secure-store data.

---

## 11. Offline Mode

### Scenario A — Cache exists, no connection

- App renders normally from cached data
- A subtle banner at the top: `"Offline — showing data from [date/time]"`
- Pull-to-refresh shows an error toast: `"No connection. Could not refresh."`

### Scenario B — No cache, no connection

- Full-screen "No Data" screen shown instead of calendar
- Icon: cloud with X or similar
- Message: `"No weather data available. Connect to the internet to load forecast."`
- Button: `"Retry"` — attempts fetch, shows loading state, transitions to calendar on success

### Scenario C — Fetch fails (online but API error)

- If cache exists → stay on cached data, show error toast
- If no cache → show No Data screen with `"Could not load forecast. Tap to retry."` button

---

## 12. UI & Design System

### Theme

Supports **light** and **dark** mode. Default follows system (`useColorScheme`). Can be overridden in Settings.

#### Color Tokens

| Token | Light | Dark |
|---|---|---|
| `background` | `#F5F5F5` | `#121212` |
| `surface` | `#FFFFFF` | `#1E1E1E` |
| `surfaceElevated` | `#FAFAFA` | `#2C2C2C` |
| `textPrimary` | `#1A1A1A` | `#F0F0F0` |
| `textSecondary` | `#666666` | `#AAAAAA` |
| `border` | `#E0E0E0` | `#333333` |
| `today` border | `#2196F3` | `#64B5F6` |
| `pastOverlay` | `rgba(0,0,0,0.35)` | `rgba(0,0,0,0.50)` |
| `noDataFill` | `#E0E0E0` | `#2A2A2A` |

#### Score Colors (same in both themes)

| Score | Color |
|---|---|
| Excellent (85–100) | `#00E5FF` (cyan) |
| Good (65–84) | `#4CAF50` (green) |
| Marginal (40–64) | `#FFC107` (amber) |
| Poor (1–39) | `#F44336` (red) |
| Blocked (0) | `#B71C1C` (deep red) |

### Typography

- Font: System default (Roboto on Android)
- Day column header weekday: 11px, semibold, secondary color
- Day number badge: 10px, regular, top-right corner of rectangle
- Selector labels: 14px
- Detail screen data values: 18px bold
- Detail screen labels: 12px secondary

### Spacing & Layout

- Bottom tab bar height: 56dp
- Top header (location + drone selectors): 100dp
- Calendar grid: fills remaining screen height
- Day rectangle: `(screenWidth - padding) / 7` wide, fills available height for all 3 weeks
- Padding between rectangles: 2dp horizontal, 3dp vertical
- Week row label (Mon–Sun) height: 20dp

---

## 13. Settings

### Settings Screen Sections

#### Display
| Setting | Type | Default | Options |
|---|---|---|---|
| Theme | Selector | System | System / Light / Dark |
| Show Golden Hour | Toggle | On | On / Off |

#### Units
| Setting | Type | Default | Options |
|---|---|---|---|
| Temperature | Selector | Celsius | °C / °F |
| Wind Speed | Selector | km/h | km/h / m/s / mph |
| Distance / Visibility | Selector | km | km / mi |

#### Data & Cache
| Setting | Type | Notes |
|---|---|---|
| Clear weather cache | Button | Clears `weather_*.json` from cache dir; confirms with dialog |
| Cache info | Info row | Shows "Last updated: [datetime]" or "No cache" |

#### About
- App version
- Open-Meteo attribution link

---

## 14. Saved Locations

### SavedLocation Shape

```ts
interface SavedLocation {
  id: string;
  customName: string | null;    // if null, show placeName in primary style
  placeName: string;            // from geocoding result, e.g. "Budapest"
  countryCode: string;          // e.g. "HU"
  lat: number;
  lon: number;
  isGPS: boolean;               // true = "My Location" (GPS-based)
}
```

### Location Display Rules

- If `customName` is set: show `customName` in primary text, `placeName` in smaller secondary text below
- If `customName` is null: show `placeName` in primary text only, no secondary line

### GPS Location

- A special non-deletable entry at the top of the list: **"My Location"**
- Uses `expo-location` to get current coordinates on demand
- Reverse geocoding via Open-Meteo's geocoding API or device geocoder to get a human-readable name
- Coordinates refresh each time "My Location" is selected (not stored permanently)

### Location Search

- Uses **Open-Meteo Geocoding API**: `https://geocoding-api.open-meteo.com/v1/search?name={query}&count=10`
- Results show: place name, country, coordinates
- Tapping a result asks: "Save this location?" with optional custom name input
- Can also add without saving (sets as active but doesn't persist)

### Favorites Management (within Location Search screen)

- Swipe left on a saved location → Delete
- Tap on a saved location → set as active
- Long-press on a saved location → Edit custom name

---

## 15. Screen-by-Screen Specification

---

### 15.1 Main Calendar Screen

#### Header (top of screen)

**Row 1 — Location Selector**
- Tappable row showing active location name (+ secondary name if custom)
- Location pin icon on left
- Chevron icon on right
- Tapping opens Location Search screen

**Row 2 — Drone Selector**
- Dropdown/picker showing active drone name
- Drone icon on left
- Tapping opens inline dropdown of all profiles
- Switching recalculates scores from cache, no API call

#### Calendar Grid

**Structure:**
- 3 rows of 7 columns = 21 day rectangles
- Row 1: Monday–Sunday of current week
- Row 2: Monday–Sunday of next week
- Row 3: Monday–Sunday of the week after
- First visible Monday is the Monday of the current week (or today if today is Monday)

**Column Headers (above grid):**
- One header per column: `Mon`, `Tue`, `Wed`, `Thu`, `Fri`, `Sat`, `Sun`
- 11px semibold, secondary color

**Day Rectangle:**
- Top-right corner: day number of month (e.g., "14")
- Fill: vertical gradient from top (00:00) to bottom (23:59) based on hourly scores
  - Gradient is interpolated continuously from score colors across all 24 hours
  - Night overlays (pre-dawn / post-dusk) applied as semi-transparent dark layer on top
- **Today:** blue border (2dp) around the rectangle
- **Past days:** entire rectangle overlaid with `pastOverlay` color, no gradient behind it (show flat muted color)
- **Days with no forecast data** (beyond day 16): flat `noDataFill` color, no interaction
- **Sunrise/Sunset:** tiny sun-rise and sun-set icons overlaid at the correct vertical position

**Interaction:**
- Tap on any non-past day with data → navigate to Day Detail screen for that date
- Past days and no-data days are non-interactive

**Best Day Banner:**
- Below the grid, a single line: `"Best day to fly: Wednesday, March 18"` with a small star or sun icon
- If no day has score ≥ 65 during daylight: `"No ideal day found this forecast period"`

**Refresh Indicator:**
- Pull-to-refresh gesture on the grid triggers a forced fetch
- Subtle loading spinner in the header area during fetch
- Offline banner shown below header if applicable

---

### 15.2 Day Detail Screen

Full-screen view for a single day.

#### Header
- Back button (←)
- Date title: e.g., `"Wednesday, 18 March"`
- Best window label: e.g., `"Best window: 11:00 – 14:00"` in a colored chip (green/cyan)

#### Main Area — Vertical Timeline

A tall scrollable vertical strip representing 00:00 → 23:59 (the full day).

**Background:**
- Same gradient as the calendar rectangle but rendered at full width and full vertical height
- Night overlays applied at correct positions
- Dawn, sunrise, golden hour (if enabled), golden hour end, sunset, dusk marked with labeled horizontal lines
  - Sunrise/Sunset: white/yellow line with sun icon + time label
  - Golden hour boundaries (if enabled): gold-tinted line with small camera/sun icon + time label
  - Dawn/Dusk: subtle gray dashed line + time label

**Draggable Pointer:**
- A horizontal line across the full width of the strip
- Dragging is fluid/continuous (not snapping to hours) using react-native-gesture-handler + reanimated
- Shows current time position as a time label on the left (e.g., `"14:32"`)
- Default position on open: current time (if today), else 12:00

**Data Panel (below or beside the strip):**
Updates live as pointer is dragged. Shows interpolated values for the pointer's exact time.

Layout (card below the strip, or sticky bottom sheet):

```
┌──────────────────────────────────────────────┐
│  Overall Score: 78 / 100        [GOOD ●]     │
│──────────────────────────────────────────────│
│  Wind at 80m        22 km/h     ████░░  82   │
│  Gusts at 80m       28 km/h     ███░░░  71   │
│  Wind at 120m       31 km/h     ███░░░  68  ⚠│  ← warning icon if warn120m
│  Wind at surface    14 km/h     █████░  90   │
│  Temperature        18 °C       █████░  95   │
│  Humidity           62 %        ████░░  78   │
│  Cloud Cover        40 %        ████░░  80   │
│  Visibility         8,200 m     ██████  100  │
│──────────────────────────────────────────────│
│  ⛔ No blockers active                       │
└──────────────────────────────────────────────│
```

If blockers are active:
```
│  ⛔ BLOCKED: Rain probability 65% (≥ 40%)   │
│  ⛔ BLOCKED: Wind gust 54 km/h > 42 km/h    │
```

If warn120m:
- Small `⚠` icon after the 120m wind row
- Tapping the `⚠` shows a tooltip: `"Conditions at 120m are near the limit for this drone. Avoid flying at maximum altitude."`

**Score Calculation Explanation:**
At the bottom of the data panel, a collapsed section `"How was this calculated?"` expands to show:
- Each factor, its raw value, its sub-score, its weight, and its contribution to the final score
- Displayed as a simple table or list

---

### 15.3 Location Search Screen

Modal screen, full-screen.

#### Layout
- Search bar at top (autofocused)
- Below search bar: `"My Location (GPS)"` row always first
- Search results appear as user types (debounced 400ms)
- Below results (or when search is empty): `"Saved Locations"` section showing favorites

#### Each Result Row
- Primary: place name + country
- Secondary: latitude/longitude (small, muted)
- Tapping a result: sets it as active location and closes modal
- Long-press or swipe: option to save with custom name

#### Saved Location Row
- Primary: customName (or placeName if no custom name)
- Secondary (if customName set): placeName
- Checkmark if currently active
- Swipe left: delete button
- Long-press: edit name dialog

---

### 15.4 Drone Profiles Screen

Tab screen.

#### Layout
- List of all profiles (presets first, then custom)
- Active profile has a checkmark or highlight
- Preset rows: name + "Preset" badge, tap to select, no edit/delete
- Custom rows: name, tap to select, edit icon, delete icon (with confirmation)

**Add New Profile button** (FAB or header button):
- Opens a form screen / bottom sheet
- Fields: Name, Max Wind 10m, Max Wind 80m, Max Wind 120m, Max Gust 80m, Min Temp, Max Temp, Max Humidity, Optimal Temp Min, Optimal Temp Max
- All numeric fields with units shown inline
- Save / Cancel

**Duplicate Preset:**
- Long-press on a preset → `"Duplicate as Custom"` option
- Creates a copy as a custom profile with "(Custom)" appended to name

---

### 15.5 Settings Screen

Tab screen. Standard grouped list layout.

Sections as described in [Section 13](#13-settings).

---

### 15.6 No Data / Offline Screen

Shown in place of the calendar grid when no cache and no connection.

- Centered illustration (cloud/wifi icon)
- Title: `"No forecast data"`
- Body: `"Connect to the internet to load the weather forecast for your location."`
- Button: `"Retry"` — triggers fetch, shows spinner, transitions on success

---

## 16. Data Models & Types

```ts
// Drone
interface DroneProfile { ... }           // See Section 9

// Weather
interface HourlyWeather { ... }          // See Section 6
interface WeatherData { ... }            // See Section 6

// Scoring
interface HourScore { ... }              // See Section 7
interface FactorScore { ... }            // See Section 7
interface BlockerReason { ... }          // See Section 7

// Locations
interface SavedLocation { ... }          // See Section 14

// Computed per-day summary
interface DaySummary {
  date: string;                          // YYYY-MM-DD
  hourScores: HourScore[];
  bestWindowStart: number | null;        // hour 0–23
  bestWindowEnd: number | null;
  bestWindowScore: number | null;
  sunrise: Date;
  sunset: Date;
  dawn: Date;
  dusk: Date;
  goldenHourMorningEnd: Date;
  goldenHourEveningStart: Date;
}
```

---

## 17. Out of Scope (v1.0)

The following are explicitly **not** included in this version:

- iOS support
- Background refresh / push notifications
- Flight logging or session history
- Map view of flying locations
- Airspace or regulatory data (no-fly zones)
- Wind direction visualization (rose/compass)
- Multi-location simultaneous comparison view
- Cloud sync of settings or profiles
- Widgets or home screen shortcuts
- Precipitation radar integration
- Social/sharing features

---

*End of Specification — DroneCast v1.0*
