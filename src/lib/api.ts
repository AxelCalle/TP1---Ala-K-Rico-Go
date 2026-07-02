/**
 * api.ts — Cliente HTTP para el backend Express de Ala K' Rico GO.
 *
 * Usa JWT Bearer tokens almacenados en localStorage.
 * Si no hay backend disponible (ErrorRed), la capa de login cae al mock store.
 */

const URL_API: string =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (import.meta as any).env?.VITE_API_URL ?? "http://localhost:3001";

const CLAVE_TOKEN = "akr-jwt-token";

// ─── Errores tipados ──────────────────────────────────────────────────────────

export class ErrorApi extends Error {
  constructor(
    public readonly status: number,
    public readonly codigo: string,
  ) {
    super(codigo);
    this.name = "ErrorApi";
  }
}

export class ErrorRed extends Error {
  constructor() {
    super("Sin conexión con el servidor");
    this.name = "ErrorRed";
  }
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type UsuarioApi = {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  role: "admin" | "driver" | "customer";
  idRole: number;
};

export type RespuestaLogin = {
  token: string;
  usuario: UsuarioApi;
};

export type DatosRegistro = {
  nombre: string;
  apellido?: string;
  email: string;
  password: string;
  dni?: string;
  telefono?: string;
  idRole?: number;
};

export type PedidoApi = {
  Id_Pedido: number;
  Id_Cliente: number;
  Id_Repartidor: number | null;
  Estado: "sin_asignar" | "asignado" | "en_camino" | "entregado" | "cancelado";
  Lat_Origen: number | null;
  Lng_Origen: number | null;
  Lat_Destino: number;
  Lng_Destino: number;
  Direccion_Destino: string;
  Productos: string | null;
  Total: number | null;
  Creacion_Pedido: string;
  Asignacion_Pedido: string | null;
  Entrega_Pedido: string | null;
  Cancelacion_Pedido: string | null;
  Nombre_Cliente?: string;
  Apellido_Cliente?: string;
  Nombre_Repartidor?: string;
  Apellido_Repartidor?: string;
};

export type RepartidorApi = {
  Id_Usuario: number;
  Nombre_Usuario: string;
  Apellido_Usuario: string;
  Email_Usuario: string;
  DNI_Usuario: string | null;
  Telf_Usuario: string | null;
  Activo_Usuario: boolean;
  Lat: number | null;
  Lng: number | null;
  Ubicacion_Actualizado: string | null;
};

export type NotificacionApi = {
  Id_Notificacion: number;
  Tipo: "pedido_en_camino" | "entregado" | "cancelado" | "asignado" | "sistema";
  Mensaje: string;
  Id_Pedido: number | null;
  Leida: boolean;
  Creacion: string;
};

export type AcoConfigApi = {
  alfa: number;
  beta: number;
  rho: number;
  Q: number;
  numAnts: number;
  iterations: number;
  elite: number;
  tauMin: number;
};

export type DashboardApi = {
  kpis: {
    total_hoy: number;
    activos: number;
    entregados: number;
    cancelados: number;
    avg_minutos: number | null;
    repartidores_activos: number;
  };
  porEstado: { Estado: string; cantidad: number }[];
  recientes: PedidoApi[];
};

export type ReporteTiemposApi = {
  total: number;
  promedio: number | null;
  minimo: number | null;
  maximo: number | null;
  desviacion: number | null;
};

export type AuditoriaApi = {
  Id_Log: number;
  Id_Usuario: number | null;
  Email_Intento: string | null;
  Evento: string;
  Detalle: string | null;
  IP: string | null;
  Timestamp: string;
  Nombre_Usuario: string | null;
  Email_Usuario: string | null;
};

export type GeocacheResultado = {
  cached: boolean;
  Lat?: number;
  Lng?: number;
  Resultado?: string;
};

// ─── Helper de fetch ─────────────────────────────────────────────────────────

async function solicitar<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${URL_API}${ruta}`, {
      ...opciones,
      headers: {
        "Content-Type": "application/json",
        ...(opciones.headers ?? {}),
      },
    });
  } catch {
    throw new ErrorRed();
  }

  const datos = await res.json().catch(() => ({ error: "respuesta_invalida" }));

  if (!res.ok) {
    throw new ErrorApi(res.status, (datos as { error?: string }).error ?? "error_desconocido");
  }

  return datos as T;
}

function cabeceraAuth(): Record<string, string> {
  const token = api.obtenerToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── API pública ──────────────────────────────────────────────────────────────

export const api = {

  // ── Token JWT ─────────────────────────────────────────────────────────────
  guardarToken(token: string) {
    if (typeof window !== "undefined") localStorage.setItem(CLAVE_TOKEN, token);
  },
  obtenerToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(CLAVE_TOKEN);
  },
  limpiarToken() {
    if (typeof window !== "undefined") localStorage.removeItem(CLAVE_TOKEN);
  },

  // ── Autenticación ─────────────────────────────────────────────────────────
  async login(email: string, password: string): Promise<RespuestaLogin> {
    return solicitar<RespuestaLogin>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  async registrar(datos: DatosRegistro): Promise<{ ok: boolean }> {
    return solicitar<{ ok: boolean }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(datos),
    });
  },

  async perfil(): Promise<Record<string, unknown>> {
    return solicitar("/api/auth/perfil", { headers: cabeceraAuth() });
  },

  async ping(): Promise<boolean> {
    try {
      await solicitar("/api/health");
      return true;
    } catch {
      return false;
    }
  },

  // ── Pedidos ───────────────────────────────────────────────────────────────
  async listarPedidos(): Promise<PedidoApi[]> {
    return solicitar<PedidoApi[]>("/api/pedidos", { headers: cabeceraAuth() });
  },

  async obtenerPedido(id: number): Promise<PedidoApi> {
    return solicitar<PedidoApi>(`/api/pedidos/${id}`, { headers: cabeceraAuth() });
  },

  async crearPedido(datos: {
    latDestino: number; lngDestino: number; direccionDestino: string;
    productos?: unknown[]; total?: number; latOrigen?: number; lngOrigen?: number;
  }): Promise<{ ok: boolean; id: number }> {
    return solicitar<{ ok: boolean; id: number }>("/api/pedidos", {
      method: "POST",
      headers: cabeceraAuth(),
      body: JSON.stringify(datos),
    });
  },

  async cambiarEstadoPedido(id: number, estado: string): Promise<{ ok: boolean }> {
    return solicitar<{ ok: boolean }>(`/api/pedidos/${id}/estado`, {
      method: "PATCH",
      headers: cabeceraAuth(),
      body: JSON.stringify({ estado }),
    });
  },

  async asignarPedido(idPedido: number, idRepartidor: number): Promise<{ ok: boolean }> {
    return solicitar<{ ok: boolean }>(`/api/pedidos/${idPedido}/asignar`, {
      method: "PATCH",
      headers: cabeceraAuth(),
      body: JSON.stringify({ idRepartidor }),
    });
  },

  async reportarIncidencia(idPedido: number, tipo: string, detalle?: string): Promise<{ ok: boolean }> {
    return solicitar<{ ok: boolean }>(`/api/pedidos/${idPedido}/incidencia`, {
      method: "POST",
      headers: cabeceraAuth(),
      body: JSON.stringify({ tipo, detalle }),
    });
  },

  // ── Repartidores ──────────────────────────────────────────────────────────
  async listarRepartidores(): Promise<RepartidorApi[]> {
    return solicitar<RepartidorApi[]>("/api/repartidores", { headers: cabeceraAuth() });
  },

  async crearRepartidor(datos: {
    nombre: string; apellido?: string; email: string; dni: string; telefono?: string;
  }): Promise<{ ok: boolean; id: number; passwordAuto: string }> {
    return solicitar<{ ok: boolean; id: number; passwordAuto: string }>("/api/repartidores", {
      method: "POST",
      headers: cabeceraAuth(),
      body: JSON.stringify(datos),
    });
  },

  async toggleRepartidor(id: number): Promise<{ ok: boolean }> {
    return solicitar<{ ok: boolean }>(`/api/repartidores/${id}/toggle`, {
      method: "PATCH",
      headers: cabeceraAuth(),
    });
  },

  async actualizarUbicacion(idRepartidor: number, lat: number, lng: number): Promise<{ ok: boolean }> {
    return solicitar<{ ok: boolean }>(`/api/repartidores/${idRepartidor}/ubicacion`, {
      method: "PUT",
      headers: cabeceraAuth(),
      body: JSON.stringify({ lat, lng }),
    });
  },

  async obtenerUbicacion(idRepartidor: number): Promise<{ Lat: number; Lng: number; Actualizado: string }> {
    return solicitar<{ Lat: number; Lng: number; Actualizado: string }>(
      `/api/repartidores/${idRepartidor}/ubicacion`,
      { headers: cabeceraAuth() },
    );
  },

  // ── Notificaciones ────────────────────────────────────────────────────────
  async listarNotificaciones(): Promise<NotificacionApi[]> {
    return solicitar<NotificacionApi[]>("/api/notificaciones", { headers: cabeceraAuth() });
  },

  async marcarTodasLeidas(): Promise<{ ok: boolean }> {
    return solicitar<{ ok: boolean }>("/api/notificaciones/leer-todas", {
      method: "PATCH",
      headers: cabeceraAuth(),
    });
  },

  async marcarNotifLeida(id: number): Promise<{ ok: boolean }> {
    return solicitar<{ ok: boolean }>(`/api/notificaciones/${id}/leer`, {
      method: "PATCH",
      headers: cabeceraAuth(),
    });
  },

  // ── Geocaché ──────────────────────────────────────────────────────────────
  async buscarGeocache(query: string): Promise<GeocacheResultado> {
    return solicitar<GeocacheResultado>(
      `/api/geocache?q=${encodeURIComponent(query)}`,
      { headers: cabeceraAuth() },
    );
  },

  async guardarGeocache(datos: {
    query: string; lat: number; lng: number; resultado?: unknown;
  }): Promise<{ ok: boolean }> {
    return solicitar<{ ok: boolean }>("/api/geocache", {
      method: "POST",
      headers: cabeceraAuth(),
      body: JSON.stringify(datos),
    });
  },

  // ── Auditoría ─────────────────────────────────────────────────────────────
  async listarAuditoria(params?: {
    evento?: string; desde?: string; hasta?: string; limite?: number;
  }): Promise<AuditoriaApi[]> {
    const qs = new URLSearchParams();
    if (params?.evento) qs.set("evento", params.evento);
    if (params?.desde)  qs.set("desde",  params.desde);
    if (params?.hasta)  qs.set("hasta",  params.hasta);
    if (params?.limite) qs.set("limite", String(params.limite));
    return solicitar<AuditoriaApi[]>(
      `/api/auditoria?${qs.toString()}`,
      { headers: cabeceraAuth() },
    );
  },

  // ── Reportes ──────────────────────────────────────────────────────────────
  async dashboard(): Promise<DashboardApi> {
    return solicitar<DashboardApi>("/api/reportes/dashboard", { headers: cabeceraAuth() });
  },

  async reporteTiempos(params?: { desde?: string; hasta?: string }): Promise<ReporteTiemposApi> {
    const qs = new URLSearchParams();
    if (params?.desde) qs.set("desde", params.desde);
    if (params?.hasta) qs.set("hasta", params.hasta);
    return solicitar<ReporteTiemposApi>(
      `/api/reportes/tiempos?${qs.toString()}`,
      { headers: cabeceraAuth() },
    );
  },

  async reporteRepartidores(): Promise<RepartidorApi[]> {
    return solicitar<RepartidorApi[]>("/api/reportes/repartidores", { headers: cabeceraAuth() });
  },

  async reporteZonas(): Promise<{ lat: number; lng: number; frecuencia: number; avg_minutos: number | null }[]> {
    return solicitar("/api/reportes/zonas", { headers: cabeceraAuth() });
  },

  // ── Config ACO ────────────────────────────────────────────────────────────
  async obtenerAcoConfig(): Promise<AcoConfigApi> {
    return solicitar<AcoConfigApi>("/api/config/aco", { headers: cabeceraAuth() });
  },

  async guardarAcoConfig(config: Partial<AcoConfigApi>): Promise<{ ok: boolean }> {
    return solicitar<{ ok: boolean }>("/api/config/aco", {
      method: "PUT",
      headers: cabeceraAuth(),
      body: JSON.stringify(config),
    });
  },
};
