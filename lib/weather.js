// lib/weather.js
//
// Strategy: We hit OpenWeatherMap's free /data/2.5/weather endpoint hourly.
// Each hit gives us "rain in last 1 hour" (rain.1h, mm).
// We log every reading. We compute rolling 24-hour totals from our own log
// when checking thresholds. This avoids needing the paid One Call API 3.0.

const API_KEY = process.env.OPENWEATHER_API_KEY;

export async function fetchCurrentReading({ lat, lon }) {
  if (!API_KEY) throw new Error('OPENWEATHER_API_KEY not configured in env');
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=imperial&appid=${API_KEY}`;
  const r = await fetch(url);
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`OpenWeatherMap ${r.status}: ${t.slice(0, 200)}`);
  }
  const j = await r.json();
  const rain_1h_mm = j.rain?.['1h'] || 0;
  const snow_1h_mm = j.snow?.['1h'] || 0;
  return {
    rain_1h_mm,
    snow_1h_mm,
    rain_1h_in: +(rain_1h_mm / 25.4).toFixed(3),
    snow_1h_in: +(snow_1h_mm / 25.4).toFixed(3),
    total_1h_in: +((rain_1h_mm + snow_1h_mm) / 25.4).toFixed(3),
    temp_f: j.main?.temp,
    description: j.weather?.[0]?.description,
    raw: j
  };
}

export const mmToIn = (mm) => +(mm / 25.4).toFixed(3);
