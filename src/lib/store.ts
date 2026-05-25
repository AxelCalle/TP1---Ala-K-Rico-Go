// Lightweight mock store for the UI prototype (no backend yet).
import { useSyncExternalStore } from "react";

export type Sauce =
  | "Buffalo"
  | "BBQ"
  | "Honey Garlic"
  | "Lemon Pepper"
  | "Korean"
  | "Mango Habanero";

export type OrderStatus = "sin_asignar" | "asignado" | "en_camino" | "entregado";

// ─── Tipos de usuario ─────────────────────────────────────────────────────────

export type Driver = {
  id: string;
  name: string;
  email?: string;
  password?: string; // texto plano — solo prototipo
  dni?: string;
  phone?: string;
  zona?: string;
  activo?: boolean;  // undefined = activo (compatibilidad con datos previos)
  createdAt?: number;
};

export type TipoDocumento = "DNI" | "CE" | "Pasaporte" | "RUC";

export type Customer = {
  id: string;
  name: string;
  apellidos?: string;
  email: string;
  password: string; // texto plano — solo prototipo
  phone?: string;
  address?: string;
  tipoDocumento?: TipoDocumento;
  numeroDocumento?: string;
  createdAt: number;
};

// ─── Pedidos ──────────────────────────────────────────────────────────────────

export type Order = {
  id: string;
  customer: string;
  customerId?: string;
  phone: string;
  address: string;
  coords?: [number, number];
  wings: number;
  sauce: Sauce;
  notes?: string;
  createdAt: number;
  status: OrderStatus;
  driverId?: string;
};

// ─── Sesión y bloqueo ────────────────────────────────────────────────────────

export type Session = {
  email: string;
  role: "admin" | "driver" | "customer";
  driverId?: string;
  customerId?: string;
} | null;

/**
 * Resultado del intento de login.
 * - role:    acceso concedido
 * - invalid: credenciales incorrectas
 * - locked:  cuenta bloqueada; lockedUntil = timestamp de desbloqueo
 */
export type LoginResult =
  | { status: "ok";      role: "admin" | "driver" | "customer" }
  | { status: "invalid" }
  | { status: "locked";  lockedUntil: number };

/** Intentos fallidos por correo: { count, lockedUntil (0 = no bloqueado) } */
type LoginAttempts = Record<string, { count: number; lockedUntil: number }>;

const MAX_INTENTOS  = 5;
const BLOQUEO_MS    = 15 * 60 * 1000; // 15 minutos

type State = {
  orders: Order[];
  drivers: Driver[];
  customers: Customer[];
  loginAttempts: LoginAttempts;
  session: Session;
};

// ─── Persistencia ─────────────────────────────────────────────────────────────

// v3: IDs desde WO-0001, bloqueo por intentos fallidos
const CLAVE = "wings-ops-state-v3";

const valoresIniciales = (): State => ({
  customers: [],
  drivers: [
    { id: "d1", name: "Junior Bellido",  email: "repartidor1@alakricogo.com", password: "repartidor1" },
    { id: "d2", name: "Jean Paul Rojas", email: "repartidor2@alakricogo.com", password: "repartidor2" },
    { id: "d3", name: "Santiago Garcia", email: "repartidor3@alakricogo.com", password: "repartidor3" },
  ],
  orders: [],          // sin pedidos iniciales — el primer pedido creado será WO-0001
  loginAttempts: {},
  session: null,
});

let state: State = (() => {
  if (typeof window === "undefined") return valoresIniciales();
  try {
    const raw = localStorage.getItem(CLAVE);
    if (!raw) return valoresIniciales();
    const parsed = JSON.parse(raw) as State;
    if (!parsed.customers)     parsed.customers     = [];
    if (!parsed.loginAttempts) parsed.loginAttempts = {};
    return parsed;
  } catch {
    return valoresIniciales();
  }
})();

const oyentes = new Set<() => void>();

function persistir() {
  if (typeof window !== "undefined") {
    localStorage.setItem(CLAVE, JSON.stringify(state));
  }
  oyentes.forEach((l) => l());
}

function suscribir(l: () => void) {
  oyentes.add(l);
  return () => oyentes.delete(l);
}

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    suscribir,
    () => selector(state),
    () => selector(state),
  );
}

// ─── Helpers internos ────────────────────────────────────────────────────────

/** Registra un intento fallido y bloquea la cuenta si se alcanzan MAX_INTENTOS. */
function registrarIntentoFallido(emailL: string) {
  const prev    = state.loginAttempts[emailL] ?? { count: 0, lockedUntil: 0 };
  const count   = prev.count + 1;
  const locked  = count >= MAX_INTENTOS ? Date.now() + BLOQUEO_MS : 0;
  state = {
    ...state,
    loginAttempts: {
      ...state.loginAttempts,
      [emailL]: { count, lockedUntil: locked },
    },
  };
  persistir();
}

/** Limpia el contador de intentos fallidos tras un login exitoso. */
function limpiarIntentos(emailL: string) {
  const { [emailL]: _, ...rest } = state.loginAttempts;
  state = { ...state, loginAttempts: rest };
}

// ─── Acciones del store ───────────────────────────────────────────────────────

export const store = {
  get: () => state,

  // ── Autenticación ─────────────────────────────────────────────────────────

  login(email: string, password: string): LoginResult {
    const emailL = email.trim().toLowerCase();

    // ── Verificar bloqueo activo ──────────────────────────────────────────
    const attempts = state.loginAttempts[emailL];
    if (attempts?.lockedUntil && Date.now() < attempts.lockedUntil) {
      return { status: "locked", lockedUntil: attempts.lockedUntil };
    }

    // ── Intentar autenticar ───────────────────────────────────────────────

    // 1. Cliente registrado
    const customer = state.customers.find(
      (c) => c.email === emailL && c.password === password,
    );
    if (customer) {
      limpiarIntentos(emailL);
      state = { ...state, session: { email: customer.email, role: "customer", customerId: customer.id } };
      persistir();
      return { status: "ok", role: "customer" };
    }

    // 2. Repartidor registrado por credenciales
    const driver = state.drivers.find(
      (d) => d.email?.toLowerCase() === emailL && d.password === password,
    );
    if (driver) {
      if (driver.activo === false) {
        return { status: "invalid" }; // cuenta desactivada — mismo mensaje genérico
      }
      limpiarIntentos(emailL);
      state = { ...state, session: { email: driver.email!, role: "driver", driverId: driver.id } };
      persistir();
      return { status: "ok", role: "driver" };
    }

    // 3. Acceso de admin por email (sin contraseña real — solo demo)
    if (emailL.includes("admin") || emailL.includes("alakricogo")) {
      limpiarIntentos(emailL);
      state = { ...state, session: { email, role: "admin" } };
      persistir();
      return { status: "ok", role: "admin" };
    }

    // ── Credenciales incorrectas → registrar intento fallido ─────────────
    registrarIntentoFallido(emailL);

    // Releer para devolver estado actualizado
    const updated = state.loginAttempts[emailL];
    if (updated?.lockedUntil) {
      return { status: "locked", lockedUntil: updated.lockedUntil };
    }
    return { status: "invalid" };
  },

  logout() {
    state = { ...state, session: null };
    persistir();
    // Limpiar JWT de la API real si lo había
    if (typeof window !== "undefined") {
      localStorage.removeItem("akr-jwt-token");
    }
  },

  /** Intentos fallidos restantes antes del bloqueo (0 si ya está bloqueado). */
  remainingAttempts(email: string): number {
    const emailL  = email.trim().toLowerCase();
    const attempts = state.loginAttempts[emailL];
    if (!attempts) return MAX_INTENTOS;
    if (attempts.lockedUntil && Date.now() < attempts.lockedUntil) return 0;
    return Math.max(0, MAX_INTENTOS - attempts.count);
  },

  // ── Helpers de bloqueo para integración con API real ─────────────────────

  /**
   * Registra un intento fallido de login (útil cuando la API devuelve 401
   * y necesitamos mantener el contador de bloqueo en el frontend).
   */
  registrarFallo(email: string) {
    registrarIntentoFallido(email.trim().toLowerCase());
  },

  /**
   * Devuelve el timestamp hasta el que la cuenta está bloqueada,
   * o 0 si no está bloqueada.
   */
  getBloqueo(email: string): number {
    const emailL   = email.trim().toLowerCase();
    const attempts = state.loginAttempts[emailL];
    if (attempts?.lockedUntil && Date.now() < attempts.lockedUntil) {
      return attempts.lockedUntil;
    }
    return 0;
  },

  /**
   * Establece la sesión activa a partir de los datos devueltos por la API
   * (sin pasar por el flujo de validación de contraseña del mock).
   */
  setApiSession(usuario: {
    id: number;
    email: string;
    role: "admin" | "driver" | "customer";
  }) {
    state = {
      ...state,
      session: {
        email: usuario.email,
        role:  usuario.role,
        driverId:   usuario.role === "driver"   ? String(usuario.id) : undefined,
        customerId: usuario.role === "customer" ? String(usuario.id) : undefined,
      },
    };
    persistir();
  },

  /** Verifica si un correo ya existe en el sistema. */
  emailExists(email: string): boolean {
    const e = email.trim().toLowerCase();
    return (
      state.customers.some((c) => c.email === e) ||
      state.drivers.some((d) => d.email?.toLowerCase() === e)
    );
  },

  /** Restablece la contraseña del usuario asociado al correo. */
  resetPassword(email: string, newPassword: string): "ok" | "not_found" {
    const emailL = email.trim().toLowerCase();
    let found = false;

    const customers = state.customers.map((c) => {
      if (c.email === emailL) { found = true; return { ...c, password: newPassword }; }
      return c;
    });
    const drivers = state.drivers.map((d) => {
      if (d.email?.toLowerCase() === emailL) { found = true; return { ...d, password: newPassword }; }
      return d;
    });

    if (!found) return "not_found";

    // También limpiar el bloqueo al resetear contraseña
    const { [emailL]: _, ...restAttempts } = state.loginAttempts;
    state = { ...state, customers, drivers, loginAttempts: restAttempts };
    persistir();
    return "ok";
  },

  // ── Registro ──────────────────────────────────────────────────────────────

  registerCustomer(name: string, email: string, password: string, phone?: string): "ok" | "email_taken" {
    const emailL = email.trim().toLowerCase();
    if (store.emailExists(emailL)) return "email_taken";
    const customer: Customer = {
      id: `C-${Date.now()}`,
      name: name.trim(),
      email: emailL,
      password,
      phone: phone?.trim() || undefined,
      createdAt: Date.now(),
    };
    state = { ...state, customers: [...state.customers, customer] };
    persistir();
    return "ok";
  },

  registerDriver(name: string, email: string, password: string): "ok" | "email_taken" {
    const emailL = email.trim().toLowerCase();
    if (store.emailExists(emailL)) return "email_taken";
    const driver: Driver = {
      id: `D-${Date.now()}`,
      name: name.trim(),
      email: emailL,
      password,
      activo: true,
      createdAt: Date.now(),
    };
    state = { ...state, drivers: [...state.drivers, driver] };
    persistir();
    return "ok";
  },

  /**
   * El administrador crea un repartidor con todos sus datos.
   * Genera una contraseña automática: primerNombre + "." + últimas 4 del DNI.
   * Devuelve el repartidor creado (para mostrar credenciales al admin).
   */
  agregarRepartidorAdmin(datos: {
    name: string;
    dni?: string;
    email: string;
    phone?: string;
    zona?: string;
  }): { resultado: "ok"; driver: Driver; passwordGenerado: string } | { resultado: "email_taken" } {
    const emailL = datos.email.trim().toLowerCase();
    if (store.emailExists(emailL)) return { resultado: "email_taken" };

    const primerNombre = datos.name.trim().split(" ")[0].toLowerCase();
    const sufijoDni    = datos.dni ? datos.dni.trim().slice(-4) : String(Date.now()).slice(-4);
    const passwordGenerado = `${primerNombre}.${sufijoDni}`;

    const driver: Driver = {
      id: `D-${Date.now()}`,
      name: datos.name.trim(),
      email: emailL,
      password: passwordGenerado,
      dni: datos.dni?.trim() || undefined,
      phone: datos.phone?.trim() || undefined,
      zona: datos.zona?.trim() || undefined,
      activo: true,
      createdAt: Date.now(),
    };
    state = { ...state, drivers: [...state.drivers, driver] };
    persistir();
    return { resultado: "ok", driver, passwordGenerado };
  },

  /** Actualiza los datos de perfil de un repartidor. */
  actualizarRepartidor(
    id: string,
    datos: Partial<Pick<Driver, "name" | "dni" | "email" | "phone" | "zona">>,
  ) {
    state = {
      ...state,
      drivers: state.drivers.map((d) => (d.id === id ? { ...d, ...datos } : d)),
    };
    persistir();
  },

  /** Activa o desactiva la cuenta de un repartidor. */
  toggleActivoRepartidor(id: string) {
    state = {
      ...state,
      drivers: state.drivers.map((d) =>
        d.id === id ? { ...d, activo: !(d.activo ?? true) } : d,
      ),
    };
    persistir();
  },

  // ── Perfil del cliente ────────────────────────────────────────────────────

  updateCustomerProfile(
    id: string,
    data: Partial<Pick<Customer, "name" | "apellidos" | "phone" | "address" | "tipoDocumento" | "numeroDocumento">>,
  ) {
    state = {
      ...state,
      customers: state.customers.map((c) => (c.id === id ? { ...c, ...data } : c)),
    };
    persistir();
  },

  // ── Pedidos ───────────────────────────────────────────────────────────────

  addOrder(o: Omit<Order, "id" | "createdAt" | "status">) {
    // Calcular el siguiente número secuencial a partir del máximo existente
    const nums = state.orders
      .map((ord) => parseInt(ord.id.replace("WO-", ""), 10))
      .filter((n) => !isNaN(n));
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    const id   = `WO-${String(next).padStart(4, "0")}`;

    const order: Order = { ...o, id, createdAt: Date.now(), status: "sin_asignar" };
    state = { ...state, orders: [order, ...state.orders] };
    persistir();
  },

  assignOrder(orderId: string, driverId: string) {
    state = {
      ...state,
      orders: state.orders.map((o) =>
        o.id === orderId ? { ...o, driverId, status: "asignado" } : o,
      ),
    };
    persistir();
  },

  setStatus(orderId: string, status: OrderStatus) {
    state = {
      ...state,
      orders: state.orders.map((o) => (o.id === orderId ? { ...o, status } : o)),
    };
    persistir();
  },
};

export const SAUCES: Sauce[] = [
  "Buffalo",
  "BBQ",
  "Honey Garlic",
  "Lemon Pepper",
  "Korean",
  "Mango Habanero",
];

export const TIPOS_DOCUMENTO: TipoDocumento[] = ["DNI", "CE", "Pasaporte", "RUC"];
