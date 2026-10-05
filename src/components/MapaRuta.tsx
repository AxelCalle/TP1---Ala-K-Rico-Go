/**
 * Mapa de ruta con Leaflet + OpenStreetMap.
 * Geocodificación: Nominatim → Photon (Komoot) con simplificación progresiva.
 * Routing:        OSRM public API (ruta real por calles).
 * MapaRutaMulti:  avatar animado del repartidor + agente de navegación GPS.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, Navigation2, Volume2, VolumeX } from "lucide-react";

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

// ─── Componente simple (un origen → un destino) ───────────────────────────────

interface Props {
  origen: string;
  destino: string;
  coordsOrigen?: [number, number];
  coordsDestino?: [number, number];
  altura?: number;
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
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<any>(null);
  const [estado, setEstado] = useState<Estado>("cargando");

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

      const mapa = L.map(contenedorRef.current, { zoomControl: true }).setView(SMP_FALLBACK, 13);
      mapaRef.current = mapa;

      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
        {
          attribution:
            'Tiles &copy; <a href="https://www.esri.com">Esri</a> &mdash; Source: Esri, HERE, Garmin, © OpenStreetMap contributors',
          maxZoom: 19,
        },
      ).addTo(mapa);

      setTimeout(() => {
        if (activo && mapaRef.current) mapaRef.current.invalidateSize();
      }, 100);

      let [coordA, coordB] = await Promise.all([
        coordsOrigen ? Promise.resolve(coordsOrigen as [number, number]) : geocodificar(origen),
        coordsDestino ? Promise.resolve(coordsDestino as [number, number]) : geocodificar(destino),
      ]);

      if (!activo) return;

      if (!coordA) coordA = SMP_FALLBACK;

      if (!coordB) {
        setEstado("error");
        mapa.setView(coordA, 15);
        L.marker(coordA, { icon: markerIcon(L, "A", "#4f46e5") })
          .addTo(mapa)
          .bindPopup("<b>Ala K' Rico GO</b>");
        return;
      }

      L.marker(coordA, { icon: markerIcon(L, "A", "#4f46e5") })
        .addTo(mapa)
        .bindPopup("<b>Ala K' Rico GO</b><br><small>Punto de partida</small>");

      L.marker(coordB, { icon: markerIcon(L, "B", "#f59e0b") })
        .addTo(mapa)
        .bindPopup("<b>Destino de entrega</b>");

      const bounds = L.latLngBounds([coordA, coordB]).pad(0.25);
      mapa.fitBounds(bounds);

      if (!activo) return;

      const puntos = await obtenerRuta(coordA, coordB);

      if (!activo) return;

      if (puntos.length > 0) {
        L.polyline(puntos, { color: "#ffffff", weight: 9, opacity: 0.7 }).addTo(mapa);
        L.polyline(puntos, { color: "#4f46e5", weight: 5, opacity: 0.95 }).addTo(mapa);
        setEstado("listo");
      } else {
        L.polyline([coordA, coordB], {
          color: "#4f46e5",
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
  }, [origen, destino]);

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ height: altura }}>
      {estado === "cargando" && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted"
          style={{ zIndex: 1000 }}
        >
          <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-accent border-t-transparent" />
          <p className="text-sm text-muted-foreground">Calculando ruta…</p>
        </div>
      )}

      {estado === "sin-ruta" && (
        <div
          className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-md bg-card/90 px-3 py-1.5 text-xs text-muted-foreground shadow"
          style={{ zIndex: 1000 }}
        >
          Ruta aproximada — servicio de calles no disponible
        </div>
      )}

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

// ─── Mapa multi-parada ────────────────────────────────────────────────────────

async function obtenerRutaMulti(
  coords: Coords[],
): Promise<{ puntos: Coords[]; pasos: OsrmStep[] }> {
  if (coords.length < 2) return { puntos: [], pasos: [] };
  try {
    const waypoints = coords.map(([lat, lng]) => `${lng},${lat}`).join(";");
    const url = `${OSRM}/${waypoints}?overview=full&geometries=geojson&steps=true&annotations=false`;
    const res = await fetch(url);
    if (!res.ok) return { puntos: [], pasos: [] };
    const data = await res.json();
    if (data.code !== "Ok") return { puntos: [], pasos: [] };

    const puntos: Coords[] = data.routes[0].geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng] as Coords,
    );

    // Extraer pasos de manejo de todas las legs
    const pasos: OsrmStep[] = [];
    for (const leg of data.routes[0].legs ?? []) {
      for (const step of leg.steps ?? []) {
        const maneuver = step.maneuver ?? {};
        pasos.push({
          instruccion: buildInstruccion(maneuver.type, maneuver.modifier, step.name),
          distancia: Math.round(step.distance ?? 0),
          coordInicio: maneuver.location
            ? ([maneuver.location[1], maneuver.location[0]] as Coords)
            : puntos[0],
        });
      }
    }

    return { puntos, pasos };
  } catch {
    return { puntos: [], pasos: [] };
  }
}

interface OsrmStep {
  instruccion: string;
  distancia: number;
  coordInicio: Coords;
}

function buildInstruccion(type?: string, modifier?: string, nombre?: string): string {
  const calle = nombre && nombre !== "" ? ` por ${nombre}` : "";
  const dirMap: Record<string, string> = {
    left: "izquierda",
    right: "derecha",
    "sharp left": "izquierda pronunciada",
    "sharp right": "derecha pronunciada",
    "slight left": "levemente a la izquierda",
    "slight right": "levemente a la derecha",
    straight: "recto",
    uturn: "dar la vuelta",
  };
  const dir = dirMap[modifier ?? ""] ?? "";

  switch (type) {
    case "turn":
      return `Gire a la ${dir}${calle}`;
    case "new name":
      return `Continúe${calle}`;
    case "depart":
      return `Inicie el recorrido${calle}`;
    case "arrive":
      return "Ha llegado al destino";
    case "merge":
      return `Incorpore${dir ? " " + dir : ""}${calle}`;
    case "on ramp":
      return `Tome la rampa${dir ? " " + dir : ""}${calle}`;
    case "off ramp":
      return `Salga por la rampa${dir ? " " + dir : ""}${calle}`;
    case "fork":
      return `En el cruce, tome la ${dir}${calle}`;
    case "end of road":
      return `Al final, gire a la ${dir}${calle}`;
    case "roundabout":
      return `En la rotonda, tome la salida${calle}`;
    case "rotary":
      return `En la glorieta, continúe${calle}`;
    default:
      return dir ? `Dirija ${dir}${calle}` : `Continúe${calle}`;
  }
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

// ─── Interpolación lineal entre dos coords ───────────────────────────────────

function interpolar(a: Coords, b: Coords, t: number): Coords {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export interface MultiStop {
  coords: Coords;
  label: string;
  sublabel?: string;
  color: string;
}

interface MultiProps {
  stops: MultiStop[];
  altura?: number;
  className?: string;
}

/**
 * Mapa de ruta multi-parada con Leaflet.
 * - Marcadores numerados y ruta real por calles (OSRM).
 * - Avatar animado del repartidor que recorre la ruta.
 * - Agente de navegación GPS con instrucciones de giro.
 * - stops[0] es siempre el depot (punto de origen).
 */
export function MapaRutaMulti({ stops, altura = 400, className = "" }: MultiProps) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<any>(null);
  const leafletRef = useRef<any>(null); // referencia a L (Leaflet) una vez importado
  const avatarRef = useRef<any>(null); // marcador Leaflet del repartidor
  const animFrameRef = useRef<number>(0);
  const rutaPuntosRef = useRef<Coords[]>([]);
  const pasosNavRef = useRef<OsrmStep[]>([]);

  const [estado, setEstado] = useState<Estado>("cargando");
  const [simulando, setSimulando] = useState(false);
  const [instruccion, setInstruccion] = useState<string>("");
  const [distSiguiente, setDistSiguiente] = useState<number>(0);
  const [vozActiva, setVozActiva] = useState(true);
  const [pasoActual, setPasoActual] = useState(0);
  const [llegadaVisible, setLlegadaVisible] = useState(false);
  const [historialInstrucciones, setHistorialInstrucciones] = useState<string[]>([]);
  const historialRef = useRef<HTMLDivElement>(null);

  // Hablar instrucción con Web Speech API
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
    setSimulando(false);
    setInstruccion("");
    setLlegadaVisible(false);
    cancelAnimationFrame(animFrameRef.current);

    async function montar() {
      const L = (await import("leaflet")).default;
      leafletRef.current = L;
      if (!activo || !contenedorRef.current) return;

      if (mapaRef.current) {
        mapaRef.current.remove();
        mapaRef.current = null;
      }

      const mapa = L.map(contenedorRef.current, { zoomControl: true }).setView(stops[0].coords, 13);
      mapaRef.current = mapa;

      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
        {
          attribution:
            'Tiles &copy; <a href="https://www.esri.com">Esri</a> &mdash; Source: Esri, HERE, Garmin, © OpenStreetMap contributors',
          maxZoom: 19,
        },
      ).addTo(mapa);

      setTimeout(() => {
        if (activo && mapaRef.current) mapaRef.current.invalidateSize();
      }, 100);

      const bounds = L.latLngBounds(stops.map((s) => s.coords)).pad(0.2);
      mapa.fitBounds(bounds);

      // Marcadores de paradas
      stops.forEach((stop, idx) => {
        const icon = markerIcon(L, stop.label, stop.color);
        const popup =
          idx === 0
            ? "<b>Ala K' Rico GO</b><br><small>Punto de partida</small>"
            : `<b>Parada ${idx}</b><br><small>${stop.sublabel ?? ""}</small>`;
        L.marker(stop.coords, { icon }).addTo(mapa).bindPopup(popup);
      });

      if (!activo) return;

      const coords: Coords[] = stops.map((s) => s.coords);
      const { puntos, pasos } = await obtenerRutaMulti(coords);

      if (!activo) return;

      if (puntos.length > 0) {
        rutaPuntosRef.current = puntos;
        pasosNavRef.current = pasos;

        L.polyline(puntos, { color: "#ffffff", weight: 9, opacity: 0.6 }).addTo(mapa);
        L.polyline(puntos, { color: "#ea580c", weight: 5, opacity: 0.95 }).addTo(mapa);

        // Crear avatar del repartidor en la posición inicial
        const avatarIcon = crearAvatarRepartidor(L, 0);
        const avatar = L.marker(puntos[0], {
          icon: avatarIcon,
          zIndexOffset: 1000,
        }).addTo(mapa);
        avatarRef.current = avatar;

        setEstado("listo");
      } else {
        rutaPuntosRef.current = [];
        const linea: Coords[] = stops.map((s) => s.coords);
        L.polyline(linea, { color: "#ea580c", weight: 4, opacity: 0.7, dashArray: "10, 8" }).addTo(
          mapa,
        );
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
      if (mapaRef.current) {
        mapaRef.current.remove();
        mapaRef.current = null;
      }
    };
  }, [stops]);

  // ── Ajustar tamaño del mapa cuando aparece el panel lateral ────────────────
  useEffect(() => {
    if (estado === "listo" || estado === "sin-ruta") {
      setTimeout(() => {
        mapaRef.current?.invalidateSize();
      }, 80);
    }
  }, [estado]);

  // ── Scroll automático del historial ─────────────────────────────────────────
  useEffect(() => {
    if (historialRef.current) {
      historialRef.current.scrollTop = historialRef.current.scrollHeight;
    }
  }, [historialInstrucciones]);

  // ── Animación del avatar a lo largo de la ruta ─────────────────────────────
  function iniciarSimulacion() {
    const puntos = rutaPuntosRef.current;
    const pasos = pasosNavRef.current;
    const L = leafletRef.current;
    if (!puntos.length || !avatarRef.current || !L) return;

    setSimulando(true);
    setLlegadaVisible(false);
    setPasoActual(0);
    setHistorialInstrucciones([]);
    setInstruccion("");

    // Un punto de ruta por cada FRAMES_POR_PUNTO frames (≈60fps).
    // Con 6 frames/punto: ~10 pts/s → ~30-60 s para una ruta urbana típica.
    const FRAMES_POR_PUNTO = 6;
    let frameCount = 0;
    let idx = 0;
    let ultimaInstruccion = "";

    const pasoNavCercano = (pos: Coords): OsrmStep | null => {
      if (!pasos.length) return null;
      let minDist = Infinity;
      let cercano: OsrmStep | null = null;
      for (const p of pasos) {
        const d = distanciaM(pos, p.coordInicio);
        if (d < minDist) {
          minDist = d;
          cercano = p;
        }
      }
      return minDist < 80 ? cercano : null;
    };

    const frame = () => {
      if (!avatarRef.current || !mapaRef.current) return;

      frameCount++;

      // Solo avanzar un punto cada FRAMES_POR_PUNTO frames
      if (frameCount % FRAMES_POR_PUNTO === 0) {
        idx++;

        if (idx >= puntos.length - 1) {
          avatarRef.current.setLatLng(puntos[puntos.length - 1]);
          setSimulando(false);
          const msg = "Ha llegado al destino final";
          setInstruccion(msg);
          setHistorialInstrucciones((prev) => [...prev, msg]);
          setLlegadaVisible(true);
          hablar(msg);
          return;
        }

        const siguiente = Math.min(idx + 1, puntos.length - 1);
        const bearing = calcularBearing(puntos[idx], puntos[siguiente]);

        avatarRef.current.setLatLng(puntos[idx]);
        avatarRef.current.setIcon(crearAvatarRepartidorImport(L, bearing));

        // El mapa sigue al avatar suavemente cada 15 puntos
        if (idx % 15 === 0) {
          mapaRef.current.panTo(puntos[idx], { animate: true, duration: 0.8, easeLinearity: 0.4 });
        }

        // Instrucción de navegación si hay paso cercano
        const pasoNav = pasoNavCercano(puntos[idx]);
        if (pasoNav && pasoNav.instruccion !== ultimaInstruccion) {
          ultimaInstruccion = pasoNav.instruccion;
          setInstruccion(pasoNav.instruccion);
          setDistSiguiente(pasoNav.distancia);
          setHistorialInstrucciones((prev) => [...prev.slice(-19), pasoNav.instruccion]);
          hablar(pasoNav.instruccion);
          setPasoActual((prev) => prev + 1);
        }
      }

      animFrameRef.current = requestAnimationFrame(frame);
    };

    // Primera instrucción al arrancar
    if (pasos.length > 0) {
      setInstruccion(pasos[0].instruccion);
      setDistSiguiente(pasos[0].distancia);
      setHistorialInstrucciones([pasos[0].instruccion]);
      hablar(pasos[0].instruccion);
    }

    animFrameRef.current = requestAnimationFrame(frame);
  }

  function detenerSimulacion() {
    cancelAnimationFrame(animFrameRef.current);
    setSimulando(false);
    setInstruccion("");
    setHistorialInstrucciones([]);
    if (avatarRef.current && rutaPuntosRef.current.length) {
      avatarRef.current.setLatLng(rutaPuntosRef.current[0]);
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  const puedeComentar = estado === "listo" && rutaPuntosRef.current.length > 0;

  return (
    <div
      className={`relative flex overflow-hidden rounded-xl border border-border ${className}`}
      style={{ height: altura }}
    >
      {/* ── IZQUIERDA: Mapa Leaflet ── */}
      <div className="relative min-w-0 flex-1">
        {/* Banner instrucción GPS actual (overlay superior) */}
        {simulando && instruccion && (
          <div
            className="absolute left-2 right-2 top-2 z-[1001] flex items-center gap-2 rounded-lg bg-card/95 px-3 py-2 shadow-md"
            style={{ backdropFilter: "blur(8px)" }}
          >
            <Navigation2 className="h-4 w-4 shrink-0 text-accent" />
            <p className="flex-1 min-w-0 text-xs font-semibold leading-snug text-foreground truncate">
              {instruccion}
            </p>
          </div>
        )}

        {/* Overlay llegada */}
        {llegadaVisible && (
          <div
            className="absolute inset-x-2 top-2 z-[1002] flex items-center gap-3 rounded-xl bg-emerald-600/95 px-4 py-3 text-white shadow-lg"
            style={{ backdropFilter: "blur(8px)" }}
          >
            <span className="text-2xl">🏁</span>
            <div>
              <p className="text-sm font-bold">¡Llegada al destino!</p>
              <p className="text-xs opacity-80">Todas las paradas completadas.</p>
            </div>
          </div>
        )}

        {/* Overlay carga */}
        {estado === "cargando" && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted"
            style={{ zIndex: 1000 }}
          >
            <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-accent border-t-transparent" />
            <p className="text-sm text-muted-foreground">Trazando ruta…</p>
          </div>
        )}

        {estado === "sin-ruta" && (
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-card/90 px-3 py-1.5 text-xs text-muted-foreground shadow"
            style={{ zIndex: 1000 }}
          >
            Ruta aproximada — servicio de calles no disponible
          </div>
        )}

        <div ref={contenedorRef} className="h-full w-full" />
      </div>

      {/* ── DERECHA: Panel de instrucciones GPS ── */}
      {puedeComentar && (
        <div className="flex w-56 shrink-0 flex-col border-l border-border bg-card">
          {/* Cabecera del panel */}
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <span className="text-sm">🛵</span>
              Navegación GPS
            </div>
            <button
              onClick={() => setVozActiva((v) => !v)}
              className="shrink-0 rounded-full p-1 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title={vozActiva ? "Silenciar voz" : "Activar voz"}
            >
              {vozActiva ? (
                <Volume2 className="h-3.5 w-3.5" />
              ) : (
                <VolumeX className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {/* Lista de instrucciones */}
          <div ref={historialRef} className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
            {historialInstrucciones.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 px-2 py-8 text-center">
                <Navigation2 className="h-8 w-8 text-muted-foreground/20" />
                <p className="text-xs text-muted-foreground leading-snug">
                  Presiona «Iniciar recorrido» para ver las instrucciones paso a paso
                </p>
              </div>
            ) : (
              historialInstrucciones.map((inst, i) => {
                const esActual = i === historialInstrucciones.length - 1;
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs transition-all ${
                      esActual
                        ? "border border-accent/30 bg-accent/15 font-semibold text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    <Navigation2
                      className={`mt-0.5 h-3 w-3 shrink-0 ${esActual ? "text-accent" : "text-muted-foreground/40"}`}
                    />
                    <span className="leading-snug">{inst}</span>
                    {esActual && distSiguiente > 0 && !inst.includes("destino") && (
                      <span className="ml-auto shrink-0 whitespace-nowrap text-[10px] text-muted-foreground">
                        {distSiguiente < 1000
                          ? `${distSiguiente} m`
                          : `${(distSiguiente / 1000).toFixed(1)} km`}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Controles */}
          <div className="border-t border-border px-3 py-2.5 space-y-1.5">
            {simulando ? (
              <button
                onClick={detenerSimulacion}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-destructive/90 px-3 py-2 text-xs font-semibold text-white transition hover:bg-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Detener
              </button>
            ) : (
              <button
                onClick={iniciarSimulacion}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Navigation2 className="h-3.5 w-3.5" />
                {historialInstrucciones.length > 0 ? "Reiniciar" : "Iniciar recorrido"}
              </button>
            )}
            {pasoActual > 0 && (
              <p className="text-center text-[10px] text-muted-foreground">
                {pasoActual} instrucciones
              </p>
            )}
          </div>
        </div>
      )}
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

/** SVG del avatar repartidor con rotación por bearing */
function svgRepartidor(bearing: number): string {
  return `
    <div style="
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

function crearAvatarRepartidorImport(L: any, bearing: number) {
  return L.divIcon({
    html: svgRepartidor(bearing),
    className: "",
    iconSize: [44, 44],
    iconAnchor: [22, 38],
    popupAnchor: [0, -42],
  });
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
