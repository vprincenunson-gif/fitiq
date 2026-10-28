import { useState } from 'react'
import { weatherService } from '../../services'
import type { WeatherInfo } from '../../services/weather'
import { Button } from '../ui/Button'

interface WeatherCardProps {
  weather: WeatherInfo | null
  onWeather: (weather: WeatherInfo | null) => void
}

const CITY_KEY = 'fitiq.weather.city'

/**
 * "Today's conditions" — a quiet city lookup that produces plain weather
 * text for the recommendation service. This card never touches garment
 * images; only the resulting text metadata travels on.
 */
export function WeatherCard({ weather, onWeather }: WeatherCardProps) {
  const [city, setCity] = useState(() => {
    try {
      return localStorage.getItem(CITY_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lookup = async (value = city) => {
    const clean = value.trim()
    if (!clean || loading) return
    setLoading(true)
    setError(null)
    try {
      const info = await weatherService.getCurrent(clean)
      if (!info) {
        setError('Enter a city to check the conditions.')
        onWeather(null)
        return
      }
      try {
        localStorage.setItem(CITY_KEY, info.city)
      } catch {
        /* storage unavailable */
      }
      onWeather(info)
    } catch {
      setError('Could not check conditions right now.')
      onWeather(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="surface rounded-2xl p-6" aria-label="Today's conditions">
      <div className="flex items-center gap-2">
        <p className="overline">Today's conditions</p>
        {weather?.source === 'local' && (
          <span className="rounded-full border border-line px-2 py-0.5 text-[0.625rem] font-medium uppercase tracking-wider text-ink-faint">
            estimate
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void lookup()
          }}
          placeholder="City, e.g. New York"
          aria-label="City"
          className="min-w-0 flex-1 border-b border-line bg-transparent py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-beige-deep"
        />
        <Button size="sm" variant="ghost" loading={loading} onClick={() => void lookup()}>
          {weather ? 'Refresh' : 'Check'}
        </Button>
      </div>

      {weather && !error && (
        <div className="mt-4 flex items-baseline gap-3 border-t border-line pt-4">
          <span className="font-display text-3xl leading-none">{weather.temperatureC}°</span>
          <div>
            <p className="text-sm font-medium text-ink">{weather.condition}</p>
            <p className="text-xs text-ink-faint">
              {weather.city}
              {weather.humidity !== undefined ? ` · ${weather.humidity}% humidity` : ''}
            </p>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-4 border-t border-line pt-4 text-xs text-clay">{error}</p>
      )}
    </section>
  )
}
