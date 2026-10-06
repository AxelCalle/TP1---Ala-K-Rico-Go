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
  CheckCircle2,
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
  Play,
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
  /** índice del tramo (leg) dentro de esta ruta calculada */
  tramo: number;
  /** índice absoluto (en `stops`) de la parada a la que lleva este tramo */
  parada: number;
  /** primer tramo desde el local (no desde un recálculo en camino) */
  esSalida: boolean;
  /** índice del punto de la polilínea donde ocurre la maniobra */
  polyIdx: number;
}

interface RutaCalculada {
  puntos: Coords[];
  /** distancia acumulada (m) hasta cada punto de la polilínea */
  acum: number[];
  pasos: Paso[];
  /** polyIdx de llegada a cada parada, empezando por `paradaInicial` */
  llegadaParada: number[];
  /** índice en `stops` de la primera parada de esta ruta (1, o más tras recalcular) */
  paradaInicial: number;
  distancia: number;
  duracion: number;
}

/**
 * Ruta por calles entre `coords` (OSRM). `paradaInicial` indica a qué parada
 * de `stops` lleva el primer tramo: 1 desde el local, k al recalcular en camino.
 */
async function obtenerRutaMulti(
  coords: Coords[],
  paradaInicial = 1,
): Promise<RutaCalculada | null> {
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
          parada: paradaInicial + tramo,
          esSalida: tramo === 0 && paradaInicial === 1,
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
      paradaInicial,
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
      return p.esSalida ? "Sal del punto de partida" : `Continúa hacia la parada ${p.parada}`;
    case "arrive":
      return p.parada >= totalParadas - 1
        ? "Llegada al destino final"
        : `Llegada a la parada ${p.parada}`;
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

/** Metros desde el punto `posIdx` de la polilínea hasta la maniobra `paso`. */
function distanciaHasta(ruta: RutaCalculada, paso: Paso, posIdx: number): number {
  return Math.max(0, ruta.acum[paso.polyIdx] - ruta.acum[posIdx]);
}

/**
 * Ajusta una posición GPS a la ruta: devuelve el punto más cercano sobre la
 * polilínea, su índice y la distancia (m). Con `desde`, busca solo cerca de la
 * posición anterior (algo hacia atrás por el ruido del GPS, bastante hacia
 * adelante) para que una calle que se recorre dos veces no haga saltar el avance.
 */
function ajustarARuta(
  ruta: RutaCalculada,
  pos: Coords,
  desde: number | null,
): { idx: number; dist: number; punto: Coords } {
  const pts = ruta.puntos;
  const ini = desde === null ? 0 : Math.max(0, desde - 30);
  const fin = desde === null ? pts.length - 1 : Math.min(pts.length - 1, desde + 600);
  // Proyección equirectangular local en metros (precisa a escala de ciudad)
  const kLat = 111320;
  const kLng = 111320 * Math.cos((pos[0] * Math.PI) / 180);
  const aXY = (c: Coords): [number, number] => [(c[1] - pos[1]) * kLng, (c[0] - pos[0]) * kLat];

  let mejor = { idx: ini, dist: Infinity, punto: pts[ini] };
  for (let i = ini; i < Math.max(fin, ini + 1) && i < pts.length - 1; i++) {
    const [ax, ay] = aXY(pts[i]);
    const [bx, by] = aXY(pts[i + 1]);
    const dx = bx - ax;
    const dy = by - ay;
    const largo2 = dx * dx + dy * dy;
    const t = largo2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / largo2));
    const px = ax + t * dx;
    const py = ay + t * dy;
    const dist = Math.hypot(px, py);
    if (dist < mejor.dist) {
      mejor = {
        idx: t > 0.5 ? i + 1 : i,
        dist,
        punto: [
          pts[i][0] + t * (pts[i + 1][0] - pts[i][0]),
          pts[i][1] + t * (pts[i + 1][1] - pts[i][1]),
        ],
      };
    }
  }
  return mejor;
}

/** Frase hablada: "En 300 metros, gira a la derecha en Av. Perú". */
function fraseManiobra(p: Paso, distancia: number, totalParadas: number): string {
  const accion = accionPaso(p, totalParadas);
  const calle = p.calle && p.tipo !== "arrive" ? ` en ${p.calle}` : "";
  if (distancia <= 30) return `${accion}${calle}`;
  const dist =
    distancia < 1000
      ? `${Math.round(distancia / 10) * 10} metros`
      : `${(distancia / 1000).toFixed(1).replace(".", ",")} kilómetros`;
  return `En ${dist}, ${accion.charAt(0).toLowerCase()}${accion.slice(1)}${calle}`;
}

/** Mejor voz en español disponible (Perú → Latinoamérica → cualquier español). */
function vozEspanol(voces: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const preferidas = ["es-PE", "es-419", "es-MX", "es-US", "es-CO", "es-AR", "es-ES"];
  const norm = (l: string) => l.replace("_", "-").toLowerCase();
  for (const lang of preferidas) {
    const v = voces.find((x) => norm(x.lang) === lang.toLowerCase());
    if (v) return v;
  }
  return voces.find((x) => norm(x.lang).startsWith("es")) ?? null;
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
  /** Id del pedido de esta parada (para confirmar la entrega desde la ruta) */
  pedidoId?: number;
}

interface MultiProps {
  stops: MultiStop[];
  /** px o cualquier valor CSS de altura (p.ej. "clamp(420px, 72svh, 760px)") */
  altura?: number | string;
  className?: string;
  /** Se llama con cada posición GPS real (modo "Navegar con GPS"). */
  onUbicacion?: (lat: number, lng: number, precisionM: number) => void;
  /**
   * Si se pasa, la navegación se detiene en cada parada hasta que el repartidor
   * confirme la entrega (se llama con el índice de la parada en `stops`).
   */
  onEntregar?: (indiceParada: number) => Promise<void>;
}

type PestanaPanel = "indicaciones" | "paradas";

/** "gps": posición real del teléfono. "simulacion": recorrido animado (demostraciones). */
type ModoNavegacion = "gps" | "simulacion";

type EstadoGps =
  | { estado: "buscando"; mensaje?: string }
  | { estado: "ok" | "fuera" | "recalculando"; precision: number }
  | { estado: "error"; mensaje: string };

/**
 * Mapa de ruta multi-parada con Leaflet.
 * - Pins numerados con estado (origen, pendiente, siguiente, completada, destino).
 * - Ruta real por calles (OSRM). Dos modos: navegación con el GPS del
 *   teléfono (ajuste a la ruta + recálculo si te desvías) o simulación
 *   animada para demostraciones.
 * - Navegación tipo app: maniobra actual con icono + distancia, "después",
 *   resumen restante y lista de indicaciones/paradas.
 * - Desktop: panel lateral. Móvil/tablet: bottom sheet sobre el mapa.
 * - stops[0] es siempre el depot (punto de origen).
 */
export function MapaRutaMulti({
  stops,
  altura = 400,
  className = "",
  onUbicacion,
  onEntregar,
}: MultiProps) {
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
  const rutaLayersRef = useRef<any[]>([]);
  const rutaRef = useRef<RutaCalculada | null>(null);
  const rutaOriginalRef = useRef<RutaCalculada | null>(null);
  const stopsRef = useRef(stops);
  stopsRef.current = stops;
  const onUbicacionRef = useRef(onUbicacion);
  onUbicacionRef.current = onUbicacion;
  // GPS
  const modoRef = useRef<ModoNavegacion | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const precisionCirculoRef = useRef<any>(null);
  const primerFixRef = useRef(true);
  const fueraDeRutaRef = useRef(0);
  const ultimoRecalculoRef = useRef(0);
  const wakeLockRef = useRef<any>(null);
  /** distancia (m) a la que se anunció cada maniobra, para el recordatorio cercano */
  const anunciadaARef = useRef(new Map<number, number>());

  const [estado, setEstado] = useState<Estado>("cargando");
  const [ruta, setRuta] = useState<RutaCalculada | null>(null);
  const [navegando, setNavegando] = useState(false);
  const [modo, setModo] = useState<ModoNavegacion | null>(null);
  const [gps, setGps] = useState<EstadoGps | null>(null);
  // Confirmación de entrega en cada parada
  const onEntregarRef = useRef(onEntregar);
  onEntregarRef.current = onEntregar;
  const esperandoRef = useRef<number | null>(null);
  const entregadasRef = useRef(new Set<number>());
  const [esperando, setEsperando] = useState<number | null>(null);
  const [entregando, setEntregando] = useState(false);
  const [errorEntrega, setErrorEntrega] = useState<string | null>(null);
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

  // ── Voz ─────────────────────────────────────────────────────────────────────
  // Nunca se corta una frase a la mitad: si llega otra indicación mientras se
  // habla, queda en espera (solo la más reciente) y se dice al terminar. La
  // simulación se detiene mientras habla (ver iniciarSimulacion).
  const vozActivaRef = useRef(vozActiva);
  const hablandoRef = useRef(false);
  const pendienteRef = useRef<(() => string) | null>(null);
  const seguroVozRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const posIdxRef = useRef(0);

  const decir = useCallback((texto: string) => {
    if (!("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    const utt = new SpeechSynthesisUtterance(texto);
    utt.lang = "es-PE";
    const voz = vozEspanol(synth.getVoices());
    if (voz) utt.voice = voz;
    utt.rate = 0.95;
    utt.pitch = 1;

    const terminar = () => {
      if (seguroVozRef.current) clearTimeout(seguroVozRef.current);
      seguroVozRef.current = null;
      if (!hablandoRef.current) return;
      hablandoRef.current = false;
      const siguiente = pendienteRef.current;
      pendienteRef.current = null;
      if (siguiente && vozActivaRef.current) {
        hablandoRef.current = true;
        decirRef.current(siguiente());
      }
    };
    utt.onend = terminar;
    utt.onerror = terminar;
    // Algunos navegadores no disparan onend: liberar la cola por tiempo estimado
    if (seguroVozRef.current) clearTimeout(seguroVozRef.current);
    seguroVozRef.current = setTimeout(terminar, 2500 + texto.length * 110);

    hablandoRef.current = true;
    synth.speak(utt);
  }, []);
  const decirRef = useRef(decir);

  /** Encola una frase; `texto` se evalúa al momento de decirla (distancias frescas). */
  const hablar = useCallback(
    (texto: string | (() => string)) => {
      if (!vozActivaRef.current || !("speechSynthesis" in window)) return;
      const crear = typeof texto === "string" ? () => texto : texto;
      try {
        if (hablandoRef.current) pendienteRef.current = crear;
        else decir(crear());
      } catch {
        hablandoRef.current = false; /* no crítico */
      }
    },
    [decir],
  );

  const callarVoz = useCallback(() => {
    pendienteRef.current = null;
    hablandoRef.current = false;
    if (seguroVozRef.current) clearTimeout(seguroVozRef.current);
    seguroVozRef.current = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  useEffect(() => {
    vozActivaRef.current = vozActiva;
    if (!vozActiva) callarVoz();
  }, [vozActiva, callarVoz]);

  // Las voces del sistema cargan de forma asíncrona en Chrome/Android
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.getVoices();
  }, []);

  // ── Montar el mapa ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!contenedorRef.current || stops.length < 2) return;
    let activo = true;
    setEstado("cargando");
    setRuta(null);
    setNavegando(false);
    setLlegada(false);
    setPosIdx(0);
    setSeleccion(null);
    esperandoRef.current = null;
    entregadasRef.current = new Set();
    setEsperando(null);
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
        dibujarRuta(calculada);
        rutaOriginalRef.current = calculada;
        boundsRef.current = L.latLngBounds(calculada.puntos).pad(0.12);

        const avatar = L.marker(calculada.puntos[0], {
          icon: crearAvatarRepartidor(L, 0),
          zIndexOffset: 1000,
          interactive: false,
        }).addTo(mapa);
        avatarRef.current = avatar;

        rutaRef.current = calculada;
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
      callarVoz();
      liberarGps();
      markersRef.current = [];
      rutaLayersRef.current = [];
      precisionCirculoRef.current = null;
      avatarRef.current = null;
      if (mapaRef.current) {
        mapaRef.current.remove();
        mapaRef.current = null;
      }
    };
  }, [stops, callarVoz]);

  // ── Progreso derivado de la posición del avatar ────────────────────────────
  const enCurso = navegando || llegada;
  const totalParadas = stops.length;
  let pasoIdx = 0;
  if (ruta && enCurso) {
    for (let i = 0; i < ruta.pasos.length; i++) {
      if (ruta.pasos[i].polyIdx <= posIdx) pasoIdx = i;
      else break;
    }
  }
  const proximo = ruta && navegando ? (ruta.pasos[pasoIdx + 1] ?? null) : null;
  const despues = ruta && navegando ? (ruta.pasos[pasoIdx + 2] ?? null) : null;
  const distProximo = ruta && proximo ? ruta.acum[proximo.polyIdx] - ruta.acum[posIdx] : 0;
  const restanteM = ruta
    ? ruta.distancia * (1 - ruta.acum[posIdx] / ruta.acum[ruta.acum.length - 1])
    : 0;
  const restanteMin = ruta
    ? Math.max(llegada ? 0 : 1, Math.round((ruta.duracion * (restanteM / ruta.distancia)) / 60))
    : 0;
  const completadas =
    ruta && enCurso
      ? ruta.paradaInicial - 1 + ruta.llegadaParada.filter((pi) => pi <= posIdx).length
      : 0;
  const paradaSiguiente = Math.min(completadas + 1, totalParadas - 1);

  const varianteParada = useCallback(
    (k: number): Variante => {
      if (k === 0) return "origin";
      if (entregadasRef.current.has(k)) return "done";
      if (enCurso && k <= completadas) return "done";
      if (navegando && k === completadas + 1) return "current";
      return k === totalParadas - 1 ? "dest" : "pending";
    },
    // esperando: re-evalúa tras confirmar una entrega (entregadasRef)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enCurso, navegando, completadas, totalParadas, esperando],
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
  const gpsConFix = modo !== "gps" || gps?.estado === "ok";
  useEffect(() => {
    if (!navegando || !ruta || !gpsConFix || pasoIdx === ultimoAnunciadoRef.current) return;
    ultimoAnunciadoRef.current = pasoIdx;
    const k = pasoIdx + 1;
    const prox = ruta.pasos[k];
    if (!prox) return;
    anunciadaARef.current.set(k, distanciaHasta(ruta, prox, posIdxRef.current));
    // La distancia se calcula al momento de hablar, no al encolar
    hablar(() => fraseManiobra(prox, distanciaHasta(ruta, prox, posIdxRef.current), totalParadas));
  }, [navegando, ruta, gpsConFix, pasoIdx, totalParadas, hablar]);

  // GPS: si la maniobra se anunció lejos, recordarla al acercarse (~100 m)
  useEffect(() => {
    if (modo !== "gps" || !navegando || !ruta || !proximo) return;
    const k = pasoIdx + 1;
    const lejos = anunciadaARef.current.get(k);
    if (lejos === undefined || lejos < 250 || distProximo > 110 || distProximo < 20) return;
    anunciadaARef.current.set(k, 0);
    hablar(() =>
      fraseManiobra(proximo, distanciaHasta(ruta, proximo, posIdxRef.current), totalParadas),
    );
  }, [modo, navegando, ruta, proximo, pasoIdx, distProximo, totalParadas, hablar]);

  // ── Mantener visible la indicación actual en la lista ─────────────────────
  useEffect(() => {
    if (!navegando || pestana !== "indicaciones") return;
    const el = listaRef.current?.querySelector<HTMLElement>("[data-actual='true']");
    el?.scrollIntoView({ block: "nearest" });
  }, [pasoIdx, navegando, pestana]);

  // ── Animación del avatar a lo largo de la ruta ─────────────────────────────
  function iniciarSimulacion() {
    const mapa = mapaRef.current;
    if (!rutaOriginalRef.current || !avatarRef.current || !mapa) return;
    detenerNavegacion();
    const r = rutaOriginalRef.current;
    modoRef.current = "simulacion";
    setModo("simulacion");

    // Se anuncia aquí (dentro del toque del usuario): iOS solo permite voz tras un gesto
    ultimoAnunciadoRef.current = 0;
    posIdxRef.current = 0;
    const primero = r.pasos[1];
    hablar(
      primero
        ? `Iniciando recorrido. ${fraseManiobra(primero, distanciaHasta(r, primero, 0), totalParadas)}`
        : "Iniciando recorrido",
    );
    seguirRef.current = true;
    setSeguir(true);
    setNavegando(true);
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
      // Espera mientras la voz habla (indicación completa) o mientras se confirma una entrega
      if ((vozActivaRef.current && hablandoRef.current) || esperandoRef.current !== null) {
        animFrameRef.current = requestAnimationFrame(frame);
        return;
      }
      frameCount++;

      if (frameCount % FRAMES_POR_PUNTO === 0) {
        idx++;

        // Llegó a una parada: se detiene hasta que el repartidor confirme la entrega
        if (revisarLlegadaParada(r, Math.min(idx, r.puntos.length - 1))) {
          idx = Math.min(idx, r.puntos.length - 1);
          avatarRef.current.setLatLng(r.puntos[idx]);
          posIdxRef.current = idx;
          setPosIdx(idx);
          animFrameRef.current = requestAnimationFrame(frame);
          return;
        }

        if (idx >= r.puntos.length - 1) {
          idx = r.puntos.length - 1;
          avatarRef.current.setLatLng(r.puntos[idx]);
          setPosIdx(idx);
          setNavegando(false);
          setLlegada(true);
          hablar("Has llegado al destino final");
          return;
        }

        avatarRef.current.setLatLng(r.puntos[idx]);
        rotarAvatar(avatarRef.current, calcularBearing(r.puntos[idx], r.puntos[idx + 1]));
        posIdxRef.current = idx;
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

  /** Detiene la navegación (GPS o simulación) y deja la ruta original como al inicio. */
  function detenerNavegacion(conservarErrorGps = false) {
    cancelAnimationFrame(animFrameRef.current);
    esperandoRef.current = null;
    setEsperando(null);
    setErrorEntrega(null);
    liberarGps();
    callarVoz();
    modoRef.current = null;
    setModo(null);
    if (!conservarErrorGps) setGps(null);
    setNavegando(false);
    setLlegada(false);
    setPosIdx(0);
    posIdxRef.current = 0;
    anunciadaARef.current.clear();
    const original = rutaOriginalRef.current;
    if (original && rutaRef.current !== original) {
      dibujarRuta(original);
      rutaRef.current = original;
      setRuta(original);
    }
    if (avatarRef.current && original) {
      avatarRef.current.setLatLng(original.puntos[0]);
      rotarAvatar(avatarRef.current, 0);
    }
  }

  /** Dibuja (o reemplaza) la polilínea de la ruta. */
  function dibujarRuta(r: RutaCalculada) {
    const L = leafletRef.current;
    const mapa = mapaRef.current;
    if (!L || !mapa) return;
    rutaLayersRef.current.forEach((capa) => capa.remove());
    rutaLayersRef.current = [
      L.polyline(r.puntos, { color: "#ffffff", weight: 9, opacity: 0.6 }).addTo(mapa),
      L.polyline(r.puntos, { color: "#ea580c", weight: 5, opacity: 0.95 }).addTo(mapa),
    ];
  }

  /** Corta el seguimiento GPS, el wake lock y el círculo de precisión. */
  function liberarGps() {
    if (watchIdRef.current !== null && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
    wakeLockRef.current?.release?.().catch(() => {});
    wakeLockRef.current = null;
    precisionCirculoRef.current?.remove();
    precisionCirculoRef.current = null;
  }

  async function pedirPantallaEncendida() {
    try {
      const wl = (navigator as any).wakeLock;
      if (wl) wakeLockRef.current = await wl.request("screen");
    } catch {
      /* no soportado o denegado: no es crítico */
    }
  }

  // El wake lock se pierde al cambiar de app: se pide de nuevo al volver
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && modoRef.current === "gps") {
        pedirPantallaEncendida();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // ── Navegación con el GPS del teléfono ─────────────────────────────────────
  function iniciarGps() {
    if (!rutaOriginalRef.current || !avatarRef.current || !mapaRef.current) return;
    if (!("geolocation" in navigator)) {
      setGps({ estado: "error", mensaje: "Este navegador no permite usar el GPS." });
      return;
    }
    if (!window.isSecureContext) {
      setGps({ estado: "error", mensaje: "El GPS requiere abrir la app con HTTPS." });
      return;
    }
    detenerNavegacion();
    // Dentro del toque del usuario: desbloquea la voz en iOS
    hablar("Iniciando navegación");

    modoRef.current = "gps";
    setModo("gps");
    setGps({ estado: "buscando" });
    primerFixRef.current = true;
    fueraDeRutaRef.current = 0;
    ultimoAnunciadoRef.current = -1;
    seguirRef.current = true;
    setSeguir(true);
    setNavegando(true);
    setSeleccion(null);
    setPestana("indicaciones");

    watchIdRef.current = navigator.geolocation.watchPosition(onPosicionGps, onErrorGps, {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 20000,
    });
    pedirPantallaEncendida();
  }

  function onErrorGps(e: GeolocationPositionError) {
    if (modoRef.current !== "gps") return;
    if (e.code === e.PERMISSION_DENIED) {
      detenerNavegacion(true);
      setGps({
        estado: "error",
        mensaje:
          "Permiso de ubicación denegado. Actívalo para este sitio en la configuración del navegador.",
      });
      return;
    }
    // Sin señal o timeout: se sigue escuchando
    setGps({ estado: "buscando", mensaje: "Señal GPS débil, buscando…" });
  }

  function onPosicionGps(p: GeolocationPosition) {
    const r = rutaRef.current;
    const L = leafletRef.current;
    const mapa = mapaRef.current;
    const avatar = avatarRef.current;
    if (modoRef.current !== "gps" || !r || !L || !mapa || !avatar) return;

    const pos: Coords = [p.coords.latitude, p.coords.longitude];
    const precision = Math.round(p.coords.accuracy ?? 0);
    onUbicacionRef.current?.(pos[0], pos[1], precision);

    if (!precisionCirculoRef.current) {
      precisionCirculoRef.current = L.circle(pos, {
        radius: precision,
        color: "#2563eb",
        weight: 1,
        fillColor: "#3b82f6",
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(mapa);
    } else {
      precisionCirculoRef.current.setLatLng(pos);
      precisionCirculoRef.current.setRadius(precision);
    }

    // Primer fix: buscar en toda la ruta; después, cerca de la posición anterior
    const ajuste = ajustarARuta(r, pos, primerFixRef.current ? null : posIdxRef.current);
    primerFixRef.current = false;
    const tolerancia = Math.min(80, Math.max(40, precision));

    if (ajuste.dist <= tolerancia) {
      fueraDeRutaRef.current = 0;
      avatar.setLatLng(ajuste.punto);
      const rumbo =
        p.coords.heading != null && !Number.isNaN(p.coords.heading) && (p.coords.speed ?? 0) > 1
          ? p.coords.heading
          : calcularBearing(
              r.puntos[ajuste.idx],
              r.puntos[Math.min(ajuste.idx + 1, r.puntos.length - 1)],
            );
      rotarAvatar(avatar, rumbo);
      posIdxRef.current = ajuste.idx;
      setPosIdx(ajuste.idx);
      setGps({ estado: "ok", precision });
      revisarLlegadaParada(r, ajuste.idx);

      // Llegada: a menos de 25 m del final de la ruta (la última parada)
      if (r.acum[r.acum.length - 1] - r.acum[ajuste.idx] < 25) {
        revisarLlegadaParada(r, r.puntos.length - 1);
        liberarGps();
        setNavegando(false);
        setLlegada(true);
        hablar("Has llegado al destino final");
        return;
      }
    } else {
      // Fuera de la ruta: se muestra la posición real y se recalcula si persiste
      avatar.setLatLng(pos);
      fueraDeRutaRef.current++;
      setGps({ estado: "fuera", precision });
      if (fueraDeRutaRef.current >= 3 && Date.now() - ultimoRecalculoRef.current > 20000) {
        recalcularDesde(pos);
      }
    }

    if (seguirRef.current) {
      mapa.setView(avatar.getLatLng(), Math.max(mapa.getZoom(), 17), { animate: true });
    }
  }

  /** Nueva ruta por calles desde la posición actual hacia las paradas que faltan. */
  async function recalcularDesde(pos: Coords) {
    const r = rutaRef.current;
    if (!r) return;
    ultimoRecalculoRef.current = Date.now();
    setGps((g) => ({ estado: "recalculando", precision: g && "precision" in g ? g.precision : 0 }));

    const hechas =
      r.paradaInicial - 1 + r.llegadaParada.filter((pi) => pi <= posIdxRef.current).length;
    const siguiente = Math.min(hechas + 1, stopsRef.current.length - 1);
    const destinos = stopsRef.current.slice(siguiente).map((s) => s.coords);
    const nueva = await obtenerRutaMulti([pos, ...destinos], siguiente);
    if (!nueva || modoRef.current !== "gps") return;

    dibujarRuta(nueva);
    rutaRef.current = nueva;
    setRuta(nueva);
    posIdxRef.current = 0;
    setPosIdx(0);
    fueraDeRutaRef.current = 0;
    ultimoAnunciadoRef.current = -1;
    anunciadaARef.current.clear();
    setGps((g) => ({ estado: "ok", precision: g && "precision" in g ? g.precision : 0 }));
    hablar("Ruta recalculada");
  }

  /**
   * Si la posición `idx` ya pasó por la llegada de una parada no confirmada,
   * abre la confirmación de entrega. Devuelve true si hay una entrega pendiente.
   */
  function revisarLlegadaParada(r: RutaCalculada, idx: number): boolean {
    if (esperandoRef.current !== null) return true;
    if (!onEntregarRef.current) return false;
    for (let j = 0; j < r.llegadaParada.length; j++) {
      const k = r.paradaInicial + j;
      if (r.llegadaParada[j] <= idx && !entregadasRef.current.has(k)) {
        esperandoRef.current = k;
        setEsperando(k);
        setErrorEntrega(null);
        setPanelAbierto(false);
        const s = stopsRef.current[k];
        hablar(
          `Llegaste a la parada ${k}${s?.sublabel ? `, ${s.sublabel}` : ""}. Confirma la entrega para continuar.`,
        );
        return true;
      }
    }
    return false;
  }

  /** Marca la entrega (o la omite) y retoma la ruta hacia la siguiente parada. */
  async function confirmarEntrega(marcar: boolean) {
    const k = esperandoRef.current;
    if (k === null) return;
    if (marcar && onEntregarRef.current) {
      setEntregando(true);
      setErrorEntrega(null);
      try {
        await onEntregarRef.current(k);
      } catch {
        setErrorEntrega("No se pudo marcar la entrega. Revisa tu conexión e inténtalo de nuevo.");
        setEntregando(false);
        return;
      }
      setEntregando(false);
    }
    entregadasRef.current.add(k);
    esperandoRef.current = null;
    setEsperando(null);
    const siguiente = stopsRef.current[k + 1];
    const destino = siguiente ? (siguiente.sublabel ?? `parada ${k + 1}`) : null;
    hablar(
      marcar
        ? destino
          ? `Pedido entregado. Siguiente parada: ${destino}.`
          : "Pedido entregado. Todas las entregas completadas."
        : destino
          ? `Continuando hacia ${destino}.`
          : "Recorrido completado.",
    );
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
      ? (stops[proximo.parada]?.sublabel ?? "")
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
        {/* GPS: esperando la primera posición */}
        {navegando && modo === "gps" && gps?.estado === "buscando" && (
          <div
            role="status"
            className="absolute left-3 right-[4.25rem] z-1001 flex items-center gap-3 rounded-2xl bg-coal px-4 py-3 text-cream shadow-lg"
            style={{ top }}
          >
            <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Obteniendo tu ubicación…</p>
              <p className="text-xs text-cream/70">
                {gps.mensaje ?? "Permite el acceso a la ubicación si el navegador lo pide."}
              </p>
            </div>
          </div>
        )}

        {/* GPS: error (permiso denegado, sin soporte, sin HTTPS) */}
        {gps?.estado === "error" && (
          <div
            role="alert"
            className="absolute left-3 right-[4.25rem] z-1001 flex items-start gap-3 rounded-2xl bg-destructive px-4 py-3 text-white shadow-lg"
            style={{ top }}
          >
            <MapPin className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p className="min-w-0 flex-1 text-sm font-medium">{gps.mensaje}</p>
            <button
              type="button"
              onClick={() => setGps(null)}
              aria-label="Cerrar aviso de GPS"
              className="-mr-2 -mt-1 grid h-9 min-h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Llegada a una parada: confirmar la entrega antes de seguir */}
        {esperando !== null && stops[esperando] && (
          <div
            role="alertdialog"
            aria-labelledby="titulo-llegada"
            className="absolute left-3 right-[4.25rem] z-1002 rounded-2xl bg-card p-4 shadow-xl ring-2 ring-green-600"
            style={{ top }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">
              Llegaste a la parada {esperando} de {totalParadas - 1}
            </p>
            <p id="titulo-llegada" className="mt-1 break-words text-lg font-semibold leading-tight">
              {stops[esperando].sublabel ?? `Parada ${esperando}`}
            </p>
            {stops[esperando].direccion && (
              <p className="mt-0.5 break-words text-sm text-muted-foreground">
                {stops[esperando].direccion}
              </p>
            )}
            {errorEntrega && (
              <p role="alert" className="mt-2 text-xs font-medium text-destructive">
                {errorEntrega}
              </p>
            )}
            <button
              type="button"
              onClick={() => confirmarEntrega(true)}
              disabled={entregando}
              className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {entregando ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
              )}
              {esperando >= totalParadas - 1
                ? "Pedido entregado · finalizar"
                : "Pedido entregado · ir a la siguiente"}
            </button>
            <button
              type="button"
              onClick={() => confirmarEntrega(false)}
              disabled={entregando}
              className="mt-1 h-10 min-h-10 w-full rounded-lg text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Continuar sin marcar
            </button>
          </div>
        )}

        {/* Maniobra actual (overlay superior) */}
        {navegando &&
          proximo &&
          esperando === null &&
          (modo !== "gps" || (gps && gps.estado !== "buscando")) && (
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
              {modo === "gps" && (gps?.estado === "fuera" || gps?.estado === "recalculando") && (
                <div className="flex items-center gap-2 bg-amber-500 px-3 py-1.5 text-xs font-semibold text-coal">
                  {gps.estado === "recalculando" ? (
                    <>
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-coal border-t-transparent" />
                      Recalculando ruta…
                    </>
                  ) : (
                    "Estás fuera de la ruta"
                  )}
                </div>
              )}
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
          {navegando && proximo ? `${accionPaso(proximo, totalParadas)} ${calleProximo}` : ""}
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
            centrado={navegando && seguir}
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
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-muted-foreground">
                    {modo && navegando && <BadgeModo modo={modo} gps={gps} />}
                    <span>
                      {llegada
                        ? `${totalParadas - 1} de ${totalParadas - 1} paradas completadas`
                        : `Parada ${paradaSiguiente} de ${totalParadas - 1}`}
                    </span>
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
            {ruta && navegando && (
              <button
                type="button"
                onClick={() => detenerNavegacion()}
                className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-destructive px-4 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                Detener
              </button>
            )}
          </div>

          {/* Inicio: navegación real con GPS o simulación (demostraciones) */}
          {ruta && !navegando && (
            <div className="grid shrink-0 grid-cols-[1.4fr_1fr] gap-2 px-4 pb-3 lg:pt-3">
              <button
                type="button"
                onClick={iniciarGps}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-accent px-3 text-sm font-semibold text-accent-foreground shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <LocateFixed className="h-4 w-4 shrink-0" aria-hidden="true" />
                Navegar con GPS
              </button>
              <button
                type="button"
                onClick={iniciarSimulacion}
                title="Recorrido animado para demostraciones"
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm font-semibold transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Play className="h-4 w-4 shrink-0" aria-hidden="true" />
                {llegada && modo === "simulacion" ? "Repetir" : "Simular"}
              </button>
            </div>
          )}

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
                    const pasado = navegando && i <= pasoIdx;
                    const actual = navegando && i === pasoIdx + 1;
                    const nuevoTramo = i === 0 || ruta.pasos[i - 1].tramo !== p.tramo;
                    return (
                      <li key={i} data-actual={actual ? "true" : undefined}>
                        {nuevoTramo && (
                          <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Hacia parada {p.parada}
                            {stops[p.parada]?.sublabel ? ` · ${stops[p.parada].sublabel}` : ""}
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

/** Indica si se navega con el GPS real (y su precisión) o en simulación. */
function BadgeModo({ modo, gps }: { modo: ModoNavegacion; gps: EstadoGps | null }) {
  if (modo === "simulacion") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-foreground">
        <Play className="h-3 w-3" aria-hidden="true" /> Simulación
      </span>
    );
  }
  const precision = gps && "precision" in gps ? gps.precision : null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-600/10 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300">
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-60 motion-reduce:animate-none" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" />
      </span>
      GPS en vivo{precision ? ` · ±${precision} m` : ""}
    </span>
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
