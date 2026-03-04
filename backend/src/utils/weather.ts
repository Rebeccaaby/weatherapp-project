const FORECAST_MAX_DAYS = 16;

// YYYY-MM-DD
export function toDate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function parseDate(s: string): Date {
  //use as local date
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) 
    throw new Error("Dates must be in YYYY-MM-DD format.");
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (isNaN(d.getTime())) 
    throw new Error("Invalid date.");
  return d;
}

export function daysBetween(a: Date, b: Date) {
  const ms = 24 * 60 * 60 * 1000;
  const aa = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const bb = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((bb - aa) / ms);
}

function normalizeQuery(q: string) {
  return q
    .trim()
    .replace(/,/g, " ")       // eg."Buffalo, NY" -> "Buffalo  NY"
    .replace(/\s+/g, " ");    
}

async function openMeteoGeocode(name: string) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", name);
  url.searchParams.set("count", "8");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const r = await fetch(url.toString());
  if (!r.ok) throw new Error("Geocoding API failed.");
  const data = await r.json();
  return data?.results ?? [];
}

export async function geocodeTopMatch(q: string) {
  const cleaned = normalizeQuery(q);

  // Try full cleaned query first
  let results = await openMeteoGeocode(cleaned);

  if (results.length === 0) {
    const firstPart = cleaned.split(" ").slice(0, 1).join(" ");
    results = await openMeteoGeocode(firstPart);
  }

  if (results.length === 0) throw new Error("Location not found.");

  const x = results[0];
  return {
    locationName: [x.name, x.admin1, x.country].filter(Boolean).join(", "),
    latitude: x.latitude,
    longitude: x.longitude,
    timezone: x.timezone,
  };
}
type DailyRow = {
  date: string; // YYYY-MM-DD
  tmax: number | null;
  tmin: number | null;
  precip: number | null;
  wmo: number | null;
};

function normalizeDaily(apiData: any): DailyRow[] {
  const d = apiData?.daily;
  if (!d?.time) 
    return [];
  return d.time.map((date: string, i: number) => ({
    date,
    tmax: d.temperature_2m_max?.[i] ?? null,
    tmin: d.temperature_2m_min?.[i] ?? null,
    precip: d.precipitation_sum?.[i] ?? null,
    wmo: d.weather_code?.[i] ?? null,
  }));
}

async function fetchArchiveDaily(lat: number, lon: number, start: string, end: string) {
  const url = new URL("https://archive-api.open-meteo.com/v1/archive");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("start_date", start);
  url.searchParams.set("end_date", end);
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum");
  url.searchParams.set("timezone", "auto");

  const r = await fetch(url.toString());
  if (!r.ok) 
    throw new Error("Archive weather API failed.");
  return normalizeDaily(await r.json());
}

async function fetchForecastDaily(lat: number, lon: number, start: string, end: string) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("start_date", start);
  url.searchParams.set("end_date", end);
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum");
  url.searchParams.set("timezone", "auto");

  const r = await fetch(url.toString());
  if (!r.ok) 
    throw new Error("Forecast weather API failed.");
  return normalizeDaily(await r.json());
}

export async function fetchDailyRange(lat: number, lon: number, startDate: string, endDate: string) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (end < start) 
    throw new Error("End date must be >= start date.");

  const today = new Date();
  const todayISO = toDate(today);

  //validate future window
  const endDelta = daysBetween(today, end);
  if (endDelta > FORECAST_MAX_DAYS) {
    throw new Error(`End date is too far in the future. Forecast supports up to ${FORECAST_MAX_DAYS} days ahead.`);
  }

  //whole past data
  if (endDate <= todayISO) {
    return await fetchArchiveDaily(lat, lon, startDate, endDate);
  }

  //the future data
  if (startDate > todayISO) {
    return await fetchForecastDaily(lat, lon, startDate, endDate);
  }

  //Spans past to current and future 
  const pastPart = await fetchArchiveDaily(lat, lon, startDate, todayISO);
  const futureStart = toDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
  const futurePart = await fetchForecastDaily(lat, lon, futureStart, endDate);
  return [...pastPart, ...futurePart];
}