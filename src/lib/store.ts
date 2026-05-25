// Lightweight mock store for the UI prototype (no backend yet).
import { useSyncExternalStore } from "react";

export type Sauce =
  | "Buffalo"
  | "BBQ"
  | "Honey Garlic"
  | "Lemon Pepper"
  | "Korean"
  | "Mango Habanero";

export type OrderStatus = "unassigned" | "assigned" | "in_transit" | "delivered";

export type Driver = {
  id: string;
  name: string;
};

export type Order = {
  id: string;
  customer: string;
  phone: string;
  address: string;
  coords?: [number, number]; // [lat, lng] — pre-geocodificado para mayor precisión
  wings: number;
  sauce: Sauce;
  notes?: string;
  createdAt: number;
  status: OrderStatus;
  driverId?: string;
};

export type Session = { email: string; role: "admin" | "driver"; driverId?: string } | null;

type State = {
  orders: Order[];
  drivers: Driver[];
  session: Session;
};

const KEY = "wings-ops-state-v1";

const seed = (): State => ({
  drivers: [
    { id: "d1", name: "Junior Bellido" },
    { id: "d2", name: "Jean Paul Rojas" },
    { id: "d3", name: "Santiago Garcia" },
  ],
  orders: [
    {
      id: "WO-0001",
      customer: "Jaime Bayly",
      phone: "+51 985 623 213",
      address: "Jiron Bello Horizonte 2888, San Martin de Porres, Lima",
      coords: [-12.0326395, -77.0763205],
      wings: 12,
      sauce: "Buffalo",
      notes: "Extra ranch",
      createdAt: Date.now() - 1000 * 60 * 22,
      status: "assigned",
      driverId: "d1",
    },
    {
      id: "WO-0002",
      customer: "Priya Natarajan",
      phone: "+51 963 105 268",
      address: "Av. Los Alisos 1526, Los Olivos, Lima",
      coords: [-11.9889, -77.0712],
      wings: 24,
      sauce: "Korean",
      createdAt: Date.now() - 1000 * 60 * 9,
      status: "unassigned",
    },
  ],
  session: null,
});

let state: State = (() => {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed();
    return JSON.parse(raw) as State;
  } catch {
    return seed();
  }
})();

const listeners = new Set<() => void>();

function persist() {
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(state));
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state),
  );
}

export const store = {
  get: () => state,
  login(email: string, _password: string) {
    const role: "admin" | "driver" = email.toLowerCase().includes("driver")
      ? "driver"
      : "admin";
    const driverId = role === "driver" ? state.drivers[0]?.id : undefined;
    state = { ...state, session: { email, role, driverId } };
    persist();
  },
  logout() {
    state = { ...state, session: null };
    persist();
  },
  addOrder(o: Omit<Order, "id" | "createdAt" | "status">) {
    const id = `WO-${1044 + state.orders.length}`;
    const order: Order = { ...o, id, createdAt: Date.now(), status: "unassigned" };
    state = { ...state, orders: [order, ...state.orders] };
    persist();
  },
  assignOrder(orderId: string, driverId: string) {
    state = {
      ...state,
      orders: state.orders.map((o) =>
        o.id === orderId ? { ...o, driverId, status: "assigned" } : o,
      ),
    };
    persist();
  },
  setStatus(orderId: string, status: OrderStatus) {
    state = {
      ...state,
      orders: state.orders.map((o) => (o.id === orderId ? { ...o, status } : o)),
    };
    persist();
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
