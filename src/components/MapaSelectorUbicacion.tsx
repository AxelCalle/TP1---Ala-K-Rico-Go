/**
 * MapaSelectorUbicacion
 * Mapa Leaflet interactivo para que el cliente fije su punto de entrega.
 * - Clic en el mapa → mueve el pin a esa posición
 * - Pin arrastrable → actualiza al soltar
 * - Geocodificación inversa (Nominatim) para obtener la dirección legible
 * - onSeleccion(coords, direccion) se dispara cada vez que el pin cambia
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

const NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse";

/** Centro por defecto: Cocina Ala K' Rico GO */
const CENTRO_DEFAULT: [number, number] = [-12.0278455, -77.0895871];

interface Props {
  onSeleccion: (coords: [number, number], direccion: string) => void;
  /** Si el padre ya tiene coordenadas (edición), centra el mapa ahí */
  coordsIniciales?: [number, number];
  altura?: number;
}

export function MapaSelectorUbicacion({
  onSeleccion,
  coordsIniciales,
  altura = 320,
}: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef       = useRef<any>(null);
  const marcadorRef   = useRef<any>(null);
  const activoRef     = useRef(true);

  const [cargando,      setCargando]      = useState(true);
  const [buscandoDir,   setBuscandoDir]   = useState(false);
  const [direccionSel,  setDireccionSel]  = useState<string>("");

  // ── Geocodificación inversa ──────────────────────────────────────────────────
  const geocodInverso = useCallback(async (lat: number, lng: number): Promise<string> => {
    try {
      const params = new URLSearchParams({
        lat: String(lat),
        lon: String(lng),
        format: "json",
        "accept-language": "es",
        zoom: "18",
      });
      const res = await fetch(`${NOMINATIM_REVERSE}?${params}`);
      if (!res.ok) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      const data = await res.json();
      const addr = data.address ?? {};

      // Construir dirección legible: calle + número, barrio, distrito
      const partes: string[] = [];
      if (addr.road || addr.pedestrian || addr.footway) {
        const calle = addr.road ?? addr.pedestrian ?? addr.footway;
        partes.push(calle + (addr.house_number ? " " + addr.house_number : ""));
      }
      const barrio = addr.suburb ?? addr.neighbourhood ?? addr.quarter;
      if (barrio) partes.push(barrio);
      const distrito = addr.city_district ?? addr.borough;
      if (distrito) partes.push(distrito);
      const ciudad = addr.city ?? addr.town;
      if (ciudad && ciudad.toLowerCase() !== (distrito ?? "").toLowerCase()) partes.push(ciudad);

      return partes.length
        ? partes.join(", ")
        : (data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } catch {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  }, []);

  // ── Actualizar posición del pin ──────────────────────────────────────────────
  const actualizarPosicion = useCallback(
    async (lat: number, lng: number, marker: any) => {
      setBuscandoDir(true);
      const dir = await geocodInverso(lat, lng);
      if (!activoRef.current) return;
      setBuscandoDir(false);
      setDireccionSel(dir);
      onSeleccion([lat, lng], dir);
      try {
        marker
          .bindPopup(
            `<div style="font-size:12px;max-width:200px">
              <b style="color:#f59e0b">📍 Ubicación fijada</b><br>
              <span style="color:#666">${dir}</span>
            </div>`,
          )
          .openPopup();
      } catch { /* el mapa puede haberse desmontado */ }
    },
    [geocodInverso, onSeleccion],
  );

  // ── Montar el mapa (solo una vez) ────────────────────────────────────────────
  useEffect(() => {
    activoRef.current = true;
    if (!contenedorRef.current) return;

    async function montar() {
      const L = (await import("leaflet")).default;
      if (!activoRef.current || !contenedorRef.current) return;

      // Destruir instancia anterior si la hubiera
      if (mapaRef.current) {
        mapaRef.current.remove();
        mapaRef.current = null;
      }

      const centro = coordsIniciales ?? CENTRO_DEFAULT;
      const zoom   = coordsIniciales ? 17 : 15;

      const mapa = L.map(contenedorRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView(centro, zoom);

      mapaRef.current = mapa;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(mapa);

      // Redibujado tras montar en el DOM
      setTimeout(() => {
        if (activoRef.current && mapaRef.current) mapaRef.current.invalidateSize();
      }, 120);

      // Marcador arrastrable
      const marker = L.marker(centro, {
        icon: crearIconoPin(L),
        draggable: true,
      }).addTo(mapa);
      marcadorRef.current = marker;

      // Tooltip inicial
      marker
        .bindPopup(
          `<div style="font-size:12px">
            <b>Arrastra el pin</b> o <b>toca el mapa</b><br>
            para ajustar tu ubicación
          </div>`,
        )
        .openPopup();

      // Eventos
      marker.on("dragend", () => {
        const { lat, lng } = marker.getLatLng();
        actualizarPosicion(lat, lng, marker);
      });

      mapa.on("click", (e: any) => {
        marker.setLatLng(e.latlng);
        actualizarPosicion(e.latlng.lat, e.latlng.lng, marker);
      });

      // Si hay coords iniciales, geocodificar al abrir
      if (coordsIniciales) {
        actualizarPosicion(coordsIniciales[0], coordsIniciales[1], marker);
      }

      setCargando(false);
    }

    montar().catch(() => {
      if (activoRef.current) setCargando(false);
    });

    return () => {
      activoRef.current = false;
      if (mapaRef.current) {
        mapaRef.current.remove();
        mapaRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // montar una vez; coordsIniciales solo se usa al inicio

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-border"
      style={{ height: altura }}
    >
      {/* Overlay de carga */}
      {cargando && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted"
          style={{ zIndex: 1000 }}
        >
          <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-accent border-t-transparent" />
          <p className="text-xs text-muted-foreground">Cargando mapa…</p>
        </div>
      )}

      {/* Hint superior */}
      {!cargando && (
        <div
          className="pointer-events-none absolute left-1/2 top-2.5 z-[1000] -translate-x-1/2 whitespace-nowrap rounded-full bg-card/90 px-3 py-1 text-[11px] font-medium shadow"
          style={{ backdropFilter: "blur(4px)" }}
        >
          <MapPin className="mr-1 inline h-3 w-3 text-accent" />
          Toca el mapa o arrastra el pin
        </div>
      )}

      {/* Dirección detectada — barra inferior */}
      {(direccionSel || buscandoDir) && !cargando && (
        <div
          className="absolute bottom-2 left-2 right-2 z-[1000] flex items-center gap-2 rounded-lg bg-card/95 px-3 py-2 shadow"
          style={{ backdropFilter: "blur(4px)" }}
        >
          {buscandoDir ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-[2px] border-accent border-t-transparent flex-none" />
              <span className="text-xs text-muted-foreground">Obteniendo dirección…</span>
            </>
          ) : (
            <>
              <MapPin className="h-3.5 w-3.5 flex-none text-accent" />
              <span className="text-xs font-medium leading-snug">{direccionSel}</span>
            </>
          )}
        </div>
      )}

      <div ref={contenedorRef} className="h-full w-full" />
    </div>
  );
}

// ── Icono pin personalizado ────────────────────────────────────────────────────

function crearIconoPin(L: any) {
  return L.divIcon({
    html: `
      <div style="
        position:relative;
        width:32px;
        height:44px;
        filter: drop-shadow(0 3px 6px rgba(0,0,0,0.4));
      ">
        <!-- Cuerpo del pin -->
        <svg viewBox="0 0 32 44" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:32px;height:44px">
          <path d="M16 0C7.163 0 0 7.163 0 16c0 10 16 28 16 28S32 26 32 16C32 7.163 24.837 0 16 0z"
                fill="#f59e0b"/>
          <path d="M16 0C7.163 0 0 7.163 0 16c0 10 16 28 16 28S32 26 32 16C32 7.163 24.837 0 16 0z"
                fill="url(#pinGrad)"/>
          <circle cx="16" cy="16" r="7" fill="white" opacity="0.95"/>
          <circle cx="16" cy="16" r="4" fill="#f59e0b"/>
          <defs>
            <linearGradient id="pinGrad" x1="0" y1="0" x2="32" y2="44" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#fbbf24"/>
              <stop offset="100%" stop-color="#d97706"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
    `,
    className: "",
    iconSize:   [32, 44],
    iconAnchor: [16, 44],   // punta del pin en el suelo
    popupAnchor: [0, -46],
  });
}
