/**
 * Mapa de ruta con Leaflet + OpenStreetMap.
 * Geocodificación: Nominatim → Photon (Komoot) con simplificación progresiva.
 * Routing:        OSRM public API (ruta real por calles).
 */
import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

// ─── Servicios externos ────────────────────────────────────────────────────────

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const PHOTON    = "https://photon.komoot.io/api";
const OSRM      = "https://router.project-osrm.org/route/v1/driving";

/** Coordenadas de respaldo para San Martín de Porres cuando todo el geocoding falla */
const SMP_FALLBACK: [number, number] = [-12.026, -77.058];

type Coords = [number, number]; // [lat, lng]

/**
 * Intenta geocodificar con Nominatim (3 variantes progressivas) y,
 * si todas fallan, reintenta con Photon (Komoot) que tiene mejor
 * cobertura de calles en Lima, Perú.
 */
async function geocodificar(direccion: string): Promise<Coords | null> {
  // ── Intentos con Nominatim ────────────────────────────────────────────────
  for (const query of buildQueries(direccion)) {
    try {
      const params = new URLSearchParams({
        q: query,
        format: "json",
        limit: "1",
        countrycodes: "pe",          // restringir a Perú mejora la precisión
        addressdetails: "0",
      });
      const res = await fetch(`${NOMINATIM}?${params}`, {
        headers: { "Accept-Language": "es" },
      });
      if (!res.ok) continue;
      const data: { lat: string; lon: string }[] = await res.json();
      if (data.length) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    } catch { /* siguiente intento */ }
  }

  // ── Fallback: Photon (Komoot) ─────────────────────────────────────────────
  // Mejor cobertura de calles en América Latina que Nominatim.
  for (const query of buildQueriesPhoton(direccion)) {
    try {
      const params = new URLSearchParams({ q: query, limit: "1", lang: "es" });
      // bbox centrado en Lima: lat -12.3 a -11.6, lon -77.5 a -76.7
      const url = `${PHOTON}?${params}&bbox=-77.5,-12.3,-76.7,-11.6`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data: { features: { geometry: { coordinates: [number, number] } }[] } =
        await res.json();
      if (data.features?.length) {
        const [lng, lat] = data.features[0].geometry.coordinates;
        return [lat, lng];
      }
    } catch { /* siguiente intento */ }
  }

  return null;
}

/**
 * Genera variantes de búsqueda, de más específica a más general.
 * Ejemplo para "Jr. Áncash 3855, San Martín de Porres 15101 Lima Perú":
 *   1. "Jr. Áncash 3855, San Martín de Porres 15101 Lima Perú"
 *   2. "Jr. Áncash, San Martín de Porres, Lima, Peru"
 *   3. "San Martín de Porres, Lima, Peru"
 */
function buildQueries(raw: string): string[] {
  // Normalizar: quitar acentos para mejor compatibilidad con Nominatim
  const normalize = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "");

  const limpia = raw.trim();
  const queries: string[] = [];

  // Intento 1: dirección tal cual, asegurando que incluya Lima y Peru
  const yaIncluye =
    limpia.toLowerCase().includes("peru") ||
    limpia.toLowerCase().includes("perú");
  queries.push(yaIncluye ? limpia : `${limpia}, Lima, Peru`);

  // Intento 2: sin número de puerta ni código postal, con acentos normalizados
  const sinNumero = normalize(limpia)
    .replace(/\b\d{4,5}\b/g, "")   // eliminar números largos (CP, número de calle)
    .replace(/,\s*,/g, ",")
    .replace(/\s+/g, " ")
    .trim();
  if (sinNumero !== queries[0]) queries.push(`${sinNumero}, Lima, Peru`);

  // Intento 3: extraer solo el distrito si está en la dirección
  const distritos = [
    "San Martin de Porres",
    "San Martín de Porres",
    "Los Olivos",
    "Independencia",
    "Comas",
    "Rimac",
    "Lima",
  ];
  for (const d of distritos) {
    if (limpia.toLowerCase().includes(d.toLowerCase())) {
      queries.push(`${normalize(d)}, Lima, Peru`);
      break;
    }
  }

  return queries;
}

/**
 * Variantes de búsqueda optimizadas para Photon/Komoot.
 * Photon acepta mejor búsquedas cortas y sin códigos postales.
 */
function buildQueriesPhoton(raw: string): string[] {
  const normalize = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "");

  const limpia = raw.trim();
  const queries: string[] = [];

  // Intento 1: sin CP ni número, con Lima Peru
  const sinNumero = normalize(limpia)
    .replace(/\b\d{4,5}\b/g, "")
    .replace(/,\s*,/g, ",")
    .replace(/\s+/g, " ")
    .trim();
  queries.push(`${sinNumero}, Lima, Peru`);

  // Intento 2: solo jirón/avenida + distrito
  const partes = sinNumero.split(",").map((p) => p.trim()).filter(Boolean);
  if (partes.length >= 2) queries.push(`${partes[0]}, ${partes[1]}, Lima, Peru`);

  // Intento 3: solo calle principal (primera parte)
  if (partes.length >= 1) queries.push(`${partes[0]}, Lima, Peru`);

  return queries;
}

/** Ruta real por calles entre dos puntos usando OSRM. */
async function obtenerRuta(a: Coords, b: Coords): Promise<Coords[]> {
  try {
    const url = `${OSRM}/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (data.code !== "Ok") return [];
    return data.routes[0].geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng] as Coords
    );
  } catch {
    return [];
  }
}

// ─── Componente ───────────────────────────────────────────────────────────────

interface Props {
  origen: string;
  destino: string;
  coordsOrigen?: [number, number]; // si se proveen, se omite el geocoding
  coordsDestino?: [number, number];
  altura?: number;
  className?: string;
}

type Estado = "cargando" | "listo" | "sin-ruta" | "error";

export function MapaRuta({ origen, destino, coordsOrigen, coordsDestino, altura = 380, className = "" }: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef       = useRef<any>(null);
  const [estado, setEstado] = useState<Estado>("cargando");

  useEffect(() => {
    if (!contenedorRef.current) return;
    let activo = true;
    setEstado("cargando");

    async function montar() {
      const L = (await import("leaflet")).default;
      if (!activo || !contenedorRef.current) return;

      // Destruir mapa anterior
      if (mapaRef.current) {
        mapaRef.current.remove();
        mapaRef.current = null;
      }

      // Inicializar centrado en SMP
      const mapa = L.map(contenedorRef.current, { zoomControl: true })
        .setView(SMP_FALLBACK, 13);
      mapaRef.current = mapa;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(mapa);

      // Forzar redibujado del mapa tras montar en el DOM
      setTimeout(() => { if (activo && mapaRef.current) mapaRef.current.invalidateSize(); }, 100);

      // Usar coordenadas directas si están disponibles, sino geocodificar
      let [coordA, coordB] = await Promise.all([
        coordsOrigen ? Promise.resolve(coordsOrigen as [number,number]) : geocodificar(origen),
        coordsDestino ? Promise.resolve(coordsDestino as [number,number]) : geocodificar(destino),
      ]);

      if (!activo) return;

      // Usar coordenada de respaldo si geocoding falla completamente
      if (!coordA) coordA = SMP_FALLBACK;

      if (!coordB) {
        // Sin destino no podemos mostrar la ruta
        setEstado("error");
        // Mostrar al menos el origen
        mapa.setView(coordA, 15);
        L.marker(coordA, { icon: markerIcon(L, "A", "#4f46e5") })
          .addTo(mapa)
          .bindPopup("<b>Ala K' Rico GO</b>");
        return;
      }

      // Marcadores
      L.marker(coordA, { icon: markerIcon(L, "A", "#4f46e5") })
        .addTo(mapa)
        .bindPopup("<b>Ala K' Rico GO</b><br><small>Punto de partida</small>");

      L.marker(coordB, { icon: markerIcon(L, "B", "#f59e0b") })
        .addTo(mapa)
        .bindPopup("<b>Destino de entrega</b>");

      // Ajustar vista para que quepan ambos marcadores
      const bounds = L.latLngBounds([coordA, coordB]).pad(0.25);
      mapa.fitBounds(bounds);

      if (!activo) return;

      // Obtener ruta real por calles
      const puntos = await obtenerRuta(coordA, coordB);

      if (!activo) return;

      if (puntos.length > 0) {
        // Sombra blanca para que la línea resalte sobre el mapa
        L.polyline(puntos, { color: "#ffffff", weight: 9, opacity: 0.7 }).addTo(mapa);
        L.polyline(puntos, { color: "#4f46e5", weight: 5, opacity: 0.95 }).addTo(mapa);
        setEstado("listo");
      } else {
        // OSRM no respondió: dibujar línea recta punteada como indicador
        L.polyline([coordA, coordB], {
          color: "#4f46e5", weight: 4, opacity: 0.7, dashArray: "10, 8",
        }).addTo(mapa);
        setEstado("sin-ruta");
      }

      mapa.invalidateSize();
    }

    montar().catch(() => { if (activo) setEstado("error"); });

    return () => {
      activo = false;
      if (mapaRef.current) { mapaRef.current.remove(); mapaRef.current = null; }
    };
  }, [origen, destino]);

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ height: altura }}
    >
      {/* Overlay de carga — z-index 1000 para estar sobre las capas de Leaflet */}
      {estado === "cargando" && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted"
          style={{ zIndex: 1000 }}
        >
          <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-accent border-t-transparent" />
          <p className="text-sm text-muted-foreground">Calculando ruta…</p>
        </div>
      )}

      {/* Aviso de ruta aproximada (OSRM no disponible) */}
      {estado === "sin-ruta" && (
        <div
          className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-md bg-card/90 px-3 py-1.5 text-xs text-muted-foreground shadow"
          style={{ zIndex: 1000 }}
        >
          Ruta aproximada — servicio de calles no disponible
        </div>
      )}

      {/* Error: no se encontró el destino */}
      {estado === "error" && (
        <div
          className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-md bg-destructive/90 px-3 py-1.5 text-xs text-white shadow"
          style={{ zIndex: 1000 }}
        >
          <MapPin className="mr-1 inline h-3 w-3" />
          No se encontró la dirección de destino
        </div>
      )}

      <div ref={contenedorRef} className="h-full w-full" />
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function markerIcon(L: any, label: string, color: string) {
  return L.divIcon({
    html: `<div style="
      background:${color};
      color:#fff;
      width:32px;height:32px;
      border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      font-weight:700;font-size:14px;
      border:3px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,0.45);
      font-family:sans-serif;
    ">${label}</div>`,
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -20],
  });
}
