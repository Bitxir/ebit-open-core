import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { BiodiversityRow } from "@/functions/biodiversity.functions";

export default function BiodiversityMap({ rows }: { rows: BiodiversityRow[] }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    const map = L.map(container.current).setView([15, 15], 2);
    const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' }).addTo(map);
    tiles.on("tileerror", () => setError(true));
    const points: L.LatLngTuple[] = [];
    for (const r of rows) {
      if (r.latitude === null || r.longitude === null) continue;
      const point: L.LatLngTuple = [r.latitude, r.longitude];
      points.push(point);
      const label = document.createElement("div");
      label.textContent = `${r.taxa.scientific_name} · ${r.sensitive ? "Generalised location" : "Recorded location"}`;
      L.circleMarker(point, { radius: 7, className: r.sensitive ? "species-marker-sensitive" : "species-marker" }).bindPopup(label).addTo(map);
    }
    if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 11 });
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(container.current);
    return () => { resize.disconnect(); map.remove(); };
  }, [rows]);
  return <div className="relative"><div ref={container} className="species-map h-[420px] w-full rounded-lg border border-border" aria-label="Species observation map" />{error && <p role="status" className="mt-2 text-sm text-destructive">Some map tiles could not load. Records remain available below.</p>}</div>;
}