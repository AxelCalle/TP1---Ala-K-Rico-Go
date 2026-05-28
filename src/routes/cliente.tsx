import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ChefHat, ClipboardList, Drumstick, LogOut, Map, MapPin,
  PackageCheck, Phone, Plus, Search, ShoppingBag,
  Truck, User, UtensilsCrossed, X,
} from "lucide-react";
import { store, useStore, SAUCES, TIPOS_DOCUMENTO, type Sauce, type TipoDocumento } from "@/lib/store";
import { MapaRuta } from "@/components/MapaRuta";
import { MapaSelectorUbicacion } from "@/components/MapaSelectorUbicacion";

export const Route = createFileRoute("/cliente")({
  head: () => ({
    meta: [{ title: "Mi cuenta — Ala K' Rico GO" }],
  }),
  component: ClientePage,
});

type Tab = "pedidos" | "seguimiento" | "perfil";

// ─── Constantes de estado ─────────────────────────────────────────────────────

const STATUS_ES: Record<string, string> = {
  sin_asignar: "Pedido recibido",
  asignado:    "En preparación",
  en_camino:   "En camino",
  entregado:   "Entregado",
};

const STATUS_COLOR: Record<string, string> = {
  sin_asignar: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  asignado:    "bg-accent/20 text-accent-foreground",
  en_camino:   "bg-primary text-primary-foreground",
  entregado:   "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

const STEPS = [
  { key: "sin_asignar", label: "Pedido recibido",  sub: "Tu pedido fue registrado",         icon: ClipboardList },
  { key: "asignado",    label: "En preparación",   sub: "Estamos preparando tus alitas",     icon: ChefHat },
  { key: "en_camino",   label: "En camino",         sub: "Tu repartidor está en ruta",        icon: Truck },
  { key: "entregado",   label: "Entregado",          sub: "¡Disfruta tus alitas!",             icon: PackageCheck },
] as const;

const COORDS_RESTAURANTE: [number, number] = [-12.0278455, -77.0895871];
const DIR_RESTAURANTE = "Jr. Áncash 3855, San Martín de Porres 15101 Lima Perú";

// ─── Geocodificación al crear pedido ─────────────────────────────────────────

async function geocodificarDireccion(dir: string): Promise<[number, number] | undefined> {
  const base = dir.toLowerCase().includes("peru") || dir.toLowerCase().includes("perú")
    ? dir : `${dir}, Lima, Peru`;
  const sinNum = dir.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\b\d{4,5}\b/g, "").replace(/,\s*,/g, ",").trim();

  for (const q of [base, `${sinNum}, Lima, Peru`]) {
    try {
      const params = new URLSearchParams({ q, format: "json", limit: "1", countrycodes: "pe" });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { "Accept-Language": "es" },
      });
      if (!res.ok) continue;
      const data: { lat: string; lon: string }[] = await res.json();
      if (data.length) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    } catch { /* siguiente */ }
  }

  // Fallback Photon
  try {
    const params = new URLSearchParams({ q: `${sinNum}, Lima, Peru`, limit: "1", lang: "es" });
    const res = await fetch(`https://photon.komoot.io/api?${params}&bbox=-77.5,-12.3,-76.7,-11.6`);
    if (res.ok) {
      const data: { features: { geometry: { coordinates: [number, number] } }[] } = await res.json();
      if (data.features?.length) {
        const [lng, lat] = data.features[0].geometry.coordinates;
        return [lat, lng];
      }
    }
  } catch { /* sin coords */ }

  return undefined;
}

// ─── Página principal ─────────────────────────────────────────────────────────

function ClientePage() {
  const navigate = useNavigate();
  const session  = useStore((s) => s.session);
  const customer = useStore((s) => s.customers.find((c) => c.id === s.session?.customerId));
  const [tab, setTab]                 = useState<Tab>("pedidos");
  const [modalPedido, setModalPedido] = useState(false);
  const [montado, setMontado]         = useState(false);

  // Marcar como montado (solo en el cliente, nunca en SSR)
  useEffect(() => { setMontado(true); }, []);

  // Redirigir si no hay sesión de cliente (solo después de montar)
  useEffect(() => {
    if (montado && (!session || session.role !== "customer")) {
      navigate({ to: "/login" });
    }
  }, [session, navigate, montado]);

  // SSR y primer render del cliente devuelven null para evitar mismatch de hidratación
  if (!montado || !session || session.role !== "customer") return null;

  const nombre = customer ? `${customer.name}${customer.apellidos ? " " + customer.apellidos : ""}` : session.email;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-accent text-accent-foreground">
              <Drumstick className="h-5 w-5" />
            </span>
            <span className="text-lg font-semibold tracking-tight">Ala K' Rico GO</span>
          </Link>
          <div className="flex items-center gap-3">
            {/* Botón principal: hacer pedido */}
            <button
              onClick={() => setModalPedido(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground transition hover:brightness-105"
            >
              <Plus className="h-4 w-4" /> Hacer pedido
            </button>
            <span className="hidden text-sm text-muted-foreground sm:inline">
              Hola, <span className="font-medium text-foreground">{nombre.split(" ")[0]}</span>
            </span>
            <button
              onClick={() => { store.logout(); navigate({ to: "/" }); }}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {/* Tabs */}
        <div className="mb-8 flex gap-1 rounded-xl border border-border bg-card p-1">
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

    store.addOrder({
      customer:   customer ? `${customer.name}${customer.apellidos ? " " + customer.apellidos : ""}` : "Cliente",
      customerId,
      phone:      telefono.trim().slice(0, 40),
      address:    direccion.trim().slice(0, 200),
      wings:      Math.min(200, Math.max(1, alitas)),
      sauce:      salsa,
      notes:      notas.trim().slice(0, 200) || undefined,
      coords,
    });

    setEnviando(false);
    onCreado();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 py-8"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl">
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

function TabPedidos({ customerId, onNuevoPedido }: { customerId: string; onNuevoPedido: () => void }) {
  const allOrders = useStore((s) => s.orders);
  const orders = useMemo(
    () => allOrders
      .filter((o) => o.customerId === customerId)
      .sort((a, b) => b.createdAt - a.createdAt),
    [allOrders, customerId],
  );

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

  const activo = orders.find((o) => o.status !== "entregado");

  return (
    <div className="space-y-5">
      {/* Pedido activo destacado */}
      {activo && (
        <div className="rounded-xl border-2 border-accent/40 bg-accent/5 p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-accent-foreground">
              Pedido en curso
            </span>
            <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${STATUS_COLOR[activo.status]}`}>
              {STATUS_ES[activo.status]}
            </span>
          </div>
          <BarraProgreso status={activo.status} />
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="font-mono text-xs text-muted-foreground">{activo.id} · {activo.wings} alitas · {activo.sauce}</span>
          </div>
        </div>
      )}

      {/* Historial */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-muted-foreground">
          Historial ({orders.length})
        </h2>
        <div className="space-y-3">
          {orders.map((o) => (
            <div
              key={o.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{o.id}</span>
                  {o.status !== "entregado" && (
                    <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">
                      Activo
                    </span>
                  )}
                </div>
                <div className="font-medium">{o.wings} alitas · {o.sauce}</div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3 flex-none" />
                  {o.address}
                </div>
                {o.notes && (
                  <div className="text-xs text-muted-foreground">Nota: {o.notes}</div>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${STATUS_COLOR[o.status] ?? ""}`}>
                  {STATUS_ES[o.status] ?? o.status}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(o.createdAt).toLocaleDateString("es-PE", {
                    day: "2-digit", month: "short", year: "numeric",
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Seguimiento ─────────────────────────────────────────────────────────

function TabSeguimiento({ customerId }: { customerId: string }) {
  const allOrders = useStore((s) => s.orders);
  const drivers   = useStore((s) => s.drivers);

  // Todos los pedidos activos del cliente, más reciente primero
  const pedidosActivos = useMemo(
    () =>
      allOrders
        .filter((o) => o.customerId === customerId && o.status !== "entregado")
        .sort((a, b) => b.createdAt - a.createdAt),
    [allOrders, customerId],
  );

  // Búsqueda por código (busca en TODOS los pedidos, no solo los activos)
  const [codigo,  setCodigo]  = useState("");
  const [buscado, setBuscado] = useState("");
  const pedidoBuscado = useMemo(
    () => buscado
      ? (allOrders.find((o) => o.id.toUpperCase() === buscado.toUpperCase()) ?? null)
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
          placeholder="Buscar por código  Ej: WO-0001"
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
          <TarjetaSeguimiento order={pedidoBuscado} drivers={drivers} />
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
            <div key={order.id}>
              {/* Separador de número cuando hay varios */}
              {pedidosActivos.length > 1 && (
                <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                    {idx + 1}
                  </span>
                  Pedido activo
                </p>
              )}
              <TarjetaSeguimiento order={order} drivers={drivers} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tarjeta de seguimiento individual ───────────────────────────────────────

function TarjetaSeguimiento({
  order,
  drivers,
}: {
  order: any;
  drivers: any[];
}) {
  const driver       = drivers.find((d) => d.id === order.driverId);
  const currentIndex = STEPS.findIndex((s) => s.key === order.status);
  const esActivo     = order.status !== "entregado";

  return (
    <div className={`space-y-3 rounded-2xl border p-1 ${
      esActivo ? "border-accent/30 bg-accent/[0.03]" : "border-border bg-card"
    }`}>

      {/* ── Stepper ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl bg-card p-5">
        {/* Cabecera */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold">{order.id}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(order.createdAt).toLocaleDateString("es-PE", {
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
            <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${STATUS_COLOR[order.status] ?? ""}`}>
              {STATUS_ES[order.status] ?? order.status}
            </span>
          </div>
        </div>

        {/* Barra de progreso compacta */}
        <BarraProgreso status={order.status} />

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
          <p>
            <span className="text-muted-foreground">Alitas: </span>
            <span className="font-medium">{order.wings} pzas</span>
          </p>
          <p>
            <span className="text-muted-foreground">Salsa: </span>
            <span className="font-medium">{order.sauce}</span>
          </p>
          <div className="flex items-start gap-1.5">
            <MapPin className="mt-0.5 h-3.5 w-3.5 flex-none text-muted-foreground" />
            <span className="text-muted-foreground leading-snug">{order.address}</span>
          </div>
          {order.notes && (
            <p className="rounded-md bg-muted px-3 py-1.5 text-xs">{order.notes}</p>
          )}
        </div>

        {/* Repartidor */}
        <div className="rounded-xl border border-border bg-card p-4 text-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Repartidor
          </p>
          {driver ? (
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 flex-none place-items-center rounded-full bg-accent/15 text-base font-bold text-accent-foreground">
                {driver.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
              </span>
              <div>
                <p className="font-medium">{driver.name}</p>
                {driver.phone ? (
                  <a
                    href={`tel:${driver.phone}`}
                    className="flex items-center gap-1 text-xs text-accent-foreground hover:underline"
                  >
                    <Phone className="h-3 w-3" /> {driver.phone}
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground">Sin teléfono registrado</p>
                )}
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
      {order.status === "en_camino" && (
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
            destino={order.address}
            coordsDestino={order.coords}
            altura={260}
          />
        </div>
      )}
    </div>
  );
}

// ─── Tab: Mi Perfil ───────────────────────────────────────────────────────────

function TabPerfil({ customerId }: { customerId: string }) {
  const customer = useStore((s) => s.customers.find((c) => c.id === customerId));
  const [guardado, setGuardado] = useState(false);

  const [nombre,    setNombre]    = useState(customer?.name           ?? "");
  const [apellidos, setApellidos] = useState(customer?.apellidos       ?? "");
  const [celular,   setCelular]   = useState(customer?.phone           ?? "");
  const [direccion, setDireccion] = useState(customer?.address         ?? "");
  const [tipoDoc,   setTipoDoc]   = useState<TipoDocumento | "">(customer?.tipoDocumento ?? "");
  const [numeroDoc, setNumeroDoc] = useState(customer?.numeroDocumento  ?? "");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    store.updateCustomerProfile(customerId, {
      name:            nombre.trim(),
      apellidos:       apellidos.trim()  || undefined,
      phone:           celular.trim()    || undefined,
      address:         direccion.trim()  || undefined,
      tipoDocumento:   tipoDoc           || undefined,
      numeroDocumento: numeroDoc.trim()  || undefined,
    });
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2500);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Mis datos personales</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Mantén tu dirección actualizada para que tus pedidos lleguen sin problemas.
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
            <input type="email" disabled value={customer?.email ?? ""}
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

        <div className="space-y-1.5">
          <label htmlFor="p-direccion" className="text-sm font-medium">Dirección habitual de entrega</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input id="p-direccion" type="text" maxLength={200}
              value={direccion} onChange={(e) => setDireccion(e.target.value)}
              className={`${clsInput} pl-9`} placeholder="Av. Los Alisos 1526, Los Olivos, Lima" />
          </div>
          <p className="text-xs text-muted-foreground">
            Se usará como dirección predeterminada al hacer nuevos pedidos.
          </p>
        </div>

        <div className="flex items-center justify-between gap-4">
          {guardado && (
            <span className="text-sm font-medium text-emerald-600">✓ Datos guardados correctamente</span>
          )}
          <button type="submit" className="ml-auto rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition hover:brightness-105">
            Guardar cambios
          </button>
        </div>
      </form>
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
          ? "bg-accent text-accent-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon} <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
