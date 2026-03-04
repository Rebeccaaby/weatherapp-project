// const BASE = "http://localhost:4000";
const BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  let data;
  try 
  { 
    data = text ? JSON.parse(text) : null;
  } 
  catch { data = text; }

  if (!res.ok) {
    const msg = (data && data.error) ? data.error : `Request failed: ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export const api = {
  listRequests: () => request("/api/requests"),
  createRequest: (payload) => request("/api/requests", { method: "POST", body: JSON.stringify(payload) }),
  updateRequest: (id, patch) => request(`/api/requests/${id}`, { method: "PUT", body: JSON.stringify(patch) }),
  deleteRequest: (id) => request(`/api/requests/${id}`, { method: "DELETE" }),
  exportUrl: (format) => `${BASE}/api/requests/export?format=${encodeURIComponent(format)}`,

   geocode: async (q) => request(`/api/geocode?q=${encodeURIComponent(q)}`),
   weatherByLatLon: async (lat, lon) => request(`/api/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`),
};