# OpenDroneWeather

A weather planning app for drone pilots. OpenDroneWeather fetches a 16-day hourly forecast for any location and scores every hour against your drone's flight limits — so you can see at a glance when it's safe to fly.

<p align="center">
  <img src="docs/screenshot-light-1.png" alt="OpenDroneWeather light mode" width="300" />
  &nbsp;&nbsp;&nbsp;&nbsp;
  <img src="docs/screenshot-light-2.png" alt="OpenDroneWeather light mode" width="300" />
  &nbsp;&nbsp;&nbsp;&nbsp;
  <img src="docs/screenshot-dark-1.png" alt="OpenDroneWeather dark mode" width="300" />
  &nbsp;&nbsp;&nbsp;&nbsp;
  <img src="docs/screenshot-dark-2.png" alt="OpenDroneWeather dark mode" width="300" />
</p>

---

## Features

- **Flight score calendar** — a 3-week grid where each day shows colour-coded hourly scores in a single column, giving an instant overview of the week ahead
- **Hour-by-hour detail** — tap any day to scrub through a full time strip showing wind at 3 altitudes, gusts, temperature, humidity, cloud cover, visibility, and a score breakdown
- **Drone profiles** — built-in presets for popular DJI models, plus full support for creating and editing custom profiles with your drone's exact operating limits
- **Smart scoring** — hard blockers (rain, excess wind, temperature extremes) immediately zero out a score; remaining hours are ranked by a weighted multi-factor model
- **Sun & golden hour** — sunrise, sunset, dawn, dusk, and golden-hour windows are overlaid on the day detail view
- **Night flying toggle** — optionally restrict scores to daylight hours only
- **Flexible units** — wind in km/h, m/s, or mph; temperature in °C or °F; distance in km or mi
- **Offline support** — forecasts are cached locally so previously loaded data is available without a network connection

## Tech Stack

| | |
|---|---|
| Framework | [Expo](https://expo.dev) (React Native) with Expo Router |
| State | [Zustand](https://github.com/pmndrs/zustand) |
| Weather data | [Open-Meteo](https://open-meteo.com) — free, no API key required |
| Geocoding | [Nominatim / OpenStreetMap](https://nominatim.org) |
| Sun calculations | [suncalc](https://github.com/mourner/suncalc) |
| Animations | react-native-reanimated + react-native-gesture-handler |
| Storage | expo-secure-store / expo-file-system |

## Score Bands

| Score | Label | Colour |
|---|---|---|
| ≥ 85 | Excellent | Cyan |
| ≥ 65 | Good | Green |
| ≥ 40 | Marginal | Amber |
| ≥ 1 | Poor | Red |
| 0 | Blocked | Dark red |

A score of **0 (Blocked)** means at least one hard limit has been exceeded — rain, wind, or temperature is outside the drone's safe operating range.

## Getting Started

```bash
npm install
npx expo start
```

Scan the QR code with the Expo Go app, or press `a` / `i` to open in an Android or iOS simulator.

## Data Attribution

Weather data provided by [Open-Meteo](https://open-meteo.com) under the [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) licence.
Geocoding by [Nominatim / OpenStreetMap](https://nominatim.org) contributors.
