import { describe, it, expect, vi } from "vitest";
import {
  MAX_ANTIGUEDAD_MS,
  OPCIONES_GPS,
  ajustarARuta,
  avisoErrorGps,
  detectarPlataforma,
  crearSeguidorGps,
  leerPosicion,
  validarLectura,
  type Coords,
  type LecturaGps,
} from "../lib/gps";

const AHORA = 1_700_000_000_000;

function lectura(pos: Coords, timestamp = AHORA, precision = 10): LecturaGps {
  return { pos, precision, timestamp, rumbo: null, velocidad: null };
}

function posicion(lat: number, lng: number, extra: Partial<GeolocationCoordinates> = {}) {
  return {
    timestamp: AHORA,
    coords: {
      latitude: lat,
      longitude: lng,
      accuracy: 12,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      ...extra,
    },
  } as unknown as GeolocationPosition;
}

function geolocalizacionFalsa() {
  let siguiente = 1;
  const watchPosition = vi.fn(() => siguiente++);
  const clearWatch = vi.fn();
  return {
    geo: { watchPosition, clearWatch, getCurrentPosition: vi.fn() } as unknown as Geolocation,
    watchPosition,
    clearWatch,
  };
}

describe("leerPosicion", () => {
  it("toma latitud, longitud, precisión y marca temporal del navegador", () => {
    const l = leerPosicion(posicion(-12.03, -77.09, { heading: 90, speed: 5 }));
    expect(l).toEqual({
      pos: [-12.03, -77.09],
      precision: 12,
      timestamp: AHORA,
      rumbo: 90,
      velocidad: 5,
    });
  });

  it("rumbo y velocidad desconocidos quedan en null (NaN en Safari)", () => {
    const l = leerPosicion(posicion(-12, -77, { heading: NaN, speed: null }));
    expect(l.rumbo).toBeNull();
    expect(l.velocidad).toBeNull();
  });
});

describe("validarLectura", () => {
  it("acepta una lectura válida y reciente", () => {
    expect(validarLectura(lectura([-12.03, -77.09]), null, AHORA)).toBeNull();
  });

  it("descarta coordenadas imposibles o precisión inválida", () => {
    expect(validarLectura(lectura([NaN, -77]), null, AHORA)).toBe("invalida");
    expect(validarLectura(lectura([95, -77]), null, AHORA)).toBe("invalida");
    expect(validarLectura(lectura([-12, 200]), null, AHORA)).toBe("invalida");
    expect(validarLectura(lectura([-12, -77], AHORA, -1), null, AHORA)).toBe("invalida");
  });

  it("descarta lecturas en caché demasiado viejas", () => {
    const vieja = lectura([-12, -77], AHORA - MAX_ANTIGUEDAD_MS - 1);
    expect(validarLectura(vieja, null, AHORA)).toBe("antigua");
  });

  it("descarta lecturas que llegan fuera de orden", () => {
    const anterior = lectura([-12, -77], AHORA);
    expect(validarLectura(lectura([-12.001, -77], AHORA - 1000), anterior, AHORA)).toBe("antigua");
  });

  it("descarta la misma lectura repetida", () => {
    const anterior = lectura([-12, -77], AHORA);
    expect(validarLectura(lectura([-12, -77], AHORA), anterior, AHORA)).toBe("duplicada");
  });

  it("no descarta un salto grande ni una posición lejos de la ruta", () => {
    const anterior = lectura([-12, -77], AHORA - 1000);
    // ~5 km en 1 s: se acepta, el filtro es solo por calidad de la medición
    expect(validarLectura(lectura([-12.045, -77], AHORA), anterior, AHORA)).toBeNull();
  });

  it("acepta una lectura nueva aunque repita coordenadas (repartidor detenido)", () => {
    const anterior = lectura([-12, -77], AHORA - 2000);
    expect(validarLectura(lectura([-12, -77], AHORA), anterior, AHORA)).toBeNull();
  });
});

describe("avisoErrorGps", () => {
  it("permiso denegado detiene la navegación", () => {
    expect(avisoErrorGps(1)).toMatchObject({
      fatal: true,
      titulo: "Permiso de ubicación denegado",
    });
  });

  it("da los pasos de la plataforma del teléfono", () => {
    expect(avisoErrorGps(1, "ios").mensaje).toMatch(/Sitios web de Safari/);
    expect(avisoErrorGps(1, "android").mensaje).toMatch(/Chrome/);
    expect(avisoErrorGps(1, "android").mensaje).not.toMatch(/Safari/);
  });

  it("ubicación no disponible y timeout siguen escuchando", () => {
    expect(avisoErrorGps(2)).toMatchObject({ fatal: false, titulo: "Ubicación no disponible" });
    expect(avisoErrorGps(3)).toMatchObject({ fatal: false, titulo: "Señal GPS débil" });
  });
});

describe("detectarPlataforma", () => {
  it("reconoce iPhone, iPad, Android y escritorio", () => {
    expect(detectarPlataforma("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", 5)).toBe(
      "ios",
    );
    expect(detectarPlataforma("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe("ios");
    expect(detectarPlataforma("Mozilla/5.0 (Linux; Android 14; SM-A546E)", 5)).toBe("android");
    expect(detectarPlataforma("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", 0)).toBe("otro");
  });
});

describe("crearSeguidorGps", () => {
  it("usa watchPosition con alta precisión", () => {
    const { geo, watchPosition } = geolocalizacionFalsa();
    const onLectura = vi.fn();
    const onError = vi.fn();
    crearSeguidorGps(geo, onLectura, onError).iniciar();
    expect(watchPosition).toHaveBeenCalledWith(onLectura, onError, OPCIONES_GPS);
    expect(OPCIONES_GPS.enableHighAccuracy).toBe(true);
  });

  it("no crea un segundo observador si ya hay uno activo", () => {
    const { geo, watchPosition } = geolocalizacionFalsa();
    const s = crearSeguidorGps(geo, vi.fn(), vi.fn());
    expect(s.iniciar()).toBe(true);
    expect(s.iniciar()).toBe(false);
    expect(watchPosition).toHaveBeenCalledTimes(1);
    expect(s.activo).toBe(true);
  });

  it("detener libera el observador con clearWatch y permite reiniciar", () => {
    const { geo, watchPosition, clearWatch } = geolocalizacionFalsa();
    const s = crearSeguidorGps(geo, vi.fn(), vi.fn());
    s.iniciar();
    s.detener();
    expect(clearWatch).toHaveBeenCalledWith(1);
    expect(s.activo).toBe(false);
    s.detener(); // idempotente
    expect(clearWatch).toHaveBeenCalledTimes(1);
    s.iniciar();
    s.detener();
    expect(watchPosition).toHaveBeenCalledTimes(2);
    expect(clearWatch).toHaveBeenLastCalledWith(2);
  });

  it("iniciar y detener muchas veces no deja observadores colgados", () => {
    const { geo, watchPosition, clearWatch } = geolocalizacionFalsa();
    const s = crearSeguidorGps(geo, vi.fn(), vi.fn());
    for (let i = 0; i < 20; i++) {
      s.iniciar();
      s.iniciar();
      s.detener();
    }
    expect(watchPosition).toHaveBeenCalledTimes(20);
    expect(clearWatch).toHaveBeenCalledTimes(20);
  });
});

describe("ajustarARuta", () => {
  // Ruta recta hacia el este sobre la latitud -12 (≈109 m entre puntos)
  const ruta = { puntos: [0, 1, 2, 3, 4].map((i) => [-12, -77 + i * 0.001] as Coords) };

  it("proyecta una posición sobre la ruta y mide la distancia", () => {
    const r = ajustarARuta(ruta, [-12.0002, -76.9985], null);
    expect(r.dist).toBeGreaterThan(20);
    expect(r.dist).toBeLessThan(24);
    expect(r.idx === 1 || r.idx === 2).toBe(true);
    expect(r.punto[0]).toBeCloseTo(-12, 6);
  });

  it("no modifica la ruta ni la posición original", () => {
    const pos: Coords = [-12.001, -76.998];
    const copia = JSON.stringify(ruta);
    ajustarARuta(ruta, pos, 0);
    expect(JSON.stringify(ruta)).toBe(copia);
    expect(pos).toEqual([-12.001, -76.998]);
  });

  it("detecta que la posición está lejos de la ruta", () => {
    expect(ajustarARuta(ruta, [-12.01, -76.998], null).dist).toBeGreaterThan(1000);
  });
});
