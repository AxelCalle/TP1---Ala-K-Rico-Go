import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Bell,
  BellRing,
  ChefHat,
  ClipboardList,
  KeyRound,
  LogOut,
  Map,
  MapPin,
  PackageCheck,
  Phone,
  Plus,
  Search,
  ShoppingBag,
  Timer,
  Truck,
  User,
  UtensilsCrossed,
  X,
  XCircle,
} from "lucide-react";
import { LogoIcon } from "../components/Logo";
import {
  store,
  useStore,
  SAUCES,
  TIPOS_DOCUMENTO,
  type Sauce,
  type TipoDocumento,
} from "@/lib/store";
import { MapaRuta } from "@/components/MapaRuta";
import { MapaSelectorUbicacion } from "@/components/MapaSelectorUbicacion";
import { RESTAURANTE_COORDS, RESTAURANTE_DIRECCION } from "@/lib/constants";
import { geocodificarDireccion } from "@/lib/geo";
import { api } from "@/lib/api";

export const Route = createFileRoute("/cliente")({
  head: () => ({
    meta: [{ title: "Mi cuenta — Ala K' Rico GO" }],
  }),
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const session = store.get().session;
    if (!session || session.role !== "customer") {
      throw redirect({ to: "/login" });
    }
  },
  component: ClientePage,
});

type Tab = "pedidos" | "seguimiento" | "perfil";

// ─── Constantes de estado ─────────────────────────────────────────────────────

const STATUS_ES: Record<string, string> = {
  sin_asignar: "Pedido recibido",
  asignado: "En preparación",
  en_camino: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

const STATUS_COLOR: Record<string, string> = {
  sin_asignar: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  asignado: "bg-accent/20 text-accent",
  en_camino: "bg-primary text-primary-foreground",
  entregado: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  cancelado: "bg-destructive/15 text-destructive",
};

const STEPS = [
  {
    key: "sin_asignar",
    label: "Pedido recibido",
    sub: "Tu pedido fue registrado",
    icon: ClipboardList,
  },
  { key: "asignado", label: "En preparación", sub: "Estamos preparando tus alitas", icon: ChefHat },
  { key: "en_camino", label: "En camino", sub: "Tu repartidor está en ruta", icon: Truck },
  { key: "entregado", label: "Entregado", sub: "¡Disfruta tus alitas!", icon: PackageCheck },
] as const;

const COORDS_RESTAURANTE = RESTAURANTE_COORDS;
const DIR_RESTAURANTE = RESTAURANTE_DIRECCION;

// ─── Página principal ─────────────────────────────────────────────────────────

function ClientePage() {
  const navigate = useNavigate();
  const session = useStore((s) => s.session);
  const customer = useStore((s) => s.customers.find((c) => c.id === s.session?.customerId));
  const qcPage = useQueryClient();
  const { data: misNotifs = [] } = useQuery({
    queryKey: ["notificaciones"],
    queryFn: api.listarNotificaciones.bind(api),
    refetchInterval: 30000,
    enabled: !!session,
  });
  const [tab, setTab] = useState<Tab>("pedidos");
  const [modalPedido, setModalPedido] = useState(false);
  const [montado, setMontado] = useState(false);
  const [mostrarNotifs, setMostrarNotifs] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Marcar como montado (solo en el cliente, nunca en SSR)
  useEffect(() => {
    setMontado(true);
  }, []);

  // Cerrar dropdown de notificaciones al tocar/hacer clic fuera o con Escape
  useEffect(() => {
    if (!mostrarNotifs) return;
    function handleClickOutside(e: PointerEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setMostrarNotifs(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setMostrarNotifs(false);
    }
    document.addEventListener("pointerdown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [mostrarNotifs]);

  // Redirigir si no hay sesión de cliente (solo después de montar)
  useEffect(() => {
    if (montado && (!session || session.role !== "customer")) {
      navigate({ to: "/login" });
    }
  }, [session, navigate, montado]);

  // SSR y primer render del cliente devuelven null para evitar mismatch de hidratación
  if (!montado || !session || session.role !== "customer") return null;

  const nombre = customer
    ? `${customer.name}${customer.apellidos ? " " + customer.apellidos : ""}`
    : session.email;

  const noLeidas = misNotifs.filter((n) => !n.Leida).length;

  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip bg-background">
      {/* Header sticky: compacto en móvil, respeta el notch con .safe-top */}
      <header className="safe-top sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-2 px-3 sm:h-16 sm:px-6">
          <Link
            to="/"
            aria-label="Ala K' Rico GO — inicio"
            className="flex min-w-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LogoIcon size={28} />
            <span className="hidden truncate text-lg font-semibold tracking-tight sm:inline">
              Ala K' Rico GO
            </span>
          </Link>
          <div className="flex flex-none items-center gap-1 sm:gap-3">
            {/* Botón principal: hacer pedido */}
            <button
              onClick={() => setModalPedido(true)}
              aria-label="Hacer pedido"
              className="inline-flex h-11 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-semibold text-accent-foreground transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Hacer pedido</span>
            </button>
            <span className="hidden max-w-[10rem] truncate text-sm text-muted-foreground md:inline">
              Hola, <span className="font-medium text-foreground">{nombre.split(" ")[0]}</span>
            </span>
            {/* Campana de notificaciones */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                aria-label={
                  noLeidas > 0 ? `Notificaciones (${noLeidas} sin leer)` : "Notificaciones"
                }
                aria-haspopup="dialog"
                aria-expanded={mostrarNotifs}
                aria-controls="panel-notificaciones"
                onClick={async () => {
                  setMostrarNotifs((v) => !v);
                  if (!mostrarNotifs && noLeidas > 0) {
                    try {
                      await api.marcarTodasLeidas();
                    } catch {
                      /* ignore */
                    }
                    qcPage.invalidateQueries({ queryKey: ["notificaciones"] });
                  }
                }}
                className="relative inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {noLeidas > 0 ? (
                  <BellRing className="h-5 w-5 text-accent" />
                ) : (
                  <Bell className="h-5 w-5" />
                )}
                {noLeidas > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground">
                    {noLeidas > 9 ? "9+" : noLeidas}
                  </span>
                )}
              </button>
              {mostrarNotifs && (
                // Móvil: panel anclado a todo el ancho bajo el header. ≥sm: dropdown clásico.
                <div
                  id="panel-notificaciones"
                  role="dialog"
                  aria-label="Notificaciones"
                  className="fixed inset-x-2 top-[calc(env(safe-area-inset-top)+3.75rem)] z-50 flex max-h-[calc(100dvh-env(safe-area-inset-top)-5rem)] flex-col rounded-xl border border-border bg-card shadow-[var(--shadow-elegant)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:max-h-[28rem] sm:w-80"
                >
                  <div className="flex flex-none items-center justify-between border-b border-border py-1 pl-4 pr-1">
                    <span className="text-sm font-semibold">Notificaciones</span>
                    <button
                      type="button"
                      aria-label="Cerrar notificaciones"
                      onClick={() => setMostrarNotifs(false)}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                    {misNotifs.length === 0 ? (
                      <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                        Sin notificaciones
                      </p>
                    ) : (
                      misNotifs.slice(0, 15).map((n) => (
                        <div
                          key={n.Id_Notificacion}
                          className={`flex items-start gap-3 px-4 py-3 text-sm transition ${n.Leida ? "opacity-60" : "bg-accent/5"}`}
                        >
                          <span className="mt-0.5 text-base leading-none">
                            {n.Tipo === "entregado"
                              ? "🎉"
                              : n.Tipo === "pedido_en_camino"
                                ? "🛵"
                                : n.Tipo === "cancelado"
                                  ? "❌"
                                  : n.Tipo === "asignado"
                                    ? "🍗"
                                    : "ℹ️"}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="break-words">{n.Mensaje}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {new Date(n.Creacion).toLocaleTimeString("es-PE", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                          {!n.Leida && (
                            <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-accent" />
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                store.logout();
                navigate({ to: "/" });
              }}
              type="button"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full min-w-0 max-w-4xl px-3 py-5 sm:px-6 sm:py-8">
        {/* Tabs: segmented control de 3 columnas iguales (icono + etiqueta corta en móvil) */}
        <div
          role="tablist"
          aria-label="Secciones de mi cuenta"
          className="mb-5 grid grid-cols-3 gap-1 rounded-xl border border-border bg-card p-1 sm:mb-8"
        >
          <TabBtn
            active={tab === "pedidos"}
            onClick={() => setTab("pedidos")}
            icon={<ShoppingBag className="h-4 w-4" />}
            label="Mis Pedidos"
            labelCorto="Pedidos"
          />
          <TabBtn
            active={tab === "seguimiento"}
            onClick={() => setTab("seguimiento")}
            icon={<MapPin className="h-4 w-4" />}
            label="Seguimiento"
            labelCorto="Rastreo"
          />
          <TabBtn
            active={tab === "perfil"}
            onClick={() => setTab("perfil")}
            icon={<User className="h-4 w-4" />}
            label="Mi Perfil"
            labelCorto="Perfil"
          />
        </div>

        {tab === "pedidos" && (
          <TabPedidos customerId={session.customerId!} onNuevoPedido={() => setModalPedido(true)} />
        )}
        {tab === "seguimiento" && <TabSeguimiento customerId={session.customerId!} />}
        {tab === "perfil" && <TabPerfil customerId={session.customerId!} />}
      </main>

      {/* Modal: nuevo pedido */}
      {modalPedido && (
        <ModalNuevoPedido
          customer={customer}
          customerId={session.customerId!}
          onClose={() => setModalPedido(false)}
          onCreado={() => {
            setModalPedido(false);
            setTab("seguimiento");
          }}
        />
      )}

      <footer className="mt-auto border-t border-border bg-card">
        <div className="pb-safe-3 mx-auto flex max-w-4xl flex-col gap-1 px-4 pt-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2">
            <LogoIcon size={16} />
            <span className="text-xs text-muted-foreground">Ala K' Rico GO</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Delivery · Jr. Áncash 3855, SMP · {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}

// ─── Modal: Nuevo Pedido ──────────────────────────────────────────────────────

function ModalNuevoPedido({
  customer,
  customerId,
  onClose,
  onCreado,
}: {
  customer: ReturnType<typeof useStore<any>> | undefined;
  customerId: string;
  onClose: () => void;
  onCreado: () => void;
}) {
  const [direccion, setDireccion] = useState(customer?.address ?? "");
  const [telefono, setTelefono] = useState(customer?.phone ?? "");
  const [alitas, setAlitas] = useState(12);
  const [salsa, setSalsa] = useState<Sauce>("Buffalo");
  const [notas, setNotas] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const qcModal = useQueryClient();

  // Estado del selector de mapa
  const [mostrarMapa, setMostrarMapa] = useState(false);
  const [coordsPin, setCoordsPin] = useState<[number, number] | null>(null);

  // Escape cierra el modal (salvo mientras se envía) y bloquea el scroll del fondo
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape" && !enviando) onClose();
    }
    document.addEventListener("keydown", handleEscape);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = overflowPrevio;
    };
  }, [onClose, enviando]);

  /** El cliente seleccionó un punto en el mapa */
  function handleSeleccionMapa(coords: [number, number], dir: string) {
    setCoordsPin(coords);
    setDireccion(dir);
  }

  /** Si escribe manualmente, descartamos las coords del pin */
  function handleCambioDireccion(val: string) {
    setDireccion(val);
    setCoordsPin(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!direccion.trim()) {
      setError("Ingresa la dirección de entrega.");
      return;
    }
    setError("");
    setEnviando(true);

    // Si el cliente fijó el pin, usamos esas coords exactas; si no, geocodificamos el texto
    const coords = coordsPin ?? (await geocodificarDireccion(direccion.trim()));
    if (!coords) {
      setError("No se pudo ubicar la dirección. Intenta seleccionarla en el mapa.");
      setEnviando(false);
      return;
    }

    try {
      await api.crearPedido({
        latDestino: coords[0],
        lngDestino: coords[1],
        direccionDestino: direccion.trim().slice(0, 300),
        productos: [
          {
            alitas: Math.min(200, Math.max(1, alitas)),
            salsa,
            notas: notas.trim().slice(0, 200) || undefined,
          },
        ],
        latOrigen: RESTAURANTE_COORDS[0],
        lngOrigen: RESTAURANTE_COORDS[1],
      });
    } catch {
      setError("Error al registrar el pedido. Intenta de nuevo.");
      setEnviando(false);
      return;
    }

    setEnviando(false);
    qcModal.invalidateQueries({ queryKey: ["mis-pedidos"] });
    onCreado();
  }

  return (
    // Móvil: bottom sheet (items-end). ≥sm: diálogo centrado. dvh para que el teclado
    // virtual no deje el footer fuera de la pantalla.
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !enviando) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-pedido-titulo"
        aria-describedby="modal-pedido-desc"
        className="relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-border bg-card shadow-[var(--shadow-elegant)] sm:max-w-lg sm:rounded-2xl"
      >
        {/* ── Cabecera fija ──────────────────────────────────────────────── */}
        <div className="flex flex-none items-center justify-between gap-3 border-b border-border py-3 pl-4 pr-2 sm:py-4 sm:pl-6 sm:pr-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-accent/15 text-accent">
              <UtensilsCrossed className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 id="modal-pedido-titulo" className="text-lg font-semibold">
                Hacer un pedido
              </h2>
              <p id="modal-pedido-desc" className="text-sm text-muted-foreground">
                Elige tu salsa y punto de entrega.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={enviando}
            aria-label="Cerrar"
            className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          {/* ── Cuerpo con scroll ──────────────────────────────────────────── */}
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-6">
            {/* Cantidad + Salsa */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="np-alitas" className="text-sm font-medium">
                  Cantidad de alitas
                </label>
                <input
                  id="np-alitas"
                  aria-describedby="np-alitas-ayuda"
                  inputMode="numeric"
                  type="number"
                  required
                  min={6}
                  max={200}
                  step={6}
                  value={alitas}
                  onChange={(e) => setAlitas(parseInt(e.target.value || "6", 10))}
                  className={clsInput}
                />
                <p id="np-alitas-ayuda" className="text-xs text-muted-foreground">
                  Mínimo 6, en múltiplos de 6
                </p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="np-salsa" className="text-sm font-medium">
                  Salsa
                </label>
                <select
                  id="np-salsa"
                  value={salsa}
                  onChange={(e) => setSalsa(e.target.value as Sauce)}
                  className={clsInput}
                >
                  {SAUCES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* ── Dirección de entrega ─────────────────────────────────────── */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <label htmlFor="np-direccion" className="text-sm font-medium">
                  Dirección de entrega <span className="text-destructive">*</span>
                </label>
                {/* Botón para abrir/cerrar el mapa */}
                <button
                  type="button"
                  onClick={() => setMostrarMapa((v) => !v)}
                  aria-expanded={mostrarMapa}
                  aria-controls="np-mapa"
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9 ${
                    mostrarMapa
                      ? "bg-accent/20 text-accent"
                      : "border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <Map className="h-3.5 w-3.5" />
                  {mostrarMapa ? "Ocultar mapa" : "Seleccionar en mapa"}
                </button>
              </div>

              {/* Campo de texto */}
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="np-direccion"
                  type="text"
                  required
                  maxLength={200}
                  autoComplete="street-address"
                  value={direccion}
                  onChange={(e) => handleCambioDireccion(e.target.value)}
                  aria-invalid={!!error && !direccion.trim()}
                  aria-describedby={error ? "np-error" : undefined}
                  className={`${clsInput} pl-9 ${coordsPin ? "border-accent/60 bg-accent/5" : ""}`}
                  placeholder="Jr. Ejemplo 123, San Martín de Porres, Lima"
                />
              </div>
              {/* Badge "pin fijado": fuera del input para no tapar el texto en 320px */}
              {coordsPin && (
                <button
                  type="button"
                  onClick={() => setCoordsPin(null)}
                  aria-label="Quitar ubicación fijada en el mapa"
                  className="inline-flex min-h-9 items-center gap-1 rounded-full bg-accent/20 px-3 text-xs font-semibold text-accent transition hover:bg-destructive/20 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  📍 Ubicación del mapa <X className="h-3 w-3" />
                </button>
              )}

              {/* Mapa interactivo (desplegable) */}
              {mostrarMapa && (
                <div
                  id="np-mapa"
                  className="isolate overflow-hidden rounded-xl border border-accent/30"
                >
                  <div className="flex items-center gap-2 bg-accent/10 px-3 py-2">
                    <MapPin className="h-3.5 w-3.5 flex-none text-accent" />
                    <p className="min-w-0 text-xs font-medium text-accent">
                      Toca el mapa o arrastra el pin para fijar tu punto de entrega exacto
                    </p>
                  </div>
                  <MapaSelectorUbicacion
                    onSeleccion={handleSeleccionMapa}
                    coordsIniciales={coordsPin ?? undefined}
                    altura={300}
                  />
                </div>
              )}
            </div>

            {/* Teléfono */}
            <div className="space-y-1.5">
              <label htmlFor="np-telefono" className="text-sm font-medium">
                Teléfono de contacto
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="np-telefono"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={20}
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className={`${clsInput} pl-9`}
                  placeholder="+51 999 999 999"
                />
              </div>
            </div>

            {/* Notas */}
            <div className="space-y-1.5">
              <label htmlFor="np-notas" className="text-sm font-medium">
                Notas <span className="text-xs text-muted-foreground">(opcional)</span>
              </label>
              <input
                id="np-notas"
                type="text"
                maxLength={200}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                className={clsInput}
                placeholder="Sin picante extra, ranch aparte…"
              />
            </div>

            {error && (
              <p
                id="np-error"
                role="alert"
                className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            )}
          </div>

          {/* ── Footer siempre visible: resumen + acciones ──────────────────── */}
          <div className="pb-safe-3 flex-none space-y-3 border-t border-border bg-card px-4 pt-3 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-sm">
              <span className="min-w-0 text-muted-foreground">
                {alitas} alitas · {salsa}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {coordsPin && (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    📍 Ubicación exacta
                  </span>
                )}
                <span className="font-semibold text-accent" aria-live="polite">
                  {enviando ? "Procesando…" : "Listo para pedir"}
                </span>
              </div>
            </div>

            {/* Móvil: botón primario arriba y a todo el ancho; ≥sm: en fila */}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
              <button
                type="button"
                onClick={onClose}
                className={`${clsBtnSec} w-full sm:w-auto`}
                disabled={enviando}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={enviando}
                className="min-h-11 w-full flex-1 rounded-md bg-accent py-2.5 text-sm font-semibold text-accent-foreground transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                {enviando
                  ? coordsPin
                    ? "Registrando pedido…"
                    : "Verificando dirección…"
                  : "Confirmar pedido"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Tab: Mis Pedidos ─────────────────────────────────────────────────────────

function TabPedidos({ onNuevoPedido }: { customerId: string; onNuevoPedido: () => void }) {
  const qc = useQueryClient();
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["mis-pedidos"],
    queryFn: api.listarPedidos.bind(api),
    refetchInterval: 15000,
  });
  const [confirmandoCancelar, setConfirmandoCancelar] = useState<number | null>(null);

  async function cancelar(id: number) {
    try {
      await api.cambiarEstadoPedido(id, "cancelado");
    } catch {
      /* ignore */
    }
    qc.invalidateQueries({ queryKey: ["mis-pedidos"] });
    setConfirmandoCancelar(null);
  }

  if (isLoading) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Cargando pedidos…</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-5 py-10 text-center sm:p-14">
        <UtensilsCrossed className="mx-auto h-12 w-12 text-muted-foreground/30" />
        <h2 className="mt-4 text-base font-semibold">Aún no has pedido nada</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          ¡Haz tu primer pedido de alitas ahora mismo!
        </p>
        <button
          onClick={onNuevoPedido}
          className="mt-5 inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition hover:brightness-105"
        >
          <Plus className="h-4 w-4" /> Hacer mi primer pedido
        </button>
      </div>
    );
  }

  const activo = orders.find((o) => o.Estado !== "entregado" && o.Estado !== "cancelado");

  return (
    <div className="space-y-5">
      {activo && (
        <div className="rounded-xl border-2 border-accent/40 bg-accent/5 p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-accent">
              Pedido en curso
            </span>
            <span
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${STATUS_COLOR[activo.Estado] ?? ""}`}
            >
              {STATUS_ES[activo.Estado] ?? activo.Estado}
            </span>
          </div>
          <BarraProgreso status={activo.Estado} />
          <div className="mt-3 min-w-0 text-sm">
            <p className="break-words font-mono text-xs text-muted-foreground">
              AKA-{String(activo.Id_Pedido).padStart(4, "0")} · {activo.Direccion_Destino}
            </p>
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-base font-semibold text-muted-foreground">
          Historial ({orders.length})
        </h2>
        <div className="space-y-3">
          {orders.map((o) => {
            const productos = (() => {
              try {
                return JSON.parse(o.Productos ?? "[]");
              } catch {
                return [];
              }
            })();
            const p0 = productos[0] ?? {};
            return (
              // Card mobile-first: identificador + estado → info → acción → secundaria.
              // ≥sm: info a la izquierda, estado/acciones alineados a la derecha.
              <div
                key={o.Id_Pedido}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-5"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2 sm:justify-start">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-muted-foreground">
                        AKA-{String(o.Id_Pedido).padStart(4, "0")}
                      </span>
                      {o.Estado !== "entregado" && o.Estado !== "cancelado" && (
                        <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-semibold text-accent">
                          Activo
                        </span>
                      )}
                    </div>
                    {/* Estado: visible junto al ID en móvil */}
                    <span
                      className={`flex-none rounded-md px-2.5 py-1 text-xs font-semibold sm:hidden ${STATUS_COLOR[o.Estado] ?? ""}`}
                    >
                      {STATUS_ES[o.Estado] ?? o.Estado}
                    </span>
                  </div>
                  {p0.alitas && (
                    <div className="font-medium">
                      {p0.alitas} alitas{p0.salsa ? ` · ${p0.salsa}` : ""}
                    </div>
                  )}
                  <div className="flex items-start gap-1 text-sm text-muted-foreground">
                    <MapPin className="mt-1 h-3 w-3 flex-none" />
                    <span className="min-w-0 break-words">{o.Direccion_Destino}</span>
                  </div>
                  {p0.notas && (
                    <div className="break-words text-xs text-muted-foreground">
                      Nota: {p0.notas}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 sm:flex-none sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                  <span
                    className={`hidden rounded-md px-2.5 py-1 text-xs font-semibold sm:inline-block ${STATUS_COLOR[o.Estado] ?? ""}`}
                  >
                    {STATUS_ES[o.Estado] ?? o.Estado}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(o.Creacion_Pedido).toLocaleDateString("es-PE", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  {o.Estado === "sin_asignar" &&
                    (confirmandoCancelar === o.Id_Pedido ? (
                      <div
                        className="flex items-center gap-1.5"
                        role="group"
                        aria-label="Confirmar cancelación"
                      >
                        <span className="text-xs text-muted-foreground">¿Cancelar?</span>
                        <button
                          type="button"
                          onClick={() => cancelar(o.Id_Pedido)}
                          className="min-w-11 rounded-md bg-destructive px-3 text-xs font-semibold text-destructive-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9"
                        >
                          Sí
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmandoCancelar(null)}
                          className="min-w-11 rounded-md border border-border px-3 text-xs font-medium transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmandoCancelar(o.Id_Pedido)}
                        className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-3 text-xs font-medium text-destructive transition hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9"
                      >
                        <XCircle className="h-3 w-3" /> Cancelar
                      </button>
                    ))}
                  {o.Estado === "en_camino" && (
                    <span className="text-xs text-muted-foreground">No cancelable en tránsito</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Seguimiento ─────────────────────────────────────────────────────────

function TabSeguimiento({ customerId: _customerId }: { customerId: string }) {
  const { data: allOrders = [] } = useQuery({
    queryKey: ["mis-pedidos"],
    queryFn: api.listarPedidos.bind(api),
    refetchInterval: 10000,
  });

  const pedidosActivos = useMemo(
    () =>
      allOrders
        .filter((o) => o.Estado !== "entregado" && o.Estado !== "cancelado")
        .sort(
          (a, b) => new Date(b.Creacion_Pedido).getTime() - new Date(a.Creacion_Pedido).getTime(),
        ),
    [allOrders],
  );

  const [codigo, setCodigo] = useState("");
  const [buscado, setBuscado] = useState("");
  const pedidoBuscado = useMemo(
    () =>
      buscado
        ? (allOrders.find(
            (o) =>
              `AKA-${String(o.Id_Pedido).padStart(4, "0")}`.toUpperCase() === buscado.toUpperCase(),
          ) ?? null)
        : null,
    [allOrders, buscado],
  );

  return (
    <div className="space-y-6">
      {/* ── Cabecera ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Seguimiento en tiempo real</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {pedidosActivos.length === 0
              ? "No tienes pedidos activos en este momento."
              : pedidosActivos.length === 1
                ? "Tienes 1 pedido activo."
                : `Tienes ${pedidosActivos.length} pedidos activos.`}
          </p>
        </div>
        {/* Indicador de live */}
        {pedidosActivos.length > 0 && (
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            En vivo
          </div>
        )}
      </div>

      {/* ── Buscador ──────────────────────────────────────────────────────── */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setBuscado(codigo.trim());
        }}
        role="search"
        className="flex gap-2"
      >
        <label htmlFor="buscar-codigo" className="sr-only">
          Buscar pedido por código
        </label>
        <input
          id="buscar-codigo"
          type="search"
          autoCapitalize="characters"
          autoComplete="off"
          value={codigo}
          onChange={(e) => {
            setCodigo(e.target.value);
            if (!e.target.value) setBuscado("");
          }}
          placeholder="Ej: AKA-0001"
          className="h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-3 font-mono text-sm outline-none ring-ring/30 transition focus:border-ring focus:ring-2"
        />
        <button
          type="submit"
          aria-label="Buscar pedido"
          className="inline-flex h-11 flex-none items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-semibold text-accent-foreground transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4"
        >
          <Search className="h-4 w-4" /> <span className="hidden min-[360px]:inline">Buscar</span>
        </button>
        {buscado && (
          <button
            type="button"
            aria-label="Limpiar búsqueda"
            onClick={() => {
              setCodigo("");
              setBuscado("");
            }}
            className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-md border border-border text-sm text-muted-foreground transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      {/* ── Resultado de búsqueda ─────────────────────────────────────────── */}
      {buscado && !pedidoBuscado && (
        <div
          role="status"
          className="break-words rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground sm:p-8"
        >
          No se encontró el pedido <span className="font-mono font-semibold">{buscado}</span>.
        </div>
      )}
      {buscado && pedidoBuscado && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Resultado de búsqueda
          </p>
          <TarjetaSeguimiento order={pedidoBuscado} />
        </div>
      )}

      {/* ── Pedidos activos ───────────────────────────────────────────────── */}
      {!buscado && pedidosActivos.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card px-5 py-10 text-center sm:p-12">
          <PackageCheck className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm text-muted-foreground">
            No tienes pedidos en curso. ¡Haz uno nuevo para rastrear tu entrega!
          </p>
        </div>
      )}

      {!buscado && pedidosActivos.length > 0 && (
        <div className="space-y-6">
          {pedidosActivos.map((order, idx) => (
            <div key={order.Id_Pedido}>
              {pedidosActivos.length > 1 && (
                <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                    {idx + 1}
                  </span>
                  Pedido activo
                </p>
              )}
              <TarjetaSeguimiento order={order} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tarjeta de seguimiento individual ───────────────────────────────────────

function TarjetaSeguimiento({ order }: { order: any }) {
  const productos = (() => {
    try {
      return JSON.parse(order.Productos ?? "[]");
    } catch {
      return [];
    }
  })();
  const p0 = productos[0] ?? {};
  const estado = order.Estado ?? order.status ?? "";
  const orderId = order.Id_Pedido
    ? `AKA-${String(order.Id_Pedido).padStart(4, "0")}`
    : (order.id ?? "");
  const createdAt = order.Creacion_Pedido ?? order.createdAt;
  const assignedAt = order.Asignacion_Pedido ?? null;
  const deliveredAt = order.Entrega_Pedido ?? null;
  const address = order.Direccion_Destino ?? order.address ?? "";
  const coords: [number, number] | undefined =
    order.Lat_Destino != null ? [order.Lat_Destino, order.Lng_Destino] : order.coords;
  const driverNombre = order.Nombre_Repartidor
    ? `${order.Nombre_Repartidor}${order.Apellido_Repartidor ? " " + order.Apellido_Repartidor : ""}`
    : null;

  const currentIndex = STEPS.findIndex((s) => s.key === estado);
  const esActivo = estado !== "entregado" && estado !== "cancelado";

  return (
    <div
      className={`space-y-3 rounded-xl border p-1 ${
        esActivo ? "border-accent/30 bg-accent/[0.03]" : "border-border bg-card"
      }`}
    >
      {/* ── Stepper ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl bg-card p-4 sm:p-5">
        {/* Cabecera */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-mono text-sm font-semibold">{orderId}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(createdAt).toLocaleDateString("es-PE", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {esActivo && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                En curso
              </span>
            )}
            <span
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${STATUS_COLOR[estado] ?? ""}`}
            >
              {STATUS_ES[estado] ?? estado}
            </span>
          </div>
        </div>

        {/* Barra de progreso compacta */}
        <BarraProgreso status={estado} />

        {/* Steps detallados */}
        <ol className="relative mt-5">
          {STEPS.map((step, i) => {
            const done = i <= currentIndex;
            const active = i === currentIndex;
            const Icon = step.icon;
            const esUltimo = i === STEPS.length - 1;
            return (
              <li
                key={step.key}
                className="flex gap-3 pb-5 last:pb-0 sm:gap-4"
                aria-current={active ? "step" : undefined}
              >
                <div className="flex flex-col items-center">
                  <span
                    className={`grid h-9 w-9 flex-none place-items-center rounded-full border-2 transition ${
                      done
                        ? active
                          ? "border-accent bg-accent text-accent-foreground"
                          : "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  {!esUltimo && (
                    <div
                      className={`mt-1 w-0.5 flex-1 ${done && !active ? "bg-primary" : "bg-border"}`}
                    />
                  )}
                </div>
                <div className="min-w-0 pt-1 pb-1">
                  <p
                    className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold ${done ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {step.label}
                    {active && (
                      <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent">
                        Ahora
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{step.sub}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* ── Info del pedido + repartidor ─────────────────────────────────── */}
      <div className="grid gap-3 px-1 sm:grid-cols-2">
        {/* Detalle del pedido */}
        <div className="min-w-0 space-y-1.5 rounded-xl border border-border bg-card p-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tu pedido
          </p>
          {p0.alitas && (
            <p>
              <span className="text-muted-foreground">Alitas: </span>
              <span className="font-medium">{p0.alitas} pzas</span>
            </p>
          )}
          {p0.salsa && (
            <p>
              <span className="text-muted-foreground">Salsa: </span>
              <span className="font-medium">{p0.salsa}</span>
            </p>
          )}
          <div className="flex items-start gap-1.5">
            <MapPin className="mt-0.5 h-3.5 w-3.5 flex-none text-muted-foreground" />
            <span className="min-w-0 break-words leading-snug text-muted-foreground">
              {address}
            </span>
          </div>
          {p0.notas && (
            <p className="break-words rounded-md bg-muted px-3 py-1.5 text-xs">{p0.notas}</p>
          )}
          {/* ETA */}
          <div className="flex items-center gap-1.5 border-t border-border pt-1.5">
            <Timer className="h-3.5 w-3.5 flex-none text-muted-foreground" />
            <span
              className={`text-xs ${estado === "en_camino" ? "font-semibold text-foreground" : "text-muted-foreground"}`}
            >
              {estado === "sin_asignar" || estado === "asignado"
                ? "Calculando tiempo estimado…"
                : estado === "en_camino"
                  ? (() => {
                      const elapsed = assignedAt
                        ? Math.round((Date.now() - new Date(assignedAt).getTime()) / 60000)
                        : 0;
                      const eta = Math.max(1, 20 - elapsed);
                      return `ETA: ~${eta} min`;
                    })()
                  : estado === "entregado" && deliveredAt && assignedAt
                    ? `Entregado en ${Math.round((new Date(deliveredAt).getTime() - new Date(assignedAt).getTime()) / 60000)} min`
                    : "—"}
            </span>
          </div>
        </div>

        {/* Repartidor */}
        <div className="min-w-0 rounded-xl border border-border bg-card p-4 text-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Repartidor
          </p>
          {driverNombre ? (
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-12 w-12 flex-none place-items-center rounded-full bg-accent/15 text-base font-bold text-accent">
                {driverNombre
                  .split(" ")
                  .map((n: string) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="break-words font-medium">{driverNombre}</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-4 text-muted-foreground">
              <Truck className="h-8 w-8 opacity-30" />
              <p className="text-xs">Asignando repartidor…</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Mini-mapa cuando está en camino ─────────────────────────────── */}
      {estado === "en_camino" && coords && (
        // isolate: los z-index de Leaflet quedan contenidos y no tapan el header sticky
        <div className="isolate mx-1 mb-1 overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3 sm:px-5">
            <Truck className="h-4 w-4 flex-none text-accent" />
            <span className="min-w-0 text-sm font-medium">Tu repartidor está en camino</span>
            <span className="ml-auto flex-none rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              En ruta
            </span>
          </div>
          <MapaRuta
            origen={DIR_RESTAURANTE}
            coordsOrigen={COORDS_RESTAURANTE}
            destino={address}
            coordsDestino={coords}
            altura="clamp(240px, 45svh, 380px)"
          />
        </div>
      )}
    </div>
  );
}

// ─── Tab: Mi Perfil ───────────────────────────────────────────────────────────

function TabPerfil({ customerId: _customerId }: { customerId: string }) {
  const { data: perfil, isLoading: perfilCargando } = useQuery({
    queryKey: ["perfil"],
    queryFn: api.perfil.bind(api),
  });

  const [guardado, setGuardado] = useState(false);
  const [errorPerfil, setErrorPerfil] = useState<string | null>(null);
  const [passActual, setPassActual] = useState("");
  const [passNuevo, setPassNuevo] = useState("");
  const [passConfirm, setPassConfirm] = useState("");
  const [passError, setPassError] = useState("");
  const [passOk, setPassOk] = useState(false);
  const [passLoading, setPassLoading] = useState(false);

  const [nombre, setNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [celular, setCelular] = useState("");
  const [numeroDoc, setNumeroDoc] = useState("");
  const [tipoDoc, setTipoDoc] = useState<TipoDocumento | "">("");

  // Poblar formulario cuando llegan los datos del backend
  useEffect(() => {
    if (!perfil) return;
    setNombre(perfil.Nombre_Usuario ?? "");
    setApellidos(perfil.Apellido_Usuario ?? "");
    setCelular(perfil.Telf_Usuario ?? "");
    setNumeroDoc(perfil.DNI_Usuario ?? "");
  }, [perfil]);

  async function handleCambiarPass(e: FormEvent) {
    e.preventDefault();
    setPassError("");
    if (passNuevo.length < 8) {
      setPassError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (passNuevo !== passConfirm) {
      setPassError("Las contraseñas no coinciden.");
      return;
    }
    setPassLoading(true);
    try {
      await api.cambiarPassword(passActual, passNuevo);
      setPassOk(true);
      setPassActual("");
      setPassNuevo("");
      setPassConfirm("");
      setTimeout(() => setPassOk(false), 3000);
    } catch (err: unknown) {
      const codigo = (err as { codigo?: string })?.codigo;
      setPassError(
        codigo === "password_incorrecto"
          ? "La contraseña actual es incorrecta."
          : "Error al cambiar la contraseña.",
      );
    } finally {
      setPassLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorPerfil(null);
    try {
      await api.actualizarPerfil({
        nombre: nombre.trim() || undefined,
        apellido: apellidos.trim() || undefined,
        telefono: celular.trim() || undefined,
        dni: numeroDoc.trim() || undefined,
      });
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2500);
    } catch {
      setErrorPerfil("No se pudo guardar. Intenta de nuevo.");
    }
  }

  if (perfilCargando) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Cargando perfil…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Mis datos personales</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Mantén tus datos actualizados para que tus pedidos lleguen sin problemas.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-xl border border-border bg-card p-4 sm:p-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="p-nombre" className="text-sm font-medium">
              Nombres <span className="text-destructive">*</span>
            </label>
            <input
              id="p-nombre"
              type="text"
              required
              maxLength={80}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={clsInput}
              placeholder="Juan"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="p-apellidos" className="text-sm font-medium">
              Apellidos
            </label>
            <input
              id="p-apellidos"
              type="text"
              maxLength={80}
              value={apellidos}
              onChange={(e) => setApellidos(e.target.value)}
              className={clsInput}
              placeholder="Pérez García"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="p-celular" className="text-sm font-medium">
              Número de celular
            </label>
            <input
              id="p-celular"
              type="tel"
              maxLength={20}
              value={celular}
              onChange={(e) => setCelular(e.target.value)}
              className={clsInput}
              placeholder="+51 999 999 999"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="p-email" className="text-sm font-medium">
              Correo electrónico
            </label>
            <input
              id="p-email"
              type="email"
              disabled
              value={perfil?.Email_Usuario ?? ""}
              className={`${clsInput} cursor-not-allowed opacity-60`}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="p-tipo-doc" className="text-sm font-medium">
              Tipo de documento
            </label>
            <select
              id="p-tipo-doc"
              value={tipoDoc}
              onChange={(e) => setTipoDoc(e.target.value as TipoDocumento | "")}
              className={clsInput}
            >
              <option value="">Seleccionar…</option>
              {TIPOS_DOCUMENTO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="p-num-doc" className="text-sm font-medium">
              Número de documento
            </label>
            <input
              id="p-num-doc"
              type="text"
              maxLength={20}
              value={numeroDoc}
              onChange={(e) => setNumeroDoc(e.target.value)}
              className={clsInput}
              placeholder="12345678"
            />
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          {guardado && (
            <span
              role="status"
              className="text-sm font-medium text-emerald-600 dark:text-emerald-400"
            >
              ✓ Datos guardados correctamente
            </span>
          )}
          {errorPerfil && (
            <span className="text-sm font-medium text-destructive" role="alert">
              {errorPerfil}
            </span>
          )}
          <button
            type="submit"
            className="min-h-11 w-full rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:ml-auto sm:w-auto"
          >
            Guardar cambios
          </button>
        </div>
      </form>

      {/* Cambiar contraseña */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Cambiar contraseña</h2>
        </div>
        <form
          onSubmit={handleCambiarPass}
          className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6"
        >
          <div className="space-y-1.5">
            <label htmlFor="pass-actual" className="text-sm font-medium">
              Contraseña actual
            </label>
            <input
              id="pass-actual"
              type="password"
              required
              maxLength={120}
              autoComplete="current-password"
              value={passActual}
              onChange={(e) => setPassActual(e.target.value)}
              className={clsInput}
              placeholder="••••••••"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="pass-nuevo" className="text-sm font-medium">
                Nueva contraseña
              </label>
              <input
                id="pass-nuevo"
                type="password"
                required
                minLength={8}
                maxLength={100}
                autoComplete="new-password"
                value={passNuevo}
                onChange={(e) => setPassNuevo(e.target.value)}
                className={clsInput}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="pass-confirm" className="text-sm font-medium">
                Confirmar contraseña
              </label>
              <input
                id="pass-confirm"
                type="password"
                required
                maxLength={100}
                autoComplete="new-password"
                value={passConfirm}
                onChange={(e) => setPassConfirm(e.target.value)}
                aria-invalid={!!passConfirm && passNuevo !== passConfirm}
                className={`${clsInput} ${passConfirm && passNuevo !== passConfirm ? "border-destructive" : ""}`}
                placeholder="Repite la contraseña"
              />
            </div>
          </div>
          {passError && (
            <p role="alert" className="text-sm text-destructive">
              {passError}
            </p>
          )}
          {passOk && (
            <p role="status" className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              ✓ Contraseña actualizada correctamente
            </p>
          )}
          <div className="flex sm:justify-end">
            <button
              type="submit"
              disabled={passLoading}
              className="min-h-11 w-full rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 sm:w-auto"
            >
              {passLoading ? "Guardando…" : "Actualizar contraseña"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Componente auxiliar: barra de progreso compacta ─────────────────────────

function BarraProgreso({ status }: { status: string }) {
  const idx = STEPS.findIndex((s) => s.key === status);
  return (
    <div className="flex items-center gap-1">
      {STEPS.map((step, i) => (
        <div key={step.key} className="flex flex-1 items-center gap-1">
          <div
            className={`h-2 flex-1 rounded-full transition-all ${i <= idx ? "bg-accent" : "bg-muted"}`}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Helpers visuales ─────────────────────────────────────────────────────────

const clsInput =
  "h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring/30 transition focus:border-ring focus:ring-2";
const clsBtnSec =
  "min-h-11 rounded-md border border-border bg-background px-4 py-2.5 text-sm font-medium transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

function TabBtn({
  active,
  onClick,
  icon,
  label,
  labelCorto,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  /** Etiqueta abreviada para móvil (evita depender solo del icono) */
  labelCorto: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-label={label}
      onClick={onClick}
      className={`flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:gap-2 sm:py-2.5 sm:text-sm ${
        active
          ? "bg-accent text-accent-foreground shadow-[var(--shadow-card)]"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      <span className="max-w-full truncate sm:hidden">{labelCorto}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
