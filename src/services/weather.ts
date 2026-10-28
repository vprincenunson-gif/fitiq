/**
 * Weather boundary. The app only ever sends plain text metadata (city,
 * temperature, condition, humidity) onward to the recommendation service —
 * no images, no user data beyond a city query. Swap `LocalWeatherService`
 * for a hosted provider by implementing `WeatherService`.
 */
export interface WeatherInfo {
  city: string
  temperatureC: number
  condition: string
  humidity?: number
  /** 'live' = fetched from a provider; 'local' = fallback estimate. */
  source: 'live' | 'local'
}

export interface WeatherService {
  getCurrent(city: string): Promise<WeatherInfo | null>
}

/** Deterministic local fallback so weather never blocks the feature. */
function localEstimate(city: string): WeatherInfo {
  let seed = 0
  for (const ch of city.toLowerCase()) seed = (seed * 31 + ch.charCodeAt(0)) % 997
  const temp = 10 + (seed % 23) // 10–32°C
  const conditions = ['Clear', 'Partly cloudy', 'Cloudy', 'Light rain', 'Showers']
  return {
    city,
    temperatureC: temp,
    condition: conditions[seed % conditions.length],
    humidity: 40 + (seed % 45),
    source: 'local',
  }
}

export class LocalWeatherService implements WeatherService {
  async getCurrent(city: string): Promise<WeatherInfo | null> {
    const clean = city.trim()
    if (!clean) return null
    try {
      // Live lookup via Open-Meteo (free, no key): geocode the city, then
      // fetch current conditions. Falls back to the local estimate below.
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(clean)}&count=1&language=en&format=json`,
        { signal: AbortSignal.timeout(4000) },
      )
      if (!geoRes.ok) throw new Error('geocoding unavailable')
      const geo = (await geoRes.json()) as { results?: { latitude: number; longitude: number; name: string }[] }
      const hit = geo.results?.[0]
      if (!hit) throw new Error('city not found')
      const forecastRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}&current=temperature_2m,relative_humidity_2m,weather_code&temperature_unit=celsius`,
        { signal: AbortSignal.timeout(4000) },
      )
      if (!forecastRes.ok) throw new Error('forecast unavailable')
      const fc = (await forecastRes.json()) as {
        current?: { temperature_2m?: number; relative_humidity_2m?: number; weather_code?: number }
      }
      const cur = fc.current
      if (!cur || cur.temperature_2m === undefined) throw new Error('no current data')
      return {
        city: hit.name,
        temperatureC: Math.round(cur.temperature_2m),
        condition: weatherCodeToCondition(cur.weather_code ?? 0),
        humidity: Math.round(cur.relative_humidity_2m ?? 0),
        source: 'live',
      }
    } catch {
      return localEstimate(clean)
    }
  }
}

/** WMO weather codes → short editorial condition label. */
function weatherCodeToCondition(code: number): string {
  if (code === 0) return 'Clear'
  if (code === 1 || code === 2) return 'Partly cloudy'
  if (code === 3) return 'Cloudy'
  if (code >= 51 && code <= 67) return 'Rain'
  if (code >= 71 && code <= 77) return 'Snow'
  if (code >= 80 && code <= 82) return 'Showers'
  if (code >= 95) return 'Storm'
  return 'Fair'
}
