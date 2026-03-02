import express from "express";
import cors from "cors";
import { z } from "zod";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

/* Geocoding the user query (city/zip/landmark text) using
   Open-Meteo Geocoding API: https://geocoding-api.open-meteo.com/v1/search
*/
app.get("/api/geocode", async (req, res) => {
  try {
    const querySchema = z.object({
      q: z.string().min(1),
    });
    const { q } = querySchema.parse({ q: req.query.q });

    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", q);
    url.searchParams.set("count", "8");
    url.searchParams.set("language", "en");
    url.searchParams.set("format", "json");

    const r = await fetch(url.toString());
    if (!r.ok) 
        return res.status(502).json({ error: "Geocoding API failed" });

    const data = await r.json();
    const results = (data?.results ?? []).map((x: any) => ({
      name: x.name,
      admin1: x.admin1,
      country: x.country,
      latitude: x.latitude,
      longitude: x.longitude,
      timezone: x.timezone,
    }));

    if (results.length === 0) {
      return res.status(404).json({ error: "Location not found" });
    }

    res.json({ results });
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? "Bad request" });
  }
});

/**
 * Weather endpoint (lat/lon -> current + 5-day daily forecast)
 * Open-Meteo Forecast API: https://api.open-meteo.com/v1/forecast?... daily=...
 */
app.get("/api/weather", async (req, res) => {
  try {
    const querySchema = z.object({
      lat: z.coerce.number().min(-90).max(90),
      lon: z.coerce.number().min(-180).max(180),
    });
    const { lat, lon } = querySchema.parse({ lat: req.query.lat, lon: req.query.lon });

    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lon));

    // current
    url.searchParams.set("current", "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m");

    // daily (5-day)
    url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max");
    url.searchParams.set("forecast_days", "5");

    // auto timezone makes “days” line up with the location
    url.searchParams.set("timezone", "auto");

    const r = await fetch(url.toString());
    if (!r.ok) return res.status(502).json({ error: "Weather API failed" });

    const data = await r.json();
    res.json(data);
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? "Bad request" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});