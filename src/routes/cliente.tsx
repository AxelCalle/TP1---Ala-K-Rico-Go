import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Bell, BellRing, ChefHat, ClipboardList, KeyRound, LogOut, Map, MapPin,
  PackageCheck, Phone, Plus, Search, ShoppingBag, Timer,
  Truck, User, UtensilsCrossed, X, XCircle,
} from "lucide-react";
import { LogoIcon } from "../components/Logo";
import { store, useStore, SAUCES, TIPOS_DOCUMENTO, type Sauce, type TipoDocumento } from "@/lib/store";
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
  asignado:    "En preparación",
  en_camino:   "En camino",
  entregado:   "Entregado",
  cancelado:   "Cancelado",
};

const STATUS_COLOR: Record<string, string> = {
  sin_asignar: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  asignado:    "bg-accent/20 text-accent-foreground",
  en_camino:   "bg-primary text-primary-foreground",
  entregado:   "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  cancelado:   "bg-destructive/15 text-destructive",
};

const STEPS = [
  { key: "sin_asignar", label: "Pedido recibido",  sub: "Tu pedido fue registrado",         icon: ClipboardList },
  { key: "asignado",    label: "En preparación",   sub: "Estamos preparando tus alitas",     icon: ChefHat },
  { key: "en_camino",   label: "En camino",         sub: "Tu repartidor está en ruta",        icon: Truck },
  { key: "entregado",   label: "Entregado",          sub: "¡Disfruta tus alitas!",             icon: PackageCheck },
] as const;

const COORDS_RESTAURANTE = RESTAURANTE_COORDS;
const DIR_RESTAURANTE = RESTAURANTE_DIRECCION;

// ─── Página principal ─────────────────────────────────────────────────────────

function ClientePage() {
  const navigate = useNavigate();
  const session  = useStore((s) => s.session);
  const customer = useStore((s) => s.customers.find((c) => c.id === s.session?.customerId));
  const qcPage = useQueryClient();
  const { data: misNotifs = [] } = useQuery({
    queryKey: ["notificaciones"],
    queryFn: api.listarNotificaciones.bind(api),
    refetchInterval: 30000,
    enabled: !!session,
  });
  const [tab, setTab]                 = useState<Tab>("pedidos");
  const [modalPedido, setModalPedido] = useState(false);
  const [montado, setMontado]         = useState(false);
  const [mostrarNotifs, setMostrarNotifs] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Marcar como montado (solo en el cliente, nunca en SSR)
  useEffect(() => { setMontado(true); }, []);

  // Cerrar dropdown de notificaciones al hacer clic fuera
  useEffect(() => {
    if (!mostrarNotifs) return;
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setMostrarNotifs(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mostrarNotifs]);

  // Redirigir si no hay sesión de cliente (solo después de montar)
  useEffect(() => {
    if (montado && (!session || session.role !== "customer")) {
      navigate({ to: "/login" });
    }
  }, [session, navigate, montado]);

  // SSR y primer render del cliente devuelven null para evitar mismatch de hidratación
  if (!montado || !session || session.role !== "customer") return null;

  const nombre = customer ? `${customer.name}${customer.apellidos ? " " + customer.apellidos : ""}` : session.email;

  const noLeidas = misNotifs.filter((n) => !n.Leida).length;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <LogoIcon size={28} />
            <span className="hidden text-lg font-semibold tracking-tight sm:inline">Ala K' Rico GO</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Botón principal: hacer pedido */}
            <button
              onClick={() => setModalPedido(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground transition hover:brightness-105"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Hacer pedido</span>
            </button>
            <span className="hidden text-sm text-muted-foreground sm:inline">
              Hola, <span className="font-medium text-foreground">{nombre.split(" ")[0]}</span>
            </span>
            {/* Campana de notificaciones */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={async () => {
                  setMostrarNotifs((v) => !v);
                  if (!mostrarNotifs && noLeidas > 0) {
                    try { await api.marcarTodasLeidas(); } catch { /* ignore */ }
                    qcPage.invalidateQueries({ queryKey: ["notificaciones"] });
                  }
                }}
                className="relative inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                title="Notificaciones"
              >
                {noLeidas > 0 ? <BellRing className="h-5 w-5 text-accent-foreground" /> : <Bell className="h-5 w-5" />}
                {noLeidas > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground">
                    {noLeidas > 9 ? "9+" : noLeidas}
                  </span>
                )}
              </button>
              {mostrarNotifs && (
                <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-border bg-card shadow-[var(--shadow-elegant)]">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <span className="text-sm font-semibold">Notificaciones</span>
                    <button onClick={() => setMostrarNotifs(false)} className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {misNotifs.length === 0 ? (
                      <p className="px-4 py-8 text-center text-sm text-muted-foreground">Sin notificaciones</p>
                    ) : (
                      misNotifs.slice(0, 15).map((n) => (
                        <div
                          key={n.Id_Notificacion}
                          className={`flex items-start gap-3 px-4 py-3 text-sm transition ${n.Leida ? "opacity-60" : "bg-accent/5"}`}
                        >
                          <span className="mt-0.5 text-base leading-none">
                            {n.Tipo === "entregado" ? "🎉"
                              : n.Tipo === "pedido_en_camino" ? "🛵"
                              : n.Tipo === "cancelado" ? "❌"
                              : n.Tipo === "asignado" ? "🍗"
                              : "ℹ️"}
                          </span>
                          <div className="flex-1">
                            <p>{n.Mensaje}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {new Date(n.Creacion).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
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
              onClick={() => { store.logout(); navigate({ to: "/" }); }}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Tabs */}
        <div className="mb-5 flex gap-1 rounded-xl border border-border bg-card p-1 sm:mb-8">
          <TabBtn active={tab === "pedidos"}      onClick={() => setTab("pedidos")}      icon={<ShoppingBag className="h-4 w-4" />}  label="Mis Pedidos" />
          <TabBtn active={tab === "seguimiento"}  onClick={() => setTab("seguimiento")}  icon={<MapPin className="h-4 w-4" />}       label="Seguimiento" />
          <TabBtn active={tab === "perfil"}       onClick={() => setTab("perfil")}       icon={<User className="h-4 w-4" />}         label="Mi Perfil" />
        </div>

        {tab === "pedidos"     && <TabPedidos    customerId={session.customerId!} onNuevoPedido={() => setModalPedido(true)} />}
        {tab === "seguimiento" && <TabSeguimiento customerId={session.customerId!} />}
        {tab === "perfil"      && <TabPerfil     customerId={session.customerId!} />}
      </main>

      {/* Modal: nuevo pedido */}
      {modalPedido && (
        <ModalNuevoPedido
          customer={customer}
          customerId={session.customerId!}
          onClose={() => setModalPedido(false)}
          onCreado={() => { setModalPedido(false); setTab("seguimiento"); }}
        />
      )}

      <footer className="mt-auto border-t border-border bg-card">
        <div className="mx-auto flex max-w-4xl flex-col gap-1 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
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
  const [direccion,     setDireccion]     = useState(customer?.address ?? "");
  const [telefono,      setTelefono]      = useState(customer?.phone   ?? "");
  const [alitas,        setAlitas]        = useState(12);
  const [salsa,         setSalsa]         = useState<Sauce>("Buffalo");
  const [notas,         setNotas]         = useState("");
  const [enviando,      setEnviando]      = useState(false);
  const [error,         setError]         = useState("");
  const qcModal = useQueryClient();

  // Estado del selector de mapa
  const [mostrarMapa,   setMostrarMapa]   = useState(false);
  const [coordsPin,     setCoordsPin]     = useState<[number, number] | null>(null);

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
    if (!direccion.trim()) { setError("Ingresa la dirección de entrega."); return; }
    setError("");
    setEnviando(true);

    // Si el cliente fijó el pin, usamos esas coords exactas; si no, geocodificamos el texto
    const coords = coordsPin ?? await geocodificarDireccion(direccion.trim());
    if (!coords) {
      setError("No se pudo ubicar la dirección. Intenta seleccionarla en el mapa.");
      setEnviando(false);
      return;
    }

    try {
      await api.crearPedido({
        latDestino:        coords[0],
        lngDestino:        coords[1],
        direccionDestino:  direccion.trim().slice(0, 300),
        productos: [{ alitas: Math.min(200, Math.max(1, alitas)), salsa, notas: notas.trim().slice(0, 200) || undefined }],
        latOrigen:  RESTAURANTE_COORDS[0],
        lngOrigen:  RESTAURANTE_COORDS[1],
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
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 py-8"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-card shadow-[var(--shadow-elegant)]">
        {/* ── Cabecera fija ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent-foreground">
              <UtensilsCrossed className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Hacer un pedido</h2>
              <p className="text-sm text-muted-foreground">Elige tu salsa y punto de entrega.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Cuerpo con scroll ──────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="space-y-5 p-6">

          {/* Cantidad + Salsa */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Cantidad de alitas</label>
              <input
                type="number" required min={6} max={200} step={6}
                value={alitas}
                onChange={(e) => setAlitas(parseInt(e.target.value || "6", 10))}
                className={clsInput}
              />
              <p className="text-xs text-muted-foreground">Mínimo 6, en múltiplos de 6</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Salsa</label>
              <select
                value={salsa}
                onChange={(e) => setSalsa(e.target.value as Sauce)}
                className={clsInput}
              >
                {SAUCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* ── Dirección de entrega ─────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Dirección de entrega <span className="text-destructive">*</span>
              </label>
              {/* Botón para abrir/cerrar el mapa */}
              <button
                type="button"
                onClick={() => setMostrarMapa((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                  mostrarMapa
                    ? "bg-accent/20 text-accent-foreground"
                    : "border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Map className="h-3.5 w-3.5" />
                {mostrarMapa ? "Ocultar mapa" : "Seleccionar en mapa"}
              </button>
            </div>

            {/* Campo de texto */}
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text" required maxLength={200}
                value={direccion}
                onChange={(e) => handleCambioDireccion(e.target.value)}
                className={`${clsInput} pl-9 ${coordsPin ? "border-accent/60 bg-accent/5" : ""}`}
                placeholder="Jr. Ejemplo 123, San Martín de Porres, Lima"
              />
              {/* Badge "pin fijado" */}
              {coordsPin && (
                <button
                  type="button"
                  onClick={() => setCoordsPin(null)}
                  title="Quitar pin del mapa"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent-foreground transition hover:bg-destructive/20 hover:text-destructive"
                >
                  📍 Mapa ×
                </button>
              )}
            </div>

            {/* Mapa interactivo (desplegable) */}
            {mostrarMapa && (
              <div className="overflow-hidden rounded-xl border border-accent/30">
                <div className="flex items-center gap-2 bg-accent/10 px-3 py-2">
                  <MapPin className="h-3.5 w-3.5 text-accent-foreground" />
                  <p className="text-xs font-medium text-accent-foreground">
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
            <label className="text-sm font-medium">Teléfono de contacto</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="tel" maxLength={20}
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className={`${clsInput} pl-9`}
                placeholder="+51 999 999 999"
              />
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Notas <span className="text-xs text-muted-foreground">(opcional)</span>
            </label>
            <input
              type="text" maxLength={200}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className={clsInput}
              placeholder="Sin picante extra, ranch aparte…"
            />
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          {/* Resumen */}
          <div className="rounded-xl bg-muted/50 px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{alitas} alitas · {salsa}</span>
              <div className="flex items-center gap-2">
                {coordsPin && (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                    📍 Ubicación exacta
                  </span>
                )}
                <span className="font-semibold text-accent-foreground">
                  {enviando ? "Procesando…" : "Listo para pedir"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className={clsBtnSec} disabled={enviando}>
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="flex-1 rounded-md bg-accent py-2.5 text-sm font-semibold text-accent-foreground transition hover:brightness-105 disabled:opacity-60"
            >
              {enviando
                ? coordsPin ? "Registrando pedido…" : "Verificando dirección…"
                : "Confirmar pedido"}
            </button>
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
    try { await api.cambiarEstadoPedido(id, "cancelado"); } catch { /* ignore */ }
    qc.invalidateQueries({ queryKey: ["mis-pedidos"] });
    setConfirmandoCancelar(null);
  }

  if (isLoading) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Cargando pedidos…</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-14 text-center">
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
        <div className="rounded-xl border-2 border-accent/40 bg-accent/5 p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-accent-foreground">
              Pedido en curso
            </span>
            <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${STATUS_COLOR[activo.Estado] ?? ""}`}>
              {STATUS_ES[activo.Estado] ?? activo.Estado}
            </span>
          </div>
          <BarraProgreso status={activo.Estado} />
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="font-mono text-xs text-muted-foreground">
              AKA-{String(activo.Id_Pedido).padStart(4, "0")} · {activo.Direccion_Destino}
            </span>
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-base font-semibold text-muted-foreground">
          Historial ({orders.length})
        </h2>
        <div className="space-y-3">
          {orders.map((o) => {
            const productos = (() => { try { return JSON.parse(o.Productos ?? "[]"); } catch { return []; } })();
            const p0 = productos[0] ?? {};
            return (
              <div
                key={o.Id_Pedido}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      AKA-{String(o.Id_Pedido).padStart(4, "0")}
                    </span>
                    {o.Estado !== "entregado" && o.Estado !== "cancelado" && (
                      <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                        Activo
                      </span>
                    )}
                  </div>
                  {p0.alitas && <div className="font-medium">{p0.alitas} alitas{p0.salsa ? ` · ${p0.salsa}` : ""}</div>}
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3 flex-none" />
                    {o.Direccion_Destino}
                  </div>
                  {p0.notas && <div className="text-xs text-muted-foreground">Nota: {p0.notas}</div>}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${STATUS_COLOR[o.Estado] ?? ""}`}>
                    {STATUS_ES[o.Estado] ?? o.Estado}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(o.Creacion_Pedido).toLocaleDateString("es-PE", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                  </span>
                  {o.Estado === "sin_asignar" && (
                    confirmandoCancelar === o.Id_Pedido ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">¿Cancelar?</span>
                        <button
                          onClick={() => cancelar(o.Id_Pedido)}
                          className="rounded-md bg-destructive px-2.5 py-1 text-xs font-semibold text-destructive-foreground transition hover:opacity-90"
                        >
                          Sí
                        </button>
                        <button
                          onClick={() => setConfirmandoCancelar(null)}
                          className="rounded-md border border-border px-2.5 py-1 text-xs font-medium transition hover:bg-secondary"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmandoCancelar(o.Id_Pedido)}
                        className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2.5 py-1 text-xs font-medium text-destructive transition hover:bg-destructive/10"
                      >
                        <XCircle className="h-3 w-3" /> Cancelar
                      </button>
                    )
                  )}
                  {o.Estado === "en_camino" && (
                    <span className="text-[10px] text-muted-foreground">No cancelable en tránsito</span>
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
    () => allOrders
      .filter((o) => o.Estado !== "entregado" && o.Estado !== "cancelado")
      .sort((a, b) => new Date(b.Creacion_Pedido).getTime() - new Date(a.Creacion_Pedido).getTime()),
    [allOrders],
  );

  const [codigo,  setCodigo]  = useState("");
  const [buscado, setBuscado] = useState("");
  const pedidoBuscado = useMemo(
    () => buscado
      ? (allOrders.find(
          (o) => `AKA-${String(o.Id_Pedido).padStart(4, "0")}`.toUpperCase() === buscado.toUpperCase()
        ) ?? null)
      : null,
    [allOrders, buscado],
  );

  return (
    <div className="space-y-6">

      {/* ── Cabecera ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
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
        onSubmit={(e) => { e.preventDefault(); setBuscado(codigo.trim()); }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={codigo}
          onChange={(e) => { setCodigo(e.target.value); if (!e.target.value) setBuscado(""); }}
          placeholder="Buscar por código  Ej: AKA-0001"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2.5 font-mono text-sm outline-none ring-ring/30 transition focus:border-ring focus:ring-2"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:brightness-105"
        >
          <Search className="h-4 w-4" /> Buscar
        </button>
        {buscado && (
          <button
            type="button"
            onClick={() => { setCodigo(""); setBuscado(""); }}
            className="rounded-md border border-border px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      {/* ── Resultado de búsqueda ─────────────────────────────────────────── */}
      {buscado && !pedidoBuscado && (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No se encontró el pedido{" "}
          <span className="font-mono font-semibold">{buscado}</span>.
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
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
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
  const productos = (() => { try { return JSON.parse(order.Productos ?? "[]"); } catch { return []; } })();
  const p0        = productos[0] ?? {};
  const estado    = order.Estado ?? order.status ?? "";
  const orderId   = order.Id_Pedido
    ? `AKA-${String(order.Id_Pedido).padStart(4, "0")}`
    : (order.id ?? "");
  const createdAt  = order.Creacion_Pedido ?? order.createdAt;
  const assignedAt = order.Asignacion_Pedido ?? null;
  const deliveredAt = order.Entrega_Pedido ?? null;
  const address    = order.Direccion_Destino ?? order.address ?? "";
  const coords: [number, number] | undefined = order.Lat_Destino != null
    ? [order.Lat_Destino, order.Lng_Destino]
    : order.coords;
  const driverNombre = order.Nombre_Repartidor
    ? `${order.Nombre_Repartidor}${order.Apellido_Repartidor ? " " + order.Apellido_Repartidor : ""}`
    : null;

  const currentIndex = STEPS.findIndex((s) => s.key === estado);
  const esActivo     = estado !== "entregado" && estado !== "cancelado";

  return (
    <div className={`space-y-3 rounded-xl border p-1 ${
      esActivo ? "border-accent/30 bg-accent/[0.03]" : "border-border bg-card"
    }`}>

      {/* ── Stepper ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl bg-card p-5">
        {/* Cabecera */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold">{orderId}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(createdAt).toLocaleDateString("es-PE", {
                day: "2-digit", month: "short", year: "numeric",
                hour: "2-digit", minute: "2-digit",
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
            <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${STATUS_COLOR[estado] ?? ""}`}>
              {STATUS_ES[estado] ?? estado}
            </span>
          </div>
        </div>

        {/* Barra de progreso compacta */}
        <BarraProgreso status={estado} />

        {/* Steps detallados */}
        <ol className="relative mt-5">
          {STEPS.map((step, i) => {
            const done     = i <= currentIndex;
            const active   = i === currentIndex;
            const Icon     = step.icon;
            const esUltimo = i === STEPS.length - 1;
            return (
              <li key={step.key} className="flex gap-4 pb-5 last:pb-0">
                <div className="flex flex-col items-center">
                  <span className={`grid h-9 w-9 flex-none place-items-center rounded-full border-2 transition ${
                    done
                      ? active
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground"
                  }`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  {!esUltimo && (
                    <div className={`mt-1 w-0.5 flex-1 ${done && !active ? "bg-primary" : "bg-border"}`} />
                  )}
                </div>
                <div className="pt-1 pb-1">
                  <p className={`text-sm font-semibold ${done ? "text-foreground" : "text-muted-foreground"}`}>
                    {step.label}
                    {active && (
                      <span className="ml-2 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">
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
        <div className="rounded-xl border border-border bg-card p-4 space-y-1.5 text-sm">
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
            <span className="text-muted-foreground leading-snug">{address}</span>
          </div>
          {p0.notas && (
            <p className="rounded-md bg-muted px-3 py-1.5 text-xs">{p0.notas}</p>
          )}
          {/* ETA */}
          <div className="flex items-center gap-1.5 border-t border-border pt-1.5">
            <Timer className="h-3.5 w-3.5 flex-none text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {estado === "sin_asignar" || estado === "asignado"
                ? "Calculando tiempo estimado…"
                : estado === "en_camino"
                ? (() => {
                    const elapsed = assignedAt ? Math.round((Date.now() - new Date(assignedAt).getTime()) / 60000) : 0;
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
        <div className="rounded-xl border border-border bg-card p-4 text-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Repartidor
          </p>
          {driverNombre ? (
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 flex-none place-items-center rounded-full bg-accent/15 text-base font-bold text-accent-foreground">
                {driverNombre.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
              </span>
              <div>
                <p className="font-medium">{driverNombre}</p>
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
        <div className="overflow-hidden rounded-xl border border-border bg-card mx-1 mb-1">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3">
            <Truck className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium">Tu repartidor está en camino</span>
            <span className="ml-auto rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              En ruta
            </span>
          </div>
          <MapaRuta
            origen={DIR_RESTAURANTE}
            coordsOrigen={COORDS_RESTAURANTE}
            destino={address}
            coordsDestino={coords}
            altura={260}
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

  const [guardado,    setGuardado]    = useState(false);
  const [errorPerfil, setErrorPerfil] = useState<string | null>(null);
  const [passActual,  setPassActual]  = useState("");
  const [passNuevo,   setPassNuevo]   = useState("");
  const [passConfirm, setPassConfirm] = useState("");
  const [passError,   setPassError]   = useState("");
  const [passOk,      setPassOk]      = useState(false);
  const [passLoading, setPassLoading] = useState(false);

  const [nombre,    setNombre]    = useState("");
  const [apellidos, setApellidos] = useState("");
  const [celular,   setCelular]   = useState("");
  const [numeroDoc, setNumeroDoc] = useState("");
  const [tipoDoc,   setTipoDoc]   = useState<TipoDocumento | "">("");

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
    if (passNuevo.length < 6) { setPassError("La contraseña debe tener al menos 6 caracteres."); return; }
    if (passNuevo !== passConfirm) { setPassError("Las contraseñas no coinciden."); return; }
    setPassLoading(true);
    try {
      await api.cambiarPassword(passActual, passNuevo);
      setPassOk(true);
      setPassActual(""); setPassNuevo(""); setPassConfirm("");
      setTimeout(() => setPassOk(false), 3000);
    } catch (err: unknown) {
      const codigo = (err as { codigo?: string })?.codigo;
      setPassError(codigo === "password_incorrecto" ? "La contraseña actual es incorrecta." : "Error al cambiar la contraseña.");
    } finally {
      setPassLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorPerfil(null);
    try {
      await api.actualizarPerfil({
        nombre:   nombre.trim()    || undefined,
        apellido: apellidos.trim() || undefined,
        telefono: celular.trim()   || undefined,
        dni:      numeroDoc.trim() || undefined,
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

      <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="p-nombre" className="text-sm font-medium">
              Nombres <span className="text-destructive">*</span>
            </label>
            <input id="p-nombre" type="text" required maxLength={80}
              value={nombre} onChange={(e) => setNombre(e.target.value)} className={clsInput} placeholder="Juan" />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="p-apellidos" className="text-sm font-medium">Apellidos</label>
            <input id="p-apellidos" type="text" maxLength={80}
              value={apellidos} onChange={(e) => setApellidos(e.target.value)} className={clsInput} placeholder="Pérez García" />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="p-celular" className="text-sm font-medium">Número de celular</label>
            <input id="p-celular" type="tel" maxLength={20}
              value={celular} onChange={(e) => setCelular(e.target.value)} className={clsInput} placeholder="+51 999 999 999" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Correo electrónico</label>
            <input type="email" disabled value={perfil?.Email_Usuario ?? ""}
              className={`${clsInput} cursor-not-allowed opacity-60`} />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="p-tipo-doc" className="text-sm font-medium">Tipo de documento</label>
            <select id="p-tipo-doc" value={tipoDoc}
              onChange={(e) => setTipoDoc(e.target.value as TipoDocumento | "")} className={clsInput}>
              <option value="">Seleccionar…</option>
              {TIPOS_DOCUMENTO.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="p-num-doc" className="text-sm font-medium">Número de documento</label>
            <input id="p-num-doc" type="text" maxLength={20}
              value={numeroDoc} onChange={(e) => setNumeroDoc(e.target.value)} className={clsInput} placeholder="12345678" />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          {guardado && (
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">✓ Datos guardados correctamente</span>
          )}
          {errorPerfil && (
            <span className="text-sm font-medium text-destructive" role="alert">{errorPerfil}</span>
          )}
          <button type="submit" className="ml-auto rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition hover:brightness-105">
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
        <form onSubmit={handleCambiarPass} className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="pass-actual" className="text-sm font-medium">Contraseña actual</label>
            <input id="pass-actual" type="password" required maxLength={120} autoComplete="current-password"
              value={passActual} onChange={(e) => setPassActual(e.target.value)} className={clsInput} placeholder="••••••••" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="pass-nuevo" className="text-sm font-medium">Nueva contraseña</label>
              <input id="pass-nuevo" type="password" required minLength={6} maxLength={120} autoComplete="new-password"
                value={passNuevo} onChange={(e) => setPassNuevo(e.target.value)} className={clsInput} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="pass-confirm" className="text-sm font-medium">Confirmar contraseña</label>
              <input id="pass-confirm" type="password" required maxLength={120} autoComplete="new-password"
                value={passConfirm} onChange={(e) => setPassConfirm(e.target.value)}
                className={`${clsInput} ${passConfirm && passNuevo !== passConfirm ? "border-destructive" : ""}`}
                placeholder="Repite la contraseña" />
            </div>
          </div>
          {passError && <p className="text-sm text-destructive">{passError}</p>}
          {passOk    && <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">✓ Contraseña actualizada correctamente</p>}
          <div className="flex justify-end">
            <button type="submit" disabled={passLoading}
              className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition hover:brightness-105 disabled:opacity-60">
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
          <div className={`h-2 flex-1 rounded-full transition-all ${i <= idx ? "bg-accent" : "bg-muted"}`} />
        </div>
      ))}
    </div>
  );
}

// ─── Helpers visuales ─────────────────────────────────────────────────────────

const clsInput =
  "w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none ring-ring/30 transition focus:border-ring focus:ring-2";
const clsBtnSec =
  "rounded-md border border-border bg-background px-4 py-2.5 text-sm font-medium transition hover:bg-secondary";

function TabBtn({
  active, onClick, icon, label,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition ${
        active
          ? "bg-accent text-accent-foreground shadow-[var(--shadow-card)]"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon} <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
