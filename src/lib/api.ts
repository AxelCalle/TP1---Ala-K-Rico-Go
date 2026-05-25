/**
 * api.ts — Cliente HTTP para el backend Express de Ala K' Rico GO.
 *
 * Usa JWT Bearer tokens almacenados en localStorage.
 * Si no hay backend disponible (ErrorRed), la capa de login cae al mock store.
 */

// Vite inyecta import.meta.env en tiempo de build; el operador ?. protege el SSR.
const URL_API: string =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (import.meta as any).env?.VITE_API_URL ?? "http://localhost:3001";

const CLAVE_TOKEN = "akr-jwt-token";

// ─── Errores tipados ──────────────────────────────────────────────────────────

/** Error de respuesta HTTP del servidor (4xx, 5xx). */
export class ErrorApi extends Error {
  constructor(
    public readonly status: number,
    public readonly codigo: string,
  ) {
    super(codigo);
    this.name = "ErrorApi";
  }
}

/** No se pudo establecer conexión con el servidor (red caída / CORS / timeout). */
export class ErrorRed extends Error {
  constructor() {
    super("Sin conexión con el servidor");
    this.name = "ErrorRed";
  }
}

// ─── Tipos de respuesta ───────────────────────────────────────────────────────

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
  /** 1 = Administrador, 2 = Repartidor, 3 = Cliente (default). */
  idRole?: number;
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
    // fetch lanzó → sin conexión o CORS bloqueado
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
  // ── Gestión del token JWT ─────────────────────────────────────────────────

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

  /**
   * Inicia sesión contra el backend real.
   * - Lanza `ErrorApi(401, "invalid")` si las credenciales son incorrectas.
   * - Lanza `ErrorRed` si no hay conexión.
   */
  async login(email: string, password: string): Promise<RespuestaLogin> {
    return solicitar<RespuestaLogin>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  /**
   * Registra un nuevo usuario en el backend.
   * - Lanza `ErrorApi(409, "email_taken")` si el correo ya existe.
   */
  async registrar(datos: DatosRegistro): Promise<{ ok: boolean }> {
    return solicitar<{ ok: boolean }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(datos),
    });
  },

  /**
   * Devuelve el perfil del usuario autenticado (requiere token guardado).
   * - Lanza `ErrorApi(401, ...)` si el token es inválido o expiró.
   */
  async perfil(): Promise<Record<string, unknown>> {
    return solicitar("/api/auth/perfil", {
      headers: cabeceraAuth(),
    });
  },

  /**
   * Comprueba si el servidor está disponible.
   * Devuelve `true` si responde con 200, `false` en caso contrario.
   */
  async ping(): Promise<boolean> {
    try {
      await solicitar("/api/health");
      return true;
    } catch {
      return false;
    }
  },
};
