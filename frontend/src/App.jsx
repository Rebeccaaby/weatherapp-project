import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import MapPreview from "./MapView";

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function daysFromToday(isoDate) {
  if (!isoDate) return null;
  const [y, m, d] = isoDate.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  const ms = 24 * 60 * 60 * 1000;
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const t1 = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  return Math.round((t1 - t0) / ms);
}

function iconForW(code) {
  if (code === 0) return "☀️";
  if ([1, 2].includes(code)) return "🌤️";
  if (code === 3) return "☁️";
  if ([45, 48].includes(code)) return "🌫️";
  if ([51, 53, 55, 56, 57].includes(code)) return "🌦️";
  if ([61, 63, 65, 66, 67].includes(code)) return "🌧️";
  if ([71, 73, 75, 77].includes(code)) return "🌨️";
  if ([80, 81, 82].includes(code)) return "🌧️";
  if ([95, 96, 99].includes(code)) return "⛈️";
  return "🌡️";
}

export default function App() {

  const [queryText, setQueryText] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(todayISO());

  const endDelta = daysFromToday(endDate);
  const endTooFar = endDelta != null && endDelta > 16;

  const [requests, setRequests] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  //edit state
  const [editingId, setEditingId] = useState(null);
  const [editQueryText, setEditQueryText] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

  const editEndDelta = daysFromToday(editEnd);
  const editEndTooFar = editEndDelta != null && editEndDelta > 16;

  const [wx, setWx] = useState(null);
  const [wxLoading, setWxLoading] = useState(false);
  const [wxError, setWxError] = useState("");
  const [wxLocation, setWxLocation] = useState("");
  const [wxCoords, setWxCoords] = useState(null);
  

  async function refresh() {
    setError("");
    setLoading(true);
    try {
      const rows = await api.listRequests();
      setRequests(rows);
      if (rows.length && !selectedId) setSelectedId(rows[0].id);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const selected = useMemo(
    () => requests.find((r) => r.id === selectedId) || null,
    [requests, selectedId]
  );

  async function onCreate(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const created = await api.createRequest({ queryText, startDate, endDate });
      setNotice("Saved request.");
      await refresh();
      // switch to new created record
      if (created?.id) 
        setSelectedId(created.id);
    } 
    catch (e2) {
      setError(e2.message);
    } 
    finally {
      setLoading(false);
    }
  }

  function beginEdit(r) {
    setEditingId(r.id);
    setEditQueryText(r.queryText);
    setEditStart(r.startDate);
    setEditEnd(r.endDate);
  }

  async function saveEdit(id) {
    setError("");
    setNotice("");
    setLoading(true);
    try {
      await api.updateRequest(id, {
        queryText: editQueryText,
        startDate: editStart,
        endDate: editEnd,
      });
      setEditingId(null);
      setNotice("Updated.");
      await refresh();
      setSelectedId(id);
    } 
    catch (e) {
      setError(e.message);
    } 
    finally {
      setLoading(false);
    }
  }

  async function remove(id) {
    if (!confirm("Delete this record?")) return;
    setError("");
    setNotice("");
    setLoading(true);
    try {
      await api.deleteRequest(id);
      setNotice("Deleted.");
      //deleted the selected record, reset selection
      if (selectedId === id) setSelectedId(null);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchWeather(lat, lon) {
    setWxError("");
    setWxLoading(true);
    try {
      const data = await api.weatherByLatLon(lat, lon);
      setWx(data);
    } catch (e) {
      setWxError(e.message);
      setWx(null);
    } finally {
      setWxLoading(false);
    }
  }

  async function useMyLocation() {
    setWxError("");

    if (!navigator.geolocation) {
      setWxError("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;

        setWxLocation("Your Location");

        await fetchWeather(latitude, longitude);
      },
      () => {
        setWxError("Could not get your location. Please allow location access.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function getWeatherForQuery() {
    setWxError("");
    setWxLoading(true);

    try {
      const geo = await api.geocode(queryText);
      const top = geo.results?.[0];

      if (!top) throw new Error("Location not found.");

      const name = `${top.name}, ${top.country}`;
      setWxLocation(name);

      await fetchWeather(top.latitude, top.longitude);
    } catch (e) {
      setWxError(e.message);
      setWx(null);
      setWxLocation("");
    } finally {
      setWxLoading(false);
    }
  }

  useEffect(() => {
    if (!selected) return;

    setWxLocation(selected.locationName);
    setWxCoords({ lat: selected.latitude, lon: selected.longitude });

    fetchWeather(selected.latitude, selected.longitude);
  }, [selectedId]); // or [selected]


  return (
  <div
    style={{
      minHeight: "100vh",
      width: "100%",
      display: "flex",
      justifyContent: "center",
      alignItems: "flex-start",
      padding: "24px",
      boxSizing: "border-box",
      background: "linear-gradient(135deg, #0d4ba8 10%, #d9e7ff 80%)",
      fontFamily: "system-ui",
    }}
  >
    <div
      style={{
        width: "100%",
        maxWidth: 980,
        background: "rgba(255,255,255,0.9)",
        borderRadius: 16,
        padding: 28,
        boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
        textAlign: "center",
      }}
    >
      
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 42 }}>Weather Information App</h1>
        <p style={{ marginTop: 8, opacity: 0.75 }}>
          Stores location, date range, gets daily temperatures.
        </p>
      </div>

      {error && (
        <div style={{ marginBottom: 12, padding: 10, background: "#ffdddd", borderRadius: 8 }}>
          <b>Error:</b> {error}
        </div>
      )}
      {notice && (
        <div style={{ marginBottom: 12, padding: 10, background: "#e6ffe6", borderRadius: 8 }}>
          {notice}
        </div>
      )}

      {/* Create */}
      <div
        style={{
          width: "100%",
          maxWidth: 640,
          margin: "0 auto 20px",
          padding: 18,
          background: "white",
          borderRadius: 14,
          border: "1px solid rgba(0,0,0,0.08)",
        }}
      >
        <form
          onSubmit={onCreate}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            width: "100%",
          }}
        >
          <div style={{ display: "grid", gap: 5 }}>
            <label style={{ fontWeight: 600 }}>Location</label>
            <input
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="e.g. Buffalo, NY or Buffalo"
              style={{ padding: 10, width: 260 }}
            />
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Note: City, State/ City is fine (Geocoding normalization done).
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <label>Start date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label>End date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>

            <button disabled={loading || endTooFar} style={{ padding: "6px 8px", alignSelf: "end" }}>
              {loading ? "Saving..." : "Save request"}
            </button>
          </div>

          {endTooFar && (
            <div style={{ padding: 8, background: "#fff3cd", borderRadius: 6 }}>
              End date must be within the next 16 days (forecast limit).
            </div>
          )}
        </form>

        <div style={{ marginTop: 12, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href={api.exportUrl("json")} target="_blank">Export JSON</a>
          <a href={api.exportUrl("csv")} target="_blank">Export CSV</a>
          <a href={api.exportUrl("md")} target="_blank">Export Markdown</a>
          <a href={api.exportUrl("pdf")} target="_blank">Export PDF</a>
        </div>
      </div>

      {/* weather panerl */}
      <div style={{ width: "100%", maxWidth: 860, margin: "0 auto 18px" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
          <button type="button" onClick={useMyLocation} disabled={wxLoading}>
            Use my location
          </button>
          <button type="button" onClick={getWeatherForQuery} disabled={wxLoading || !queryText.trim()}>
            Get weather for location
          </button>
        </div>

        {wxError && (
          <div style={{ marginTop: 10, padding: 10, background: "#ffdddd", borderRadius: 8 }}>
            <b>Error:</b> {wxError}
          </div>
        )}

        {wxLoading && <p style={{ marginTop: 10 }}>Loading weather…</p>}

        {wx && (
          <div style={{ marginTop: 12, padding: 16, background: "white", borderRadius: 12, textAlign: "left" }}>
            <h2 style={{ marginTop: 0 }}>
              Current Weather
              {wxLocation && (
                <span style={{ fontWeight: 700, fontSize: 20, marginLeft: 8 }}>
                  — {wxLocation}
                </span>
              )}
            </h2>
            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ fontSize: 42 }}>{iconForW(wx.current?.weather_code)}</div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>
                  {wx.current?.temperature_2m}°C (feels {wx.current?.apparent_temperature}°C)
                </div>
                <div style={{ opacity: 0.75 }}>
                  Wind: {wx.current?.wind_speed_10m} • Precip: {wx.current?.precipitation}
                </div>
              </div>
            </div>

            <h3 style={{ marginTop: 14 }}>5-Day Forecast</h3>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {wx.daily?.time?.map((day, i) => (
                <div
                  key={day}
                  style={{
                    width: 150,
                    padding: 10,
                    border: "1px solid #eee",
                    borderRadius: 10,
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{day}</div>
                  <div style={{ fontSize: 28 }}>{iconForW(wx.daily.weather_code?.[i])}</div>
                  <div>
                    {wx.daily.temperature_2m_max?.[i]}° / {wx.daily.temperature_2m_min?.[i]}°
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    Precip: {wx.daily.precipitation_sum?.[i]}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Saved locations and the Map*/}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        {/* Saved locations */}
        <div
          style={{
            width: 420,
            padding: 14,
            border: "1px solid #eee",
            borderRadius: 12,
            background: "white",
            textAlign: "left",
            maxHeight: 520, 
            overflowY: "auto" 
          }}
        >
          <h2>Saved Locations</h2>

          {requests.map((r) => (
            <div
              key={r.id}
              style={{
                padding: 10,
                borderRadius: 10,
                border: r.id === selectedId ? "2px solid #111" : "1px solid #ddd",
                marginBottom: 10,
                cursor: "pointer",
              }}
              onClick={() => setSelectedId(r.id)}
            >
              {editingId === r.id ? (
                <div style={{ display: "grid", gap: 8 }}>
                  <input
                    value={editQueryText}
                    onChange={(e) => setEditQueryText(e.target.value)}
                    style={{ padding: 8, borderRadius: 6, border: "1px solid #ccc" }}
                  />

                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="date"
                      value={editStart}
                      onChange={(e) => setEditStart(e.target.value)}
                    />
                    <input
                      type="date"
                      value={editEnd}
                      onChange={(e) => setEditEnd(e.target.value)}
                    />
                  </div>

                  {editEndTooFar && (
                    <div style={{ padding: 8, background: "#fff3cd", borderRadius: 6 }}>
                      End date must be within 16 days from today.
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="button"
                      disabled={loading || editEndTooFar}
                      onClick={() => saveEdit(r.id)}
                    >
                      Save
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontWeight: 700 }}>{r.locationName}</div>

                  <div style={{ fontSize: 13, opacity: 0.7 }}>
                    {r.startDate} → {r.endDate}
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      display: "flex",
                      gap: 5
                    }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        beginEdit(r);
                      }}
                    >
                      Edit
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(r.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Forecast and map */}
        <div
          style={{
            width: 420,
            padding: 14,
            border: "1px solid #eee",
            borderRadius: 12,
            background: "white",
            textAlign: "left",
            maxHeight: 520, 
            overflowY: "auto" 
          }}
        >
          <h2>Map</h2>

          {!selected ? (
            <p>Select a saved request.</p>
          ) : (
            <>
              <div style={{ fontWeight: 700 }}>{selected.locationName}</div>
              <div style={{ marginBottom: 12 }}>
                {selected.startDate} → {selected.endDate}
              </div>

              <MapPreview
                lat={selected.latitude}
                lon={selected.longitude}
                label={selected.locationName}
              />

              <h3 style={{ marginTop: 14 }}>Daily Temperatures</h3>

              {(selected.daily || []).map((d) => (
                <div
                  key={d.date}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: 8,
                    border: "1px solid #eee",
                    borderRadius: 6,
                    marginBottom: 6,
                  }}
                >
                  <span>{d.date}</span>
                  <span>
                    Max {d.tmax}° / Min {d.tmin}°
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div style={{ marginTop: 18, fontSize: 12, opacity: 0.6 }}>
        Map uses OpenStreetMap tiles via Leaflet.
      </div>
    </div>
  </div>
);
}