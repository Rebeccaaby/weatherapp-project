import express from "express";
import cors from "cors";
import { z } from "zod";
import { prisma } from "./prisma";
import { geocodeTopMatch, fetchDailyRange } from "./utils/weather";
import { toCSV, toMarkdown, toPDFBuffer } from "./utils/exportsFunctions";

const app = express();
// app.use(cors());
app.use(express.json());

const allowed = [
  "http://localhost:3000",
  "http://localhost:5173",
  process.env.FRONTEND_URL,
].filter((x): x is string => Boolean(x));

app.use(
  cors({
    origin: allowed,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

const PORT = process.env.PORT || 4000;

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "weather-backend",
    endpoints: ["/api/geocode?q=...", "/api/weather?lat=...&lon=..."],
  });
});

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
  } 
  catch (e: any) {
    res.status(400).json({ error: e?.message ?? "Bad request" });
  }
});

/* Weather endpoint (lat/lon -> current + 5-day daily forecast)
 with Open-Meteo Forecast API: https://api.open-meteo.com/v1/forecast
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

    //current
    url.searchParams.set("current", "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m");

    //daily(5-day)
    url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max");
    url.searchParams.set("forecast_days", "5");

    url.searchParams.set("timezone", "auto");

    const r = await fetch(url.toString());
    if (!r.ok) return res.status(502).json({ error: "Weather API failed" });

    const data = await r.json();
    res.json(data);
  } 
  catch (e: any) {
    res.status(400).json({ error: e?.message ?? "Bad request" });
  }
});


const createSchema = z.object({
  queryText: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  //bypass geocode and send exact coords
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

app.post("/api/requests", async (req, res) => {
  try {
    const body = createSchema.parse(req.body);

    let latitude = body.latitude;
    let longitude = body.longitude;
    let locationName = body.queryText;
    let timezone: string | undefined;

    // console.log("POST /api/requests body:", body);

    //Validate location exists if no coords provided
    if (latitude == null || longitude == null) {
      const geo = await geocodeTopMatch(body.queryText.trim());
      latitude = geo.latitude;
      longitude = geo.longitude;
      locationName = geo.locationName;
      timezone = geo.timezone;
    }

    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: "Missing coordinates after geocoding." });
    }

    const daily = await fetchDailyRange(latitude, longitude, body.startDate, body.endDate);

    const created = await prisma.weatherRequest.create({
      data: {
        queryText: body.queryText,
        locationName,
        latitude,
        longitude,
        timezone: timezone ?? null,
        startDate: body.startDate,
        endDate: body.endDate,
        dailyJson: JSON.stringify(daily),
      },
    });

    res.status(201).json({
      ...created,
      daily: JSON.parse(created.dailyJson),
    });
  } 
  catch (e: any) {
    res.status(400).json({ error: e?.message ?? "Bad request" });
  }
});

app.get("/api/requests", async (_req, res) => {
  const rows = await prisma.weatherRequest.findMany({
    orderBy: { createdAt: "desc" },
  });
  res.json(
    rows.map((r) => ({
      ...r,
      daily: JSON.parse(r.dailyJson),
    }))
  );
});

//export
app.get("/api/requests/export", async (req, res) => {
  const format = String(req.query.format || "json").toLowerCase();
  const rows = await prisma.weatherRequest.findMany({ orderBy: { createdAt: "desc" } });

  if (format === "json") {
    res.setHeader("Content-Type", "application/json");
    return res.send(JSON.stringify(rows, null, 2));
  }

  if (format === "csv") {
    const csv = toCSV(rows);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="weather_requests.csv"`);
    return res.send(csv);
  }

  if (format === "md" || format === "markdown") {
    const md = toMarkdown(rows);
    res.setHeader("Content-Type", "text/markdown");
    res.setHeader("Content-Disposition", `attachment; filename="weather_requests.md"`);
    return res.send(md);
  }

  if (format === "pdf") {
    const pdf = await toPDFBuffer(rows);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="weather_requests.pdf"`);
    return res.send(pdf);
  }

  return res.status(400).json({ error: "Unsupported format. Use json|csv|md|pdf" });
});

app.get("/api/requests/:id", async (req, res) => {
  const row = await prisma.weatherRequest.findUnique({ where: { id: req.params.id } });
  if (!row) 
    return res.status(404).json({ error: "Not found" });
  res.json({ ...row, daily: JSON.parse(row.dailyJson) });
});

const updateSchema = z.object({
  queryText: z.string().min(1).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  //user can update display name
  locationName: z.string().min(1).optional(),
});

app.put("/api/requests/:id", async (req, res) => {
  try {
    const patch = updateSchema.parse(req.body);
    const existing = await prisma.weatherRequest.findUnique({ where: { id: req.params.id } });
    if (!existing) 
        return res.status(404).json({ error: "Not found" });

    let queryText = patch.queryText ?? existing.queryText;
    let locationName = patch.locationName ?? existing.locationName;
    let startDate = patch.startDate ?? existing.startDate;
    let endDate = patch.endDate ?? existing.endDate;
    let latitude = existing.latitude;
    let longitude = existing.longitude;
    let timezone = existing.timezone ?? null;

    //re-validation
    if (patch.queryText) {
      const geo = await geocodeTopMatch(queryText.trim());
      latitude = geo.latitude;
      longitude = geo.longitude;
      locationName = geo.locationName;
      timezone = geo.timezone;
    }

    const dateChanged = startDate !== existing.startDate || endDate !== existing.endDate;
    const locChanged = !!patch.queryText;

    let dailyJson = existing.dailyJson;
    if (dateChanged || locChanged) {
      const daily = await fetchDailyRange(latitude, longitude, startDate, endDate);
      dailyJson = JSON.stringify(daily);
    }

    const updated = await prisma.weatherRequest.update({
      where: { id: req.params.id },
      data: { queryText, locationName, latitude, longitude, timezone, startDate, endDate, dailyJson },
    });

    res.json({ ...updated, daily: JSON.parse(updated.dailyJson) });
  } 
  catch (e: any) {
    res.status(400).json({ error: e?.message ?? "Bad request" });
  }
});

app.delete("/api/requests/:id", async (req, res) => {
  const existing = await prisma.weatherRequest.findUnique({ where: { id: req.params.id } });
  if (!existing) 
    return res.status(404).json({ error: "Not found" });
  await prisma.weatherRequest.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// app.get("/api/debug/geocodeTopMatch", async (req, res) => {
//   try {
//     const q = String(req.query.q || "");
//     const geo = await geocodeTopMatch(q);
//     res.json({ ok: true, geo });
//   } catch (e: any) {
//     res.status(400).json({ ok: false, error: e?.message ?? "error" });
//   }
// });

// app.get("/api/weather", async (req, res) => {
//   try {
//     const querySchema = z.object({
//       lat: z.coerce.number().min(-90).max(90),
//       lon: z.coerce.number().min(-180).max(180),
//     });
//     const { lat, lon } = querySchema.parse({ lat: req.query.lat, lon: req.query.lon });

//     const url = new URL("https://api.open-meteo.com/v1/forecast");
//     url.searchParams.set("latitude", String(lat));
//     url.searchParams.set("longitude", String(lon));

//     // current
//     url.searchParams.set(
//       "current",
//       "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m"
//     );

//     // daily forecast (5 days)
//     url.searchParams.set(
//       "daily",
//       "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max"
//     );
//     url.searchParams.set("forecast_days", "5");
//     url.searchParams.set("timezone", "auto");

//     const r = await fetch(url.toString());
//     if (!r.ok) return res.status(502).json({ error: "Weather API failed" });

//     const data = await r.json();
//     res.json(data);
//   } 
//   catch (e: any) {
//     res.status(400).json({ error: e?.message ?? "Bad request" });
//   }
// });


app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});