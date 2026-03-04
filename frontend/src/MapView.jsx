import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useEffect } from "react";

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