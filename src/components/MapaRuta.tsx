/**
 * Mapa de ruta con Leaflet + OpenStreetMap.
 * Geocodificación: Nominatim → Photon (Komoot) con simplificación progresiva.
 * Routing:        OSRM public API (ruta real por calles).
 * MapaRutaMulti:  avatar animado del repartidor + navegación tipo app
 *                 (maniobras con icono, bottom sheet en móvil, panel en desktop).
 */
import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import {
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  LocateFixed,
  MapPin,
  Maximize2,
  Merge,
  Minimize2,
  Minus,
  Navigation2,
  Plus,
  RotateCw,
  Scan,
  Split,
  Square,
  Undo2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

// ─── Servicios externos ────────────────────────────────────────────────────────

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const PHOTON = "https://photon.komoot.io/api";
const OSRM = "https://router.project-osrm.org/route/v1/driving";

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
        countrycodes: "pe",
        addressdetails: "0",
      });
      const res = await fetch(`${NOMINATIM}?${params}`, {
        headers: { "Accept-Language": "es" },
      });
      if (!res.ok) continue;
      const data: { lat: string; lon: string }[] = await res.json();
      if (data.length) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    } catch {
      /* siguiente intento */
    }
  }

  // ── Fallback: Photon (Komoot) ─────────────────────────────────────────────
  for (const query of buildQueriesPhoton(direccion)) {
    try {
      const params = new URLSearchParams({ q: query, limit: "1", lang: "es" });
      const url = `${PHOTON}?${params}&bbox=-77.5,-12.3,-76.7,-11.6`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data: { features: { geometry: { coordinates: [number, number] } }[] } =
        await res.json();
      if (data.features?.length) {
        const [lng, lat] = data.features[0].geometry.coordinates;
        return [lat, lng];
      }
    } catch {
      /* siguiente intento */
    }
  }

  return null;
}

function buildQueries(raw: string): string[] {
  const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const limpia = raw.trim();
  const queries: string[] = [];

  const yaIncluye = limpia.toLowerCase().includes("peru") || limpia.toLowerCase().includes("perú");
  queries.push(yaIncluye ? limpia : `${limpia}, Lima, Peru`);

  const sinNumero = normalize(limpia)
    .replace(/\b\d{4,5}\b/g, "")
    .replace(/,\s*,/g, ",")
    .replace(/\s+/g, " ")
    .trim();
  if (sinNumero !== queries[0]) queries.push(`${sinNumero}, Lima, Peru`);

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

function buildQueriesPhoton(raw: string): string[] {
  const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const limpia = raw.trim();
  const queries: string[] = [];

  const sinNumero = normalize(limpia)
    .replace(/\b\d{4,5}\b/g, "")
    .replace(/,\s*,/g, ",")
    .replace(/\s+/g, " ")
    .trim();
  queries.push(`${sinNumero}, Lima, Peru`);

  const partes = sinNumero
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (partes.length >= 2) queries.push(`${partes[0]}, ${partes[1]}, Lima, Peru`);
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
      ([lng, lat]: [number, number]) => [lat, lng] as Coords,
    );
  } catch {
    return [];
  }
}

// ─── Mapas (UI) ───────────────────────────────────────────────────────────────

type Variante = "origin" | "pending" | "current" | "done" | "dest";

/** Clases de fondo equivalentes a los colores de .akr-pin--* (styles.css) */
const VARIANTE_BG: Record<Variante, string> = {
  origin: "bg-coal text-cream",
  pending: "bg-amber-700 text-white",
  current: "bg-accent text-accent-foreground",
  done: "bg-green-600 text-white",
  dest: "bg-amber-600 text-white",
};

const VARIANTE_TEXTO: Record<Variante, string> = {
  origin: "Punto de partida",
  pending: "Pendiente",
  current: "Siguiente parada",
  done: "Completada",
  dest: "Destino final",
};

const TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
const TILE_ATTRIBUTION =
  'Tiles &copy; <a href="https://www.esri.com">Esri</a> &mdash; Source: Esri, HERE, Garmin, © OpenStreetMap contributors';

/** Crea el mapa base sin el control de zoom nativo (se usan controles táctiles propios). */
function crearMapaBase(L: any, el: HTMLElement, centro: Coords, conAtribucion = true) {
  const mapa = L.map(el, { zoomControl: false, attributionControl: conAtribucion }).setView(
    centro,
    13,
  );
  L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(mapa);
  return mapa;
}

function escaparHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}

/** Pin con número y estado. Área táctil de 44×52 px. */
function pinIcon(L: any, label: string, variante: Variante, seleccionado = false) {
  const wrap = [
    "akr-pin-wrap",
    variante === "current" ? "akr-pin-wrap--current" : "",
    seleccionado ? "akr-pin-wrap--selected" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return L.divIcon({
    html: `<div class="${wrap}"><div class="akr-pin akr-pin--${variante}"><span>${escaparHtml(label)}</span></div></div>`,
    className: "",
    iconSize: [44, 52],
    iconAnchor: [22, 45],
    popupAnchor: [0, -42],
  });
}

function formatDist(m: number): string {
  if (m < 1000) return `${Math.max(0, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function urlNavegar(c: Coords): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${c[0]},${c[1]}&travelmode=driving`;
}

/** Pantalla completa del mapa (fixed) con Escape para salir y scroll del body bloqueado. */
function usePantallaCompleta(mapaRef: React.RefObject<any>) {
  const [activa, setActiva] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => mapaRef.current?.invalidateSize(), 60);
    if (!activa) return () => clearTimeout(t);
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiva(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = previo;
      window.removeEventListener("keydown", onKey);
    };
  }, [activa, mapaRef]);
  return [activa, setActiva] as const;
}

/** Recalcula el tamaño de Leaflet cuando cambia el contenedor (rotación, paneles, etc.). */
function useAjusteTamano(
  elRef: React.RefObject<HTMLElement | null>,
  mapaRef: React.RefObject<any>,
) {
  useEffect(() => {
    const el = elRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => mapaRef.current?.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [elRef, mapaRef]);
}

function BotonMapa({
  label,
  onClick,
  activo,
  children,
}: {
  label: string;
  onClick: () => void;
  activo?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={activo}
      onClick={onClick}
      className={`grid h-11 w-11 place-items-center rounded-full shadow-md ring-1 ring-black/5 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        activo ? "bg-accent text-accent-foreground" : "bg-card text-foreground hover:bg-secondary"
      }`}
    >
      {children}
    </button>
  );
}

/** Columna de controles táctiles: zoom, ajustar ruta, centrar y pantalla completa. */
function ControlesMapa({
  mapaRef,
  onAjustar,
  onCentrar,
  centrado,
  pantallaCompleta,
  onPantallaCompleta,
  top,
}: {
  mapaRef: React.RefObject<any>;
  onAjustar: () => void;
  onCentrar?: () => void;
  centrado?: boolean;
  pantallaCompleta: boolean;
  onPantallaCompleta: () => void;
  top: string;
}) {
  return (
    <div className="absolute right-3 z-1001 flex flex-col gap-2" style={{ top }}>
      <div className="flex flex-col overflow-hidden rounded-full bg-card shadow-md ring-1 ring-black/5">
        <button
          type="button"
          aria-label="Acercar"
          title="Acercar"
          onClick={() => mapaRef.current?.zoomIn()}
          className="grid h-11 w-11 place-items-center transition hover:bg-secondary active:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
        </button>
        <span className="mx-2 h-px bg-border" />
        <button
          type="button"
          aria-label="Alejar"
          title="Alejar"
          onClick={() => mapaRef.current?.zoomOut()}
          className="grid h-11 w-11 place-items-center transition hover:bg-secondary active:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <Minus className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <BotonMapa label="Ver toda la ruta" onClick={onAjustar}>
        <Scan className="h-5 w-5" aria-hidden="true" />
      </BotonMapa>
      {onCentrar && (
        <BotonMapa label="Seguir al repartidor" onClick={onCentrar} activo={centrado}>
          <LocateFixed className="h-5 w-5" aria-hidden="true" />
        </BotonMapa>
      )}
      <BotonMapa
        label={pantallaCompleta ? "Salir de pantalla completa" : "Pantalla completa"}
        onClick={onPantallaCompleta}
        activo={pantallaCompleta}
      >
        {pantallaCompleta ? (
          <Minimize2 className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Maximize2 className="h-5 w-5" aria-hidden="true" />
        )}
      </BotonMapa>
    </div>
  );
}

function OverlayCarga({ texto }: { texto: string }) {
  return (
    <div
      role="status"
      className="absolute inset-0 z-1000 flex flex-col items-center justify-center gap-2 bg-muted"
    >
      <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-accent border-t-transparent" />
      <p className="text-sm text-muted-foreground">{texto}</p>
    </div>
  );
}

/** Convierte la altura (número en px o valor CSS, p.ej. "min(60svh, 480px)") a CSS. */
function alturaCss(altura: number | string, pantallaCompleta: boolean): string {
  if (pantallaCompleta) return "100dvh";
  return typeof altura === "number" ? `${altura}px` : altura;
}

// ─── Componente simple (un origen → un destino) ───────────────────────────────

interface Props {
  origen: string;
  destino: string;
  coordsOrigen?: [number, number];
  coordsDestino?: [number, number];
  /** px o cualquier valor CSS de altura (p.ej. "clamp(320px, 55svh, 560px)") */
  altura?: number | string;
  className?: string;
}

type Estado = "cargando" | "listo" | "sin-ruta" | "error";

export function MapaRuta({
  origen,
  destino,
  coordsOrigen,
  coordsDestino,
  altura = 380,
  className = "",
}: Props) {
  const raizRef = useRef<HTMLDivElement>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<any>(null);
  const boundsRef = useRef<any>(null);
  const [estado, setEstado] = useState<Estado>("cargando");
  const [pantallaCompleta, setPantallaCompleta] = usePantallaCompleta(mapaRef);
  useAjusteTamano(raizRef, mapaRef);

  useEffect(() => {
    if (!contenedorRef.current) return;
    let activo = true;
    setEstado("cargando");

    async function montar() {
      const L = (await import("leaflet")).default;
      if (!activo || !contenedorRef.current) return;

      if (mapaRef.current) {
        mapaRef.current.remove();
        mapaRef.current = null;
      }

      const mapa = crearMapaBase(L, contenedorRef.current, SMP_FALLBACK);
      mapaRef.current = mapa;

      setTimeout(() => {
        if (activo && mapaRef.current) mapaRef.current.invalidateSize();
      }, 100);

      const [coordAInit, coordB] = await Promise.all([
        coordsOrigen ? Promise.resolve(coordsOrigen as [number, number]) : geocodificar(origen),
        coordsDestino ? Promise.resolve(coordsDestino as [number, number]) : geocodificar(destino),
      ]);
      let coordA = coordAInit;

      if (!activo) return;

      if (!coordA) coordA = SMP_FALLBACK;

      if (!coordB) {
        setEstado("error");
        mapa.setView(coordA, 15);
        boundsRef.current = L.latLngBounds([coordA, coordA]);
        L.marker(coordA, { icon: pinIcon(L, "A", "origin"), title: "Ala K' Rico GO" })
          .addTo(mapa)
          .bindPopup("<b>Ala K' Rico GO</b>");
        return;
      }

      L.marker(coordA, { icon: pinIcon(L, "A", "origin"), title: "Punto de partida" })
        .addTo(mapa)
        .bindPopup("<b>Ala K' Rico GO</b><br><small>Punto de partida</small>");

      L.marker(coordB, { icon: pinIcon(L, "B", "dest"), title: "Destino de entrega" })
        .addTo(mapa)
        .bindPopup("<b>Destino de entrega</b>");

      const bounds = L.latLngBounds([coordA, coordB]).pad(0.25);
      boundsRef.current = bounds;
      mapa.fitBounds(bounds);

      if (!activo) return;

      const puntos = await obtenerRuta(coordA, coordB);

      if (!activo) return;

      if (puntos.length > 0) {
        L.polyline(puntos, { color: "#ffffff", weight: 9, opacity: 0.7 }).addTo(mapa);
        L.polyline(puntos, { color: "#ea580c", weight: 5, opacity: 0.95 }).addTo(mapa);
        boundsRef.current = L.latLngBounds(puntos).pad(0.15);
        setEstado("listo");
      } else {
        L.polyline([coordA, coordB], {
          color: "#ea580c",
          weight: 4,
          opacity: 0.7,
          dashArray: "10, 8",
        }).addTo(mapa);
        setEstado("sin-ruta");
      }

      mapa.invalidateSize();
    }

    montar().catch(() => {
      if (activo) setEstado("error");
    });

    return () => {
      activo = false;
      if (mapaRef.current) {
        mapaRef.current.remove();
        mapaRef.current = null;
      }
    };
  }, [origen, destino, coordsOrigen, coordsDestino]);

  const top = pantallaCompleta ? "calc(env(safe-area-inset-top) + 0.75rem)" : "0.75rem";

  return (
    <div
      ref={raizRef}
      className={`isolate overflow-hidden ${
        pantallaCompleta ? "fixed inset-0 z-1100 bg-background" : `relative ${className}`
      }`}
      style={{ height: alturaCss(altura, pantallaCompleta) }}
    >
      {estado === "cargando" && <OverlayCarga texto="Calculando ruta…" />}

      {estado === "sin-ruta" && (
        <div className="absolute left-3 right-[4.25rem] top-3 z-1000 rounded-lg bg-card/95 px-3 py-2 text-xs text-muted-foreground shadow">
          Ruta aproximada — servicio de calles no disponible
        </div>
      )}

      {estado === "error" && (
        <div
          role="alert"
          className="absolute left-3 right-[4.25rem] top-3 z-1000 flex items-center gap-1.5 rounded-lg bg-destructive/95 px-3 py-2 text-xs text-white shadow"
        >
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          No se encontró la dirección de destino
        </div>
      )}

      {estado !== "cargando" && (
        <ControlesMapa
          mapaRef={mapaRef}
          top={top}
          onAjustar={() => {
            if (boundsRef.current) mapaRef.current?.fitBounds(boundsRef.current);
          }}
          pantallaCompleta={pantallaCompleta}
          onPantallaCompleta={() => setPantallaCompleta((v) => !v)}
        />
      )}

      <div
        ref={contenedorRef}
        className="h-full w-full"
        role="region"
        aria-label="Mapa de la ruta de entrega"
      />
    </div>
  );
}

// ─── Mapa multi-parada ────────────────────────────────────────────────────────

/** Maniobra de OSRM ya ubicada sobre la polilínea de la ruta. */
interface Paso {
  tipo: string;
  modificador?: string;
  salida?: number;
  calle: string;
  /** metros hasta la siguiente maniobra */
  distancia: number;
  coord: Coords;
  /** índice del tramo (leg): va de la parada `tramo` a la `tramo + 1` */
  tramo: number;
  /** índice del punto de la polilínea donde ocurre la maniobra */
  polyIdx: number;
}

interface RutaCalculada {
  puntos: Coords[];
  /** distancia acumulada (m) hasta cada punto de la polilínea */
  acum: number[];
  pasos: Paso[];
  /** polyIdx de llegada a cada parada k ≥ 1 (posición k - 1) */
  llegadaParada: number[];
  distancia: number;
  duracion: number;
}

async function obtenerRutaMulti(coords: Coords[]): Promise<RutaCalculada | null> {
  if (coords.length < 2) return null;
  try {
    const waypoints = coords.map(([lat, lng]) => `${lng},${lat}`).join(";");
    const url = `${OSRM}/${waypoints}?overview=full&geometries=geojson&steps=true&annotations=false`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== "Ok") return null;

    const ruta = data.routes[0];
    const puntos: Coords[] = ruta.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng] as Coords,
    );
    if (puntos.length < 2) return null;

    const acum: number[] = [0];
    for (let i = 1; i < puntos.length; i++) {
      acum.push(acum[i - 1] + distanciaM(puntos[i - 1], puntos[i]));
    }

    // Ubica cada maniobra en la polilínea avanzando de forma monótona,
    // para que una calle recorrida dos veces no confunda el orden.
    const pasos: Paso[] = [];
    const llegadaParada: number[] = [];
    let desde = 0;
    (ruta.legs ?? []).forEach((leg: any, tramo: number) => {
      for (const step of leg.steps ?? []) {
        const m = step.maneuver ?? {};
        const coord: Coords = m.location ? [m.location[1], m.location[0]] : puntos[desde];
        let polyIdx = -1;
        let mejor = Infinity;
        let mejorIdx = desde;
        for (let j = desde; j < puntos.length; j++) {
          const d = distanciaM(puntos[j], coord);
          if (d < 5) {
            polyIdx = j;
            break;
          }
          if (d < mejor) {
            mejor = d;
            mejorIdx = j;
          }
        }
        if (polyIdx < 0) polyIdx = mejorIdx;
        desde = polyIdx;
        pasos.push({
          tipo: m.type ?? "",
          modificador: m.modifier,
          salida: m.exit,
          calle: step.name ?? "",
          distancia: Math.round(step.distance ?? 0),
          coord,
          tramo,
          polyIdx,
        });
      }
      llegadaParada.push(desde);
    });

    return {
      puntos,
      acum,
      pasos,
      llegadaParada,
      distancia: ruta.distance ?? acum[acum.length - 1],
      duracion: ruta.duration ?? 0,
    };
  } catch {
    return null;
  }
}

const DIRECCION: Record<string, string> = {
  left: "a la izquierda",
  right: "a la derecha",
  "sharp left": "cerrado a la izquierda",
  "sharp right": "cerrado a la derecha",
  "slight left": "ligeramente a la izquierda",
  "slight right": "ligeramente a la derecha",
  straight: "recto",
  uturn: "en U",
};

const ORDINAL = ["primera", "segunda", "tercera", "cuarta", "quinta", "sexta"];

/** Acción corta de la maniobra ("Gira a la derecha"). La calle va aparte. */
function accionPaso(p: Paso, totalParadas: number): string {
  const dir = DIRECCION[p.modificador ?? ""] ?? "";
  if (p.modificador === "uturn" && p.tipo !== "arrive") return "Da la vuelta en U";
  switch (p.tipo) {
    case "depart":
      return p.tramo === 0 ? "Sal del punto de partida" : `Continúa hacia la parada ${p.tramo + 1}`;
    case "arrive":
      return p.tramo + 1 >= totalParadas - 1
        ? "Llegada al destino final"
        : `Llegada a la parada ${p.tramo + 1}`;
    case "turn":
    case "end of road":
      return p.modificador === "straight" ? "Continúa recto" : `Gira ${dir}`.trim();
    case "new name":
    case "continue":
      return p.modificador && p.modificador !== "straight" ? `Mantente ${dir}` : "Continúa recto";
    case "merge":
      return `Incorpórate ${dir}`.trim();
    case "on ramp":
      return `Toma la rampa ${dir}`.trim();
    case "off ramp":
      return `Toma la salida ${dir}`.trim();
    case "fork":
      return `En la bifurcación, mantente ${dir}`.trim();
    case "roundabout":
    case "rotary":
    case "roundabout turn":
      return p.salida
        ? `En la rotonda, toma la ${ORDINAL[p.salida - 1] ?? `${p.salida}.ª`} salida`
        : "Entra a la rotonda";
    case "exit roundabout":
    case "exit rotary":
      return "Sal de la rotonda";
    default:
      return dir && dir !== "recto" ? `Mantente ${dir}` : "Continúa recto";
  }
}

function IconoManiobra({ paso, className }: { paso: Paso; className?: string }) {
  const { tipo, modificador: m } = paso;
  let Icono = ArrowUp;
  if (tipo === "arrive") Icono = Flag;
  else if (tipo === "depart") Icono = Navigation2;
  else if (tipo.includes("roundabout") || tipo.includes("rotary")) Icono = RotateCw;
  else if (m === "uturn") Icono = Undo2;
  else if (m === "left" || m === "sharp left") Icono = CornerUpLeft;
  else if (m === "right" || m === "sharp right") Icono = CornerUpRight;
  else if (m === "slight left") Icono = ArrowUpLeft;
  else if (m === "slight right") Icono = ArrowUpRight;
  else if (tipo === "merge") Icono = Merge;
  else if (tipo === "fork") Icono = Split;
  return <Icono className={className} aria-hidden="true" />;
}

// ─── Calcular bearing entre dos puntos ───────────────────────────────────────

function calcularBearing(p1: Coords, p2: Coords): number {
  const lat1 = (p1[0] * Math.PI) / 180;
  const lat2 = (p2[0] * Math.PI) / 180;
  const dLng = ((p2[1] - p1[1]) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
}

export interface MultiStop {
  coords: Coords;
  label: string;
  /** Nombre visible de la parada (cliente o local) */
  sublabel?: string;
  /** Obsoleto: el color del marker ahora depende del estado de la parada */
  color?: string;
  direccion?: string;
  /** Estado del pedido ya traducido (p.ej. "En camino") */
  estadoPedido?: string;
  /** ETA acumulado ya formateado (p.ej. "+12 min") */
  eta?: string;
  /** Enlace al detalle del pedido */
  href?: string;
}

interface MultiProps {
  stops: MultiStop[];
  /** px o cualquier valor CSS de altura (p.ej. "clamp(420px, 72svh, 760px)") */
  altura?: number | string;
  className?: string;
}

type PestanaPanel = "indicaciones" | "paradas";

/**
 * Mapa de ruta multi-parada con Leaflet.
 * - Pins numerados con estado (origen, pendiente, siguiente, completada, destino).
 * - Ruta real por calles (OSRM) y avatar animado que la recorre.
 * - Navegación tipo app: maniobra actual con icono + distancia, "después",
 *   resumen restante y lista de indicaciones/paradas.
 * - Desktop: panel lateral. Móvil/tablet: bottom sheet sobre el mapa.
 * - stops[0] es siempre el depot (punto de origen).
 */
export function MapaRutaMulti({ stops, altura = 400, className = "" }: MultiProps) {
  const raizRef = useRef<HTMLDivElement>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const avatarRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const boundsRef = useRef<any>(null);
  const animFrameRef = useRef<number>(0);
  const seguirRef = useRef(true);
  const ultimoAnunciadoRef = useRef(-1);
  const listaRef = useRef<HTMLOListElement>(null);

  const [estado, setEstado] = useState<Estado>("cargando");
  const [ruta, setRuta] = useState<RutaCalculada | null>(null);
  const [simulando, setSimulando] = useState(false);
  const [llegada, setLlegada] = useState(false);
  const [posIdx, setPosIdx] = useState(0);
  const [seguir, setSeguir] = useState(true);
  const [vozActiva, setVozActiva] = useState(true);
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [pestana, setPestana] = useState<PestanaPanel>("paradas");
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const [pantallaCompleta, setPantallaCompleta] = usePantallaCompleta(mapaRef);
  const swipeYRef = useRef<number | null>(null);
  const swipeHechoRef = useRef(false);
  useAjusteTamano(raizRef, mapaRef);

  const hablar = useCallback(
    (texto: string) => {
      if (!vozActiva) return;
      try {
        if ("speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const utt = new SpeechSynthesisUtterance(texto);
          utt.lang = "es-PE";
          utt.rate = 1.05;
          utt.pitch = 1;
          window.speechSynthesis.speak(utt);
        }
      } catch {
        /* no crítico */
      }
    },
    [vozActiva],
  );

  // ── Montar el mapa ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!contenedorRef.current || stops.length < 2) return;
    let activo = true;
    setEstado("cargando");
    setRuta(null);
    setSimulando(false);
    setLlegada(false);
    setPosIdx(0);
    setSeleccion(null);
    cancelAnimationFrame(animFrameRef.current);

    async function montar() {
      const L = (await import("leaflet")).default;
      leafletRef.current = L;
      if (!activo || !contenedorRef.current) return;

      if (mapaRef.current) {
        mapaRef.current.remove();
        mapaRef.current = null;
      }

      // La atribución se muestra en el panel: en móvil el bottom sheet taparía la nativa
      const mapa = crearMapaBase(L, contenedorRef.current, stops[0].coords, false);
      mapaRef.current = mapa;
      mapa.on("dragstart", () => {
        seguirRef.current = false;
        setSeguir(false);
      });

      setTimeout(() => {
        if (activo && mapaRef.current) mapaRef.current.invalidateSize();
      }, 100);

      const bounds = L.latLngBounds(stops.map((s) => s.coords)).pad(0.2);
      boundsRef.current = bounds;
      mapa.fitBounds(bounds);

      markersRef.current = stops.map((stop, idx) => {
        const variante: Variante =
          idx === 0 ? "origin" : idx === stops.length - 1 ? "dest" : "pending";
        const marker = L.marker(stop.coords, {
          icon: pinIcon(L, stop.label, variante),
          title: idx === 0 ? "Punto de partida" : `Parada ${idx}: ${stop.sublabel ?? ""}`,
          keyboard: true,
        }).addTo(mapa);
        marker.on("click", () => {
          setSeleccion(idx);
          setPanelAbierto(true);
        });
        return marker;
      });

      if (!activo) return;

      const calculada = await obtenerRutaMulti(stops.map((s) => s.coords));

      if (!activo) return;

      if (calculada) {
        L.polyline(calculada.puntos, { color: "#ffffff", weight: 9, opacity: 0.6 }).addTo(mapa);
        L.polyline(calculada.puntos, { color: "#ea580c", weight: 5, opacity: 0.95 }).addTo(mapa);
        boundsRef.current = L.latLngBounds(calculada.puntos).pad(0.12);

        const avatar = L.marker(calculada.puntos[0], {
          icon: crearAvatarRepartidor(L, 0),
          zIndexOffset: 1000,
          interactive: false,
        }).addTo(mapa);
        avatarRef.current = avatar;

        setRuta(calculada);
        setEstado("listo");
      } else {
        L.polyline(
          stops.map((s) => s.coords),
          { color: "#ea580c", weight: 4, opacity: 0.7, dashArray: "10, 8" },
        ).addTo(mapa);
        setEstado("sin-ruta");
      }

      mapa.invalidateSize();
    }

    montar().catch(() => {
      if (activo) setEstado("error");
    });

    return () => {
      activo = false;
      cancelAnimationFrame(animFrameRef.current);
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      markersRef.current = [];
      avatarRef.current = null;
      if (mapaRef.current) {
        mapaRef.current.remove();
        mapaRef.current = null;
      }
    };
  }, [stops]);

  // ── Progreso derivado de la posición del avatar ────────────────────────────
  const enCurso = simulando || llegada;
  const totalParadas = stops.length;
  let pasoIdx = 0;
  if (ruta && enCurso) {
    for (let i = 0; i < ruta.pasos.length; i++) {
      if (ruta.pasos[i].polyIdx <= posIdx) pasoIdx = i;
      else break;
    }
  }
  const proximo = ruta && simulando ? (ruta.pasos[pasoIdx + 1] ?? null) : null;
  const despues = ruta && simulando ? (ruta.pasos[pasoIdx + 2] ?? null) : null;
  const distProximo = ruta && proximo ? ruta.acum[proximo.polyIdx] - ruta.acum[posIdx] : 0;
  const restanteM = ruta
    ? ruta.distancia * (1 - ruta.acum[posIdx] / ruta.acum[ruta.acum.length - 1])
    : 0;
  const restanteMin = ruta
    ? Math.max(llegada ? 0 : 1, Math.round((ruta.duracion * (restanteM / ruta.distancia)) / 60))
    : 0;
  const completadas = ruta && enCurso ? ruta.llegadaParada.filter((pi) => pi <= posIdx).length : 0;
  const paradaSiguiente = Math.min(completadas + 1, totalParadas - 1);

  const varianteParada = useCallback(
    (k: number): Variante => {
      if (k === 0) return "origin";
      if (enCurso && k <= completadas) return "done";
      if (simulando && k === completadas + 1) return "current";
      return k === totalParadas - 1 ? "dest" : "pending";
    },
    [enCurso, simulando, completadas, totalParadas],
  );

  // ── Actualizar pins según estado / selección ───────────────────────────────
  useEffect(() => {
    const L = leafletRef.current;
    if (!L) return;
    markersRef.current.forEach((m, k) => {
      if (!stops[k]) return;
      m.setIcon(pinIcon(L, stops[k].label, varianteParada(k), seleccion === k));
      m.setZIndexOffset(seleccion === k ? 900 : 0);
    });
  }, [varianteParada, seleccion, stops, estado]);

  // ── Voz: anunciar la próxima maniobra cada vez que se supera una ──────────
  useEffect(() => {
    if (!simulando || !ruta || pasoIdx === ultimoAnunciadoRef.current) return;
    ultimoAnunciadoRef.current = pasoIdx;
    const prox = ruta.pasos[pasoIdx + 1];
    if (!prox) return;
    const dist = ruta.acum[prox.polyIdx] - ruta.acum[posIdx];
    const accion = accionPaso(prox, totalParadas);
    const calle = prox.calle && prox.tipo !== "arrive" ? ` en ${prox.calle}` : "";
    const prefijo =
      dist > 30
        ? `En ${formatDist(dist).replace(" m", " metros").replace(" km", " kilómetros")}, `
        : "";
    hablar(
      `${prefijo}${prefijo ? accion.charAt(0).toLowerCase() + accion.slice(1) : accion}${calle}`,
    );
  }, [simulando, ruta, pasoIdx, posIdx, totalParadas, hablar]);

  // ── Mantener visible la indicación actual en la lista ─────────────────────
  useEffect(() => {
    if (!simulando || pestana !== "indicaciones") return;
    const el = listaRef.current?.querySelector<HTMLElement>("[data-actual='true']");
    el?.scrollIntoView({ block: "nearest" });
  }, [pasoIdx, simulando, pestana]);

  // ── Animación del avatar a lo largo de la ruta ─────────────────────────────
  function iniciarSimulacion() {
    const r = ruta;
    const mapa = mapaRef.current;
    if (!r || !avatarRef.current || !mapa) return;
    cancelAnimationFrame(animFrameRef.current);

    ultimoAnunciadoRef.current = -1;
    seguirRef.current = true;
    setSeguir(true);
    setSimulando(true);
    setLlegada(false);
    setPosIdx(0);
    setSeleccion(null);
    setPestana("indicaciones");

    avatarRef.current.setLatLng(r.puntos[0]);
    mapa.setView(r.puntos[0], Math.max(mapa.getZoom(), 16), { animate: true });

    // Un punto de ruta por cada FRAMES_POR_PUNTO frames (≈60fps).
    // Con 6 frames/punto: ~10 pts/s → ~30-60 s para una ruta urbana típica.
    const FRAMES_POR_PUNTO = 6;
    let frameCount = 0;
    let idx = 0;

    const frame = () => {
      if (!avatarRef.current || !mapaRef.current) return;
      frameCount++;

      if (frameCount % FRAMES_POR_PUNTO === 0) {
        idx++;

        if (idx >= r.puntos.length - 1) {
          idx = r.puntos.length - 1;
          avatarRef.current.setLatLng(r.puntos[idx]);
          setPosIdx(idx);
          setSimulando(false);
          setLlegada(true);
          hablar("Has llegado al destino final");
          return;
        }

        avatarRef.current.setLatLng(r.puntos[idx]);
        rotarAvatar(avatarRef.current, calcularBearing(r.puntos[idx], r.puntos[idx + 1]));
        setPosIdx(idx);

        // El mapa sigue al avatar mientras el usuario no lo haya movido
        if (seguirRef.current && idx % 15 === 0) {
          mapaRef.current.panTo(r.puntos[idx], {
            animate: true,
            duration: 0.8,
            easeLinearity: 0.4,
          });
        }
      }

      animFrameRef.current = requestAnimationFrame(frame);
    };

    animFrameRef.current = requestAnimationFrame(frame);
  }

  function detenerSimulacion() {
    cancelAnimationFrame(animFrameRef.current);
    setSimulando(false);
    setLlegada(false);
    setPosIdx(0);
    if (avatarRef.current && ruta) avatarRef.current.setLatLng(ruta.puntos[0]);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  function ajustarRuta() {
    seguirRef.current = false;
    setSeguir(false);
    if (boundsRef.current) mapaRef.current?.fitBounds(boundsRef.current);
  }

  function centrarRepartidor() {
    seguirRef.current = true;
    setSeguir(true);
    const pos = avatarRef.current?.getLatLng();
    if (pos) mapaRef.current?.setView(pos, Math.max(mapaRef.current.getZoom(), 16));
  }

  function enfocarParada(k: number) {
    setSeleccion(k);
    seguirRef.current = false;
    setSeguir(false);
    mapaRef.current?.setView(stops[k].coords, Math.max(mapaRef.current.getZoom(), 16));
  }

  // Asa del bottom sheet: tap/teclado alternan (onClick); un swipe vertical abre o cierra
  function onAsaPointerDown(e: React.PointerEvent) {
    swipeYRef.current = e.clientY;
    swipeHechoRef.current = false;
  }
  function onAsaPointerUp(e: React.PointerEvent) {
    const inicio = swipeYRef.current;
    swipeYRef.current = null;
    if (inicio === null) return;
    const dy = e.clientY - inicio;
    if (Math.abs(dy) <= 24) return;
    swipeHechoRef.current = true;
    setPanelAbierto(dy < 0);
  }
  function onAsaClick() {
    // Tras un swipe el navegador también emite click: no volver a alternar
    if (swipeHechoRef.current) {
      swipeHechoRef.current = false;
      return;
    }
    setPanelAbierto((v) => !v);
  }

  const top = pantallaCompleta ? "calc(env(safe-area-inset-top) + 0.75rem)" : "0.75rem";
  const paradaSel = seleccion !== null ? stops[seleccion] : null;
  const calleProximo = proximo
    ? proximo.tipo === "arrive"
      ? (stops[proximo.tramo + 1]?.sublabel ?? "")
      : proximo.calle
    : "";

  return (
    <div
      ref={raizRef}
      className={`isolate flex flex-col overflow-hidden lg:flex-row ${
        pantallaCompleta
          ? "fixed inset-0 z-1100 bg-background"
          : `relative rounded-xl border border-border ${className}`
      }`}
      style={{ height: alturaCss(altura, pantallaCompleta) }}
    >
      {/* ── Mapa ── */}
      <div className="relative h-full min-w-0 flex-1">
        {/* Maniobra actual (overlay superior) */}
        {simulando && proximo && (
          <div
            className="absolute left-3 right-[4.25rem] z-1001 overflow-hidden rounded-2xl bg-coal text-cream shadow-lg"
            style={{ top }}
          >
            <div className="flex items-center gap-3 px-3 py-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
                <IconoManiobra paso={proximo} className="h-7 w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-2xl font-bold leading-none tabular-nums">
                  {formatDist(distProximo)}
                </p>
                <p className="mt-1 text-[15px] font-semibold leading-tight">
                  {accionPaso(proximo, totalParadas)}
                </p>
                {calleProximo && (
                  <p className="break-words text-sm leading-snug text-cream/75">{calleProximo}</p>
                )}
              </div>
            </div>
            {despues && (
              <div className="flex items-center gap-2 border-t border-white/10 bg-black/25 px-3 py-1.5 text-xs">
                <span className="text-cream/65">Después</span>
                <IconoManiobra paso={despues} className="h-4 w-4 shrink-0" />
                <span className="min-w-0 truncate font-medium">
                  {accionPaso(despues, totalParadas)}
                </span>
              </div>
            )}
          </div>
        )}
        {/* Anuncio accesible: solo cambia con cada maniobra, no con la distancia */}
        <p className="sr-only" aria-live="polite">
          {simulando && proximo ? `${accionPaso(proximo, totalParadas)} ${calleProximo}` : ""}
          {llegada ? "Llegada al destino final. Todas las paradas completadas." : ""}
        </p>

        {llegada && (
          <div
            className="absolute left-3 right-[4.25rem] z-1001 flex items-center gap-3 rounded-2xl bg-green-700/95 px-4 py-3 text-white shadow-lg"
            style={{ top }}
          >
            <Flag className="h-6 w-6 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold">¡Llegada al destino!</p>
              <p className="text-xs opacity-85">Todas las paradas completadas.</p>
            </div>
          </div>
        )}

        {estado === "cargando" && <OverlayCarga texto="Trazando ruta…" />}

        {estado === "sin-ruta" && (
          <div
            className="absolute left-3 right-[4.25rem] z-1000 rounded-lg bg-card/95 px-3 py-2 text-xs text-muted-foreground shadow"
            style={{ top }}
          >
            Ruta aproximada — servicio de calles no disponible
          </div>
        )}

        {estado !== "cargando" && (
          <ControlesMapa
            mapaRef={mapaRef}
            top={top}
            onAjustar={ajustarRuta}
            onCentrar={ruta ? centrarRepartidor : undefined}
            centrado={simulando && seguir}
            pantallaCompleta={pantallaCompleta}
            onPantallaCompleta={() => setPantallaCompleta((v) => !v)}
          />
        )}

        <div
          ref={contenedorRef}
          className="h-full w-full"
          role="region"
          aria-label="Mapa de la ruta de reparto"
        />
      </div>

      {/* ── Panel: bottom sheet en móvil/tablet, lateral en desktop ── */}
      {estado !== "cargando" && (
        <section
          aria-label="Panel de navegación"
          className={`akr-sheet absolute inset-x-0 bottom-0 z-1001 flex flex-col rounded-t-2xl bg-card shadow-[0_-10px_30px_-12px_rgb(0_0_0/0.35)] lg:static lg:z-auto lg:max-h-none lg:w-80 lg:shrink-0 lg:rounded-none lg:border-l lg:border-border lg:shadow-none xl:w-96 ${
            panelAbierto ? "max-h-[68%]" : "max-h-[60%]"
          } ${pantallaCompleta ? "pb-safe-3 lg:pb-0" : ""}`}
        >
          {/* Asa (solo móvil/tablet) */}
          <button
            type="button"
            aria-expanded={panelAbierto}
            aria-label={panelAbierto ? "Contraer panel de ruta" : "Expandir panel de ruta"}
            onPointerDown={onAsaPointerDown}
            onPointerUp={onAsaPointerUp}
            onClick={onAsaClick}
            className="flex h-7 min-h-7 w-full shrink-0 touch-none items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring lg:hidden"
          >
            <span className="h-1.5 w-10 rounded-full bg-muted-foreground/35" />
          </button>

          {/* Resumen de la ruta (siempre visible) */}
          <div className="flex shrink-0 items-center gap-3 px-4 pb-3 lg:border-b lg:border-border lg:pt-4">
            <div className="min-w-0 flex-1">
              {enCurso && ruta ? (
                <>
                  <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="whitespace-nowrap text-2xl font-bold leading-none tabular-nums text-accent">
                      {restanteMin} min
                    </span>
                    <span className="whitespace-nowrap text-sm font-medium tabular-nums text-muted-foreground">
                      {formatDist(restanteM)}
                    </span>
                  </p>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">
                    {llegada
                      ? `${totalParadas - 1} de ${totalParadas - 1} paradas completadas`
                      : `Parada ${paradaSiguiente} de ${totalParadas - 1}`}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold">
                    {totalParadas - 1} parada{totalParadas - 1 !== 1 ? "s" : ""}
                  </p>
                  <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                    {ruta
                      ? `${formatDist(ruta.distancia)} por calles · ${Math.max(1, Math.round(ruta.duracion / 60))} min`
                      : "Ruta aproximada en línea recta"}
                  </p>
                </>
              )}
            </div>
            {ruta && (
              <button
                type="button"
                onClick={() => setVozActiva((v) => !v)}
                aria-label={
                  vozActiva ? "Silenciar instrucciones de voz" : "Activar instrucciones de voz"
                }
                aria-pressed={vozActiva}
                title={vozActiva ? "Silenciar voz" : "Activar voz"}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {vozActiva ? (
                  <Volume2 className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <VolumeX className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            )}
            {ruta &&
              (simulando ? (
                <button
                  type="button"
                  onClick={detenerSimulacion}
                  className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-destructive px-4 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                  Detener
                </button>
              ) : (
                <button
                  type="button"
                  onClick={iniciarSimulacion}
                  className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Navigation2 className="h-4 w-4" aria-hidden="true" />
                  {llegada ? "Reiniciar" : "Iniciar"}
                </button>
              ))}
          </div>

          {/* Parada seleccionada en el mapa */}
          {paradaSel && seleccion !== null && (
            <div className="mx-3 mb-3 shrink-0 rounded-xl border border-border bg-background p-3 lg:mt-3">
              <div className="flex items-start gap-3">
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${VARIANTE_BG[varianteParada(seleccion)]}`}
                >
                  {paradaSel.label}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    {seleccion === 0
                      ? "Punto de partida"
                      : `Parada ${seleccion} de ${totalParadas - 1}`}
                    {" · "}
                    {VARIANTE_TEXTO[varianteParada(seleccion)]}
                  </p>
                  <p className="break-words font-semibold leading-tight">
                    {paradaSel.sublabel ?? `Parada ${seleccion}`}
                  </p>
                  {paradaSel.direccion && (
                    <p className="mt-0.5 break-words text-sm text-muted-foreground">
                      {paradaSel.direccion}
                    </p>
                  )}
                  {(paradaSel.estadoPedido || paradaSel.eta) && (
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      {paradaSel.estadoPedido && (
                        <span className="rounded-md bg-secondary px-2 py-0.5 font-medium">
                          {paradaSel.estadoPedido}
                        </span>
                      )}
                      {paradaSel.eta && (
                        <span className="font-semibold text-accent">{paradaSel.eta}</span>
                      )}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSeleccion(null)}
                  aria-label="Cerrar detalle de parada"
                  className="-mr-1 -mt-1 grid h-9 min-h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              {seleccion > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {paradaSel.href ? (
                    <a
                      href={paradaSel.href}
                      className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-card text-sm font-semibold transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Ver pedido
                    </a>
                  ) : (
                    <span />
                  )}
                  <a
                    href={urlNavegar(paradaSel.coords)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg bg-accent text-sm font-semibold text-accent-foreground transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Navigation2 className="h-4 w-4" aria-hidden="true" />
                    Navegar
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Pestañas + listas (expandido en móvil; siempre en desktop) */}
          <div
            className={`${panelAbierto ? "flex" : "hidden"} min-h-0 flex-1 flex-col border-t border-border lg:flex`}
          >
            <div role="tablist" aria-label="Detalle de la ruta" className="flex shrink-0 gap-1 p-2">
              {(
                [
                  ["paradas", `Paradas (${totalParadas - 1})`],
                  ["indicaciones", "Indicaciones"],
                ] as const
              ).map(([id, texto]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={pestana === id}
                  disabled={id === "indicaciones" && !ruta}
                  onClick={() => setPestana(id)}
                  className={`h-10 min-h-10 flex-1 rounded-lg text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 ${
                    pestana === id
                      ? "bg-accent/15 text-accent"
                      : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {texto}
                </button>
              ))}
            </div>

            <ol
              ref={listaRef}
              className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-2 pb-2"
            >
              {pestana === "paradas" || !ruta
                ? stops.map((s, k) => {
                    const v = varianteParada(k);
                    return (
                      <li key={k}>
                        <button
                          type="button"
                          onClick={() => enfocarParada(k)}
                          className={`flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            v === "current" ? "bg-accent/10" : ""
                          } ${seleccion === k ? "ring-1 ring-accent/40" : ""}`}
                        >
                          <span
                            className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${VARIANTE_BG[v]}`}
                          >
                            {s.label}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline justify-between gap-2">
                              <span
                                className={`min-w-0 break-words text-sm font-medium ${v === "done" ? "text-muted-foreground line-through decoration-1" : ""}`}
                              >
                                {s.sublabel ?? (k === 0 ? "Punto de partida" : `Parada ${k}`)}
                              </span>
                              {s.eta && (
                                <span className="shrink-0 text-xs font-semibold tabular-nums text-accent">
                                  {s.eta}
                                </span>
                              )}
                            </span>
                            {s.direccion && (
                              <span className="mt-0.5 block break-words text-xs text-muted-foreground">
                                {s.direccion}
                              </span>
                            )}
                            <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                              <span
                                className={
                                  v === "current"
                                    ? "font-semibold text-accent"
                                    : v === "done"
                                      ? "font-medium text-green-700 dark:text-green-400"
                                      : "text-muted-foreground"
                                }
                              >
                                {VARIANTE_TEXTO[v]}
                              </span>
                              {s.estadoPedido && (
                                <span className="rounded bg-secondary px-1.5 py-0.5 font-medium">
                                  {s.estadoPedido}
                                </span>
                              )}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })
                : ruta.pasos.map((p, i) => {
                    const pasado = simulando && i <= pasoIdx;
                    const actual = simulando && i === pasoIdx + 1;
                    const nuevoTramo = i === 0 || ruta.pasos[i - 1].tramo !== p.tramo;
                    return (
                      <li key={i} data-actual={actual ? "true" : undefined}>
                        {nuevoTramo && (
                          <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Hacia parada {p.tramo + 1}
                            {stops[p.tramo + 1]?.sublabel
                              ? ` · ${stops[p.tramo + 1].sublabel}`
                              : ""}
                          </p>
                        )}
                        <div
                          className={`flex items-center gap-3 rounded-lg px-2 py-2 ${
                            actual
                              ? "bg-accent/15 ring-1 ring-accent/30"
                              : pasado
                                ? "opacity-45"
                                : ""
                          }`}
                        >
                          <span
                            className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                              actual ? "bg-accent text-accent-foreground" : "bg-secondary"
                            }`}
                          >
                            <IconoManiobra paso={p} className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={`block text-sm leading-tight ${actual ? "font-semibold" : "font-medium"}`}
                            >
                              {accionPaso(p, totalParadas)}
                            </span>
                            {p.calle && p.tipo !== "arrive" && (
                              <span className="block break-words text-xs text-muted-foreground">
                                {p.calle}
                              </span>
                            )}
                          </span>
                          {p.distancia > 0 && p.tipo !== "arrive" && (
                            <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                              {formatDist(p.distancia)}
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
            </ol>
            <p className="shrink-0 px-4 pb-2 text-[10px] text-muted-foreground/80">
              Mapa © Esri, HERE, Garmin · © OpenStreetMap contributors
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** SVG del avatar repartidor; la rotación se aplica sobre .akr-avatar */
function svgRepartidor(bearing: number): string {
  return `
    <div class="akr-avatar" style="
      transform: rotate(${bearing}deg);
      transform-origin: center center;
      width: 44px;
      height: 44px;
      filter: drop-shadow(0 3px 6px rgba(0,0,0,0.5));
    ">
      <svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg" width="44" height="44">
        <!-- Sombra base -->
        <ellipse cx="22" cy="41" rx="9" ry="3" fill="rgba(0,0,0,0.18)"/>
        <!-- Moto / scooter -->
        <ellipse cx="22" cy="34" rx="12" ry="5" fill="#1e40af"/>
        <ellipse cx="13" cy="34" rx="4" ry="4" fill="#1e3a8a" stroke="#fff" stroke-width="1.5"/>
        <ellipse cx="31" cy="34" rx="4" ry="4" fill="#1e3a8a" stroke="#fff" stroke-width="1.5"/>
        <!-- Chasis -->
        <rect x="14" y="29" width="16" height="7" rx="3" fill="#2563eb"/>
        <!-- Cuerpo del repartidor -->
        <rect x="15" y="17" width="14" height="14" rx="4" fill="#1d4ed8"/>
        <!-- Mochila de entrega (naranja) -->
        <rect x="26" y="18" width="7" height="10" rx="2" fill="#f59e0b" stroke="#d97706" stroke-width="1"/>
        <line x1="29" y1="18" x2="29" y2="28" stroke="#d97706" stroke-width="0.8"/>
        <!-- Cabeza con casco -->
        <circle cx="22" cy="13" r="7" fill="#f59e0b"/>
        <path d="M15.5 12 Q22 5 28.5 12" fill="#1e3a8a" stroke="#1e40af" stroke-width="0.5"/>
        <!-- Visera del casco -->
        <path d="M16.5 13 Q22 10 27.5 13" fill="none" stroke="#60a5fa" stroke-width="1.5" stroke-linecap="round"/>
        <!-- Punto de dirección (flecha arriba) -->
        <polygon points="22,2 19,7 25,7" fill="#f59e0b"/>
      </svg>
    </div>
  `;
}

function crearAvatarRepartidor(L: any, bearing: number) {
  return L.divIcon({
    html: svgRepartidor(bearing),
    className: "",
    iconSize: [44, 44],
    iconAnchor: [22, 38],
    popupAnchor: [0, -42],
  });
}

/** Rota el avatar sin recrear el icono (evita reconstruir el DOM en cada frame). */
function rotarAvatar(marker: any, bearing: number) {
  const el: HTMLElement | null = marker.getElement?.()?.querySelector(".akr-avatar") ?? null;
  if (el) el.style.transform = `rotate(${bearing}deg)`;
}

/** Distancia en metros entre dos Coords */
function distanciaM(a: Coords, b: Coords): number {
  const R = 6371000;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const c =
    sinDLat * sinDLat +
    Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * sinDLng * sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}
