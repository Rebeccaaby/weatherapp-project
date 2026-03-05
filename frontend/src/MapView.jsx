import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function Recenter({ lat, lon }) {
  const map = useMap();
  useEffect(() => {
    if (lat == null || lon == null) return;
    map.setView([lat, lon], map.getZoom(), { animate: true });
  }, [lat, lon, map]);
  return null;
}

export default function MapPreview({ lat, lon, label }) {
  if (lat == null || lon == null) return null;

  const icon = useMemo(
    () =>
      L.icon({
        iconUrl: "/marker-icon.png",
        iconRetinaUrl: "/marker-icon-2x.png",
        shadowUrl: "/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      }),
    []
  );

  return (
    <div style={{ height: 260, borderRadius: 12, overflow: "hidden", border: "3px solid #0fc082" }}>
      <MapContainer center={[lat, lon]} zoom={10} style={{ height: "100%", width: "100%" }}>
        <Recenter lat={lat} lon={lon} />
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lon]}>
          <Popup>{label || "Selected location"}</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}