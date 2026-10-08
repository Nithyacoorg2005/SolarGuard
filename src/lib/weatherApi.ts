import type { WeatherSnapshot } from '@/types';

interface BrowserCoordinates {
  latitude: number;
  longitude: number;
}

interface OpenMeteoResponse {
  latitude?: number;
  longitude?: number;
  timezone?: string;
  current?: Record<string, number | string | null | undefined>;
  hourly?: Record<string, (number | string | null)[] | undefined>;
}

const OPEN_METEO_FORECAST_URL =
  'https://api.open-meteo.com/v1/forecast';

/**
 * Get weather information for the current inspection.
 *
 * Flow:
 *
 * Browser GPS
 *      ↓
 * Open-Meteo
 *      ↓
 * WeatherSnapshot
 *      ↓
 * inspectionApi.ts
 *      ↓
 * Supabase
 */
export async function getInspectionWeather(): Promise<WeatherSnapshot> {
  const capturedAt =
    new Date().toISOString();

  try {
    const coords =
      await getBrowserCoordinates();

    console.log(
      '[WEATHER] GPS coordinates:',
      coords
    );

    const weather =
      await fetchOpenMeteoWeather(
        coords,
        capturedAt
      );

    console.log(
      '[WEATHER] Weather received:',
      weather
    );

    return weather;

  } catch (err) {

    console.error(
      '[WEATHER] Weather lookup failed:',
      err
    );

    return {
      latitude: 0,
      longitude: 0,

      source:
        'open-meteo',

      captured_at:
        capturedAt,

      temperature_c:
        null,

      humidity_pct:
        null,

      precipitation_mm:
        null,

      rain_mm:
        null,

      showers_mm:
        null,

      wind_speed_kmh:
        null,

      wind_gusts_kmh:
        null,

      weather_code:
        null,

      cloud_cover_pct:
        null,

      forecast_24h_precipitation_mm:
        null,

      forecast_24h_precipitation_probability_max_pct:
        null,

      error:
        err instanceof Error
          ? err.message
          : 'Weather lookup failed.',
    };
  }
}


/**
 * Get GPS coordinates from the browser.
 */
function getBrowserCoordinates():
  Promise<BrowserCoordinates> {

  if (
    !('geolocation' in navigator)
  ) {

    return Promise.reject(
      new Error(
        'Browser GPS is not available on this device.'
      )
    );

  }

  return new Promise(
    (resolve, reject) => {

      navigator.geolocation.getCurrentPosition(

        (position) => {

          const coords = {
            latitude:
              position.coords.latitude,

            longitude:
              position.coords.longitude,
          };

          resolve(coords);

        },

        (error) => {

          reject(
            new Error(
              `GPS permission or location lookup failed: ${error.message}`
            )
          );

        },

        {
          enableHighAccuracy:
            true,

          timeout:
            10000,

          maximumAge:
            5 * 60 * 1000,
        }
      );

    }
  );
}


/**
 * Fetch current + forecast weather from Open-Meteo.
 */
async function fetchOpenMeteoWeather(
  coords: BrowserCoordinates,
  capturedAt: string
): Promise<WeatherSnapshot> {

  const params =
    new URLSearchParams({

      latitude:
        coords.latitude.toFixed(6),

      longitude:
        coords.longitude.toFixed(6),

      current: [
        'temperature_2m',
        'relative_humidity_2m',
        'precipitation',
        'rain',
        'showers',
        'weather_code',
        'cloud_cover',
        'wind_speed_10m',
        'wind_gusts_10m',
      ].join(','),

      hourly:
        'precipitation,precipitation_probability',

      forecast_days:
        '2',

      timezone:
        'auto',
    });


  const url =
    `${OPEN_METEO_FORECAST_URL}?${params.toString()}`;


  console.log(
    '[WEATHER] Requesting:',
    url
  );


  let response: Response;


  try {

    response =
      await fetch(url);

  } catch (err) {

    throw new Error(
      `Cannot reach Open-Meteo weather API. ${
        err instanceof Error
          ? err.message
          : 'Network error.'
      }`
    );

  }


  if (!response.ok) {

    const body =
      await response
        .text()
        .catch(() => '');

    throw new Error(
      `Open-Meteo weather lookup failed (HTTP ${response.status}). ${body}`
    );

  }


  let data:
    OpenMeteoResponse;


  try {

    data =
      (await response.json()) as OpenMeteoResponse;

  } catch {

    throw new Error(
      'Open-Meteo returned invalid JSON.'
    );

  }


  const current =
    data.current ?? {};

  const hourly =
    data.hourly ?? {};


  const next24Precipitation =
    sumFirstNumbers(
      hourly.precipitation,
      24
    );


  const next24Probability =
    maxFirstNumbers(
      hourly.precipitation_probability,
      24
    );


  const result: WeatherSnapshot = {

    latitude:
      data.latitude ??
      coords.latitude,

    longitude:
      data.longitude ??
      coords.longitude,

    source:
      'open-meteo',

    captured_at:
      capturedAt,

    temperature_c:
      readNumber(
        current.temperature_2m
      ),

    humidity_pct:
      readNumber(
        current.relative_humidity_2m
      ),

    precipitation_mm:
      readNumber(
        current.precipitation
      ),

    rain_mm:
      readNumber(
        current.rain
      ),

    showers_mm:
      readNumber(
        current.showers
      ),

    wind_speed_kmh:
      readNumber(
        current.wind_speed_10m
      ),

    wind_gusts_kmh:
      readNumber(
        current.wind_gusts_10m
      ),

    weather_code:
      readNumber(
        current.weather_code
      ),

    cloud_cover_pct:
      readNumber(
        current.cloud_cover
      ),

    forecast_24h_precipitation_mm:
      next24Precipitation,

    forecast_24h_precipitation_probability_max_pct:
      next24Probability,
  };


  return result;
}


/**
 * Safely convert a value into a number.
 */
function readNumber(
  value: unknown
): number | null {

  if (
    typeof value === 'number' &&
    Number.isFinite(value)
  ) {

    return value;

  }


  if (
    typeof value === 'string'
  ) {

    const parsed =
      Number(value);

    if (
      Number.isFinite(parsed)
    ) {

      return parsed;

    }

  }


  return null;
}


/**
 * Sum the first N numeric values.
 */
function sumFirstNumbers(
  values: unknown,
  count: number
): number | null {

  if (
    !Array.isArray(values)
  ) {

    return null;

  }


  const numbers =
    values
      .slice(0, count)
      .filter(
        (
          value
        ): value is number =>
          typeof value === 'number' &&
          Number.isFinite(value)
      );


  if (
    numbers.length === 0
  ) {

    return null;

  }


  const total =
    numbers.reduce(
      (sum, value) =>
        sum + value,
      0
    );


  return Number(
    total.toFixed(2)
  );
}


/**
 * Find the maximum value among the first N values.
 */
function maxFirstNumbers(
  values: unknown,
  count: number
): number | null {

  if (
    !Array.isArray(values)
  ) {

    return null;

  }


  const numbers =
    values
      .slice(0, count)
      .filter(
        (
          value
        ): value is number =>
          typeof value === 'number' &&
          Number.isFinite(value)
      );


  if (
    numbers.length === 0
  ) {

    return null;

  }


  return Math.max(
    ...numbers
  );
}