import { useMemo, useState } from "react";
import "./App.css";

function weatherapp(code) {

  if (code === 0) return "☀️";
  if ([1, 2, 3].includes(code)) return "⛅";
  if ([45, 48].includes(code)) return "🌫️";
  if ([51, 53, 55, 56, 57].includes(code)) return "🌦️";
  if ([61, 63, 65, 66, 67].includes(code)) return "🌧️";
  if ([71, 73, 75, 77].includes(code)) return "❄️";
  if ([80, 81, 82].includes(code)) return "🌧️";
  if ([95, 96, 99].includes(code)) return "⛈️";
  return "🌤️";
}

export default function App() {
  const [q, setQ] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [weather, setWeather] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const title = useMemo(() => {
    if (!selected) return "Weather App";
    const parts = [selected.name, selected.admin1, selected.country].filter(Boolean);
    return parts.join(", ");
  }, [selected]);

  async function searchLocation() {
    setError("");
    setWeather(null);
    setSelected(null);
    setCandidates([]);

    if (!q.trim()) {
      setError("Please enter a location (city, zip, landmark, etc.).");
      return;
    }

    setLoading(true);
    try {
      const r = await fetch(`http://localhost:4000/api/geocode?q=${encodeURIComponent(q.trim())}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Failed to geocode location.");
      setCandidates(data.results);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadWeather(place) {
    setError("");
    setWeather(null);
    setSelected(place);

    setLoading(true);
    try {
      const r = await fetch(
        `http://localhost:4000/api/weather?lat=${place.latitude}&lon=${place.longitude}`
      );
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Failed to load weather.");
      setWeather(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function useMyLocation() {
    setError("");
    setWeather(null);
    setSelected(null);
    setCandidates([]);

    if (!navigator.geolocation) {
      setError("Geolocation is not supported in this browser.");
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;

          // We can call /api/weather directly; also create a “selected” object for display
          const place = { name: "Current location", latitude, longitude };
          await loadWeather(place);
        } catch (e) {
          setError(e.message);
          setLoading(false);
        }
      },
      (err) => {
        setLoading(false);
        setError(err.message || "Failed to get your location.");
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }

  const current = weather?.current;
  const daily = weather?.daily;

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1 style={{ marginBottom: 6 }}>{title}</h1>
      <p style={{ marginTop: 0, opacity: 0.75 }}>
        Enter a location or use your current location. Shows current + 5-day forecast.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g., Buffalo, NY or 14260 or Eiffel Tower"
          style={{ flex: 1, minWidth: 260, padding: 10 }}
        />
        <button onClick={searchLocation} disabled={loading} style={{ padding: "10px 14px" }}>
          Search
        </button>
        <button onClick={useMyLocation} disabled={loading} style={{ padding: "10px 14px" }}>
          Use my location
        </button>
      </div>

      {/* Error handling examples */}
      {error && (
        <div style={{ marginTop: 14, padding: 12, background: "#ffe9e9", borderRadius: 8 }}>
          <b>Oops:</b> {error}
        </div>
      )}

      {loading && <p style={{ marginTop: 14 }}>Loading…</p>}

      {/* Candidate pick list to handle ambiguous cities */}
      {!loading && candidates.length > 0 && !selected && (
        <div style={{ marginTop: 16 }}>
          <b>Select a match:</b>
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            {candidates.map((p, idx) => (
              <button
                key={idx}
                onClick={() => loadWeather(p)}
                style={{
                  textAlign: "left",
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  background: "white",
                }}
              >
                {p.name}
                {p.admin1 ? `, ${p.admin1}` : ""} — {p.country}{" "}
                <span style={{ opacity: 0.6 }}>
                  ({p.latitude.toFixed(2)}, {p.longitude.toFixed(2)})
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Current weather */}
      {current && (
        <div
          style={{
            marginTop: 18,
            padding: 16,
            border: "1px solid #ddd",
            borderRadius: 12,
            background: "white",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Current</h2>
          <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontSize: 44 }}>{weatherapp(current.weather_code)}</div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>
                {Math.round(current.temperature_2m)}° (feels{" "}
                {Math.round(current.apparent_temperature)}°)
              </div>
              <div style={{ opacity: 0.8 }}>
                Wind: {Math.round(current.wind_speed_10m)} • Precip: {current.precipitation}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5-day forecast */}
      {daily?.time?.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <h2>5-Day Forecast</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {daily.time.map((date, i) => (
              <div
                key={date}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid #eee",
                  background: "white",
                }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ fontSize: 26 }}>{weatherapp(daily.weather_code[i])}</div>
                  <div>
                    <div style={{ fontWeight: 650 }}>{date}</div>
                    <div style={{ opacity: 0.75 }}>
                      Precip: {daily.precipitation_sum[i]} • Max wind: {daily.wind_speed_10m_max[i]}
                    </div>
                  </div>
                </div>
                <div style={{ fontWeight: 700 }}>
                  {Math.round(daily.temperature_2m_max[i])}° / {Math.round(daily.temperature_2m_min[i])}°
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}