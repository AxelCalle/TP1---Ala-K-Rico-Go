/**
 * Lógica del GPS del navegador (sin React ni Leaflet) para la navegación del
 * repartidor: opciones de `watchPosition`, validación de lecturas, mensajes de
 * error y proyección de la posición sobre la ruta planificada.
 */

export type Coords = [number, number];

/**
 * - enableHighAccuracy: la navegación calle a calle necesita el GPS del
 *   teléfono, no la ubicación aproximada por Wi-Fi o antena.
 * - maximumAge: acepta una lectura en caché de hasta 5 s para que el primer
 *   punto llegue rápido; las siguientes las entrega el sistema al moverse.
 * - timeout: si en 20 s no hay lectura se avisa "señal débil" y se sigue escuchando.
 */
export const OPCIONES_GPS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 5000,
  timeout: 20000,
};

/** Por encima de esta precisión (m) se avisa "precisión limitada". */
export const PRECISION_LIMITADA_M = 50;
/**
 * Por encima de esta precisión (m) la lectura se muestra en el mapa, pero no se
 * usa para avanzar en la ruta, detectar llegadas ni desvíos, ni se envía al servidor.
 */
export const PRECISION_UTIL_M = 100;
/** Lecturas más viejas que esto (caché del sistema) no representan la posición actual. */
export const MAX_ANTIGUEDAD_MS = 30000;

export interface LecturaGps {
  pos: Coords;
  /** radio de precisión en metros */
  precision: number;
  /** momento de la medición (ms epoch) */
  timestamp: number;
  /** rumbo en grados (0 = norte) si el dispositivo lo informa */
  rumbo: number | null;
  /** velocidad en m/s si el dispositivo la informa */
  velocidad: number | null;
}

export function leerPosicion(p: GeolocationPosition): LecturaGps {
  const { latitude, longitude, accuracy, heading, speed } = p.coords;
  return {
    pos: [latitude, longitude],
    precision: accuracy,
    timestamp: p.timestamp,
    rumbo: heading != null && Number.isFinite(heading) ? heading : null,
    velocidad: speed != null && Number.isFinite(speed) ? speed : null,
  };
}

export type MotivoDescarte = "invalida" | "antigua" | "duplicada";

/**
 * Devuelve por qué se descarta una lectura, o null si es válida. Solo se
 * descartan lecturas por su calidad (coordenadas imposibles, viejas o
 * repetidas), nunca por la velocidad ni por la distancia a la ruta.
 */
export function validarLectura(
  l: LecturaGps,
  anterior: LecturaGps | null,
  ahora = Date.now(),
): MotivoDescarte | null {
  const [lat, lng] = l.pos;
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180 ||
    !Number.isFinite(l.precision) ||
    l.precision < 0
  ) {
    return "invalida";
  }
  if (ahora - l.timestamp > MAX_ANTIGUEDAD_MS) return "antigua";
  if (anterior) {
    if (l.timestamp < anterior.timestamp) return "antigua";
    if (l.timestamp === anterior.timestamp && lat === anterior.pos[0] && lng === anterior.pos[1]) {
      return "duplicada";
    }
  }
  return null;
}

// Códigos de GeolocationPositionError (las constantes no existen fuera del navegador)
const PERMISO_DENEGADO = 1;
const NO_DISPONIBLE = 2;

export interface AvisoGps {
  /** el permiso fue denegado: hay que detener la navegación */
  fatal: boolean;
  titulo: string;
  mensaje: string;
}

export type Plataforma = "ios" | "android" | "otro";

/** Plataforma del teléfono para dar los pasos exactos de su configuración. */
export function detectarPlataforma(
  userAgent: string = typeof navigator === "undefined" ? "" : navigator.userAgent,
  puntosTactiles: number = typeof navigator === "undefined" ? 0 : navigator.maxTouchPoints,
): Plataforma {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  // iPadOS se presenta como Mac de escritorio, pero tiene pantalla táctil
  if (/Macintosh/i.test(userAgent) && puntosTactiles > 1) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "otro";
}

/** Pasos para habilitar la ubicación cuando el navegador responde "denegado". */
export const PASOS_PERMISO: Record<Plataforma, string> = {
  // En iOS el permiso del sitio en Safari no basta: el sistema también debe
  // dar la ubicación a Safari ("Sitios web de Safari"), o responde "denegado".
  ios: "En iPhone: Ajustes → Privacidad y seguridad → Localización (activada) → Sitios web de Safari → «Al usar la app» y Ubicación exacta activada. En Safari: aA → Configuración del sitio web → Ubicación → Permitir. Luego toca Reintentar.",
  android:
    "En Android: activa la Ubicación del teléfono (panel rápido) y en Chrome toca el ícono junto a la dirección → Permisos → Ubicación → Permitir. Si Chrome no tiene permiso: Ajustes → Apps → Chrome → Permisos → Ubicación → Permitir solo con la app en uso. Luego toca Reintentar.",
  otro: "Permite la ubicación para este sitio en la configuración del navegador y luego toca Reintentar.",
};

export function avisoErrorGps(
  code: number,
  plataforma: Plataforma = detectarPlataforma(),
): AvisoGps {
  if (code === PERMISO_DENEGADO) {
    return {
      fatal: true,
      titulo: "Permiso de ubicación denegado",
      mensaje: `Permiso de ubicación denegado. ${PASOS_PERMISO[plataforma]}`,
    };
  }
  if (code === NO_DISPONIBLE) {
    return {
      fatal: false,
      titulo: "Ubicación no disponible",
      mensaje: "Revisa que la ubicación del teléfono esté activada. Se sigue intentando…",
    };
  }
  return {
    fatal: false,
    titulo: "Señal GPS débil",
    mensaje: "No llegan lecturas del GPS. Se sigue intentando…",
  };
}

/**
 * Envoltorio de `watchPosition` que garantiza como máximo un observador:
 * `iniciar` no crea otro si ya hay uno activo y `detener` siempre lo libera.
 */
export function crearSeguidorGps(
  geo: Geolocation,
  onLectura: (p: GeolocationPosition) => void,
  onError: (e: GeolocationPositionError) => void,
  opciones: PositionOptions = OPCIONES_GPS,
) {
  let id: number | null = null;
  return {
    iniciar(): boolean {
      if (id !== null) return false;
      id = geo.watchPosition(onLectura, onError, opciones);
      return true;
    },
    detener() {
      if (id !== null) geo.clearWatch(id);
      id = null;
    },
    get activo() {
      return id !== null;
    },
  };
}

export type SeguidorGps = ReturnType<typeof crearSeguidorGps>;

/**
 * Proyecta una posición sobre la ruta: devuelve el punto más cercano sobre la
 * polilínea, su índice y la distancia (m). Solo se usa para medir el avance y
 * detectar desvíos; el marcador del repartidor se dibuja en la posición real.
 * Con `desde`, busca solo cerca de la posición anterior (algo hacia atrás por
 * el ruido del GPS, bastante hacia adelante) para que una calle que se recorre
 * dos veces no haga saltar el avance.
 */
export function ajustarARuta(
  ruta: { puntos: Coords[] },
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
