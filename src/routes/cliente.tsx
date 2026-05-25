import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  ChefHat, ClipboardList, Drumstick, LogOut, MapPin,
  PackageCheck, Truck, User, ShoppingBag, Search,
} from "lucide-react";
import { store, useStore, TIPOS_DOCUMENTO, type TipoDocumento } from "@/lib/store";

export const Route = createFileRoute("/cliente")({
  head: () => ({
    meta: [{ title: "Mi cuenta — Ala K' Rico GO" }],
  }),
  component: ClientePage,
});

type Tab = "pedidos" | "seguimiento" | "perfil";

// ─── Página principal ──────────────────────────────────────────────────────────

function ClientePage() {
  const navigate  = useNavigate();
  const session   = useStore((s) => s.session);
  const customer  = useStore((s) =>
    s.customers.find((c) => c.id === s.session?.customerId),
  );
  const [tab, setTab] = useState<Tab>("pedidos");

  // Redirigir si no hay sesión de cliente
  useEffect(() => {
    if (!session || session.role !== "customer") navigate({ to: "/login" });
  }, [session, navigate]);

  if (!session || session.role !== "customer") return null;

  function logout() {
    store.logout();
    navigate({ to: "/" });
  }

  const nombre = customer?.name ?? session.email;

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
            <span className="hidden text-sm text-muted-foreground sm:inline">
              Hola, <span className="font-medium text-foreground">{nombre}</span>
            </span>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              <LogOut className="h-4 w-4" /> Salir
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1 mb-8">
          <TabBtn active={tab === "pedidos"} onClick={() => setTab("pedidos")} icon={<ShoppingBag className="h-4 w-4" />} label="Mis Pedidos" />
          <TabBtn active={tab === "seguimiento"} onClick={() => setTab("seguimiento")} icon={<MapPin className="h-4 w-4" />} label="Seguimiento" />
          <TabBtn active={tab === "perfil"} onClick={() => setTab("perfil")} icon={<User className="h-4 w-4" />} label="Mi Perfil" />
        </div>

        {tab === "pedidos"     && <TabPedidos customerId={session.customerId!} />}
        {tab === "seguimiento" && <TabSeguimiento />}
        {tab === "perfil"      && <TabPerfil customerId={session.customerId!} />}
      </main>
    </div>
  );
}

// ─── Tab: Mis Pedidos ─────────────────────────────────────────────────────────

const STATUS_ES: Record<string, string> = {
  sin_asignar: "Pedido recibido",
  asignado:    "En preparación",
  en_camino:   "En camino",
  entregado:   "Entregado",
};

const STATUS_COLOR: Record<string, string> = {
  sin_asignar: "bg-muted text-muted-foreground",
  asignado:    "bg-accent/20 text-accent-foreground",
  en_camino:   "bg-primary text-primary-foreground",
  entregado:   "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

function TabPedidos({ customerId }: { customerId: string }) {
  const orders = useStore((s) =>
    s.orders.filter((o) => o.customerId === customerId),
  );

  if (orders.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
        <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground/40" />
        <h2 className="mt-4 text-base font-semibold">Aún no tienes pedidos</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cuando el administrador registre un pedido asociado a tu cuenta, aparecerá aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Historial de pedidos</h2>
      {orders.map((o) => (
        <div
          key={o.id}
          className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4"
        >
          <div className="space-y-0.5">
            <div className="font-mono text-xs text-muted-foreground">{o.id}</div>
            <div className="font-medium">{o.wings} alitas · {o.sauce}</div>
            <div className="text-sm text-muted-foreground">{o.address}</div>
            {o.notes && <div className="text-xs text-muted-foreground">Nota: {o.notes}</div>}
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
            <Link
              to="/seguimiento/$orderId"
              params={{ orderId: o.id }}
              className="text-xs text-accent-foreground hover:underline"
            >
              Ver seguimiento →
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tab: Seguimiento ─────────────────────────────────────────────────────────

const STEPS = [
  { key: "sin_asignar", label: "Pedido recibido",  icon: ClipboardList },
  { key: "asignado",    label: "En preparación",   icon: ChefHat },
  { key: "en_camino",   label: "En camino",         icon: Truck },
  { key: "entregado",   label: "Entregado",          icon: PackageCheck },
] as const;

function TabSeguimiento() {
  const [codigo, setCodigo]     = useState("");
  const [buscado, setBuscado]   = useState("");
  const orders                  = useStore((s) => s.orders);
  const drivers                 = useStore((s) => s.drivers);

  const order  = orders.find((o) => o.id.toUpperCase() === buscado.toUpperCase());
  const driver = drivers.find((d) => d.id === order?.driverId);
  const currentIndex = order ? STEPS.findIndex((s) => s.key === order.status) : -1;

  function handleBuscar(e: FormEvent) {
    e.preventDefault();
    setBuscado(codigo.trim());
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Rastrear pedido</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ingresa el código de tu pedido para ver el estado en tiempo real.
        </p>
      </div>

      {/* Buscador */}
      <form onSubmit={handleBuscar} className="flex gap-2">
        <input
          type="text"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="Ej: WO-0001"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2.5 text-sm font-mono outline-none ring-ring/30 transition focus:border-ring focus:ring-2"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:brightness-105"
        >
          <Search className="h-4 w-4" /> Buscar
        </button>
      </form>

      {/* Resultado */}
      {buscado && !order && (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No se encontró el pedido <span className="font-mono font-semibold">{buscado}</span>.
          Verifica el código e intenta nuevamente.
        </div>
      )}

      {order && (
        <div className="space-y-4">
          {/* Progreso */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-mono text-sm font-semibold">{order.id}</span>
              <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${STATUS_COLOR[order.status] ?? ""}`}>
                {STATUS_ES[order.status]}
              </span>
            </div>
            <ol className="space-y-4">
              {STEPS.map((step, i) => {
                const done   = i <= currentIndex;
                const active = i === currentIndex;
                const Icon   = step.icon;
                return (
                  <li key={step.key} className="flex items-center gap-3">
                    <span className={`grid h-9 w-9 flex-none place-items-center rounded-full transition ${
                      done
                        ? active ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className={`text-sm font-medium ${done ? "text-foreground" : "text-muted-foreground"}`}>
                      {step.label}
                      {active && <span className="ml-2 text-xs text-accent-foreground/80">← estado actual</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Detalle */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4 text-sm space-y-1">
              <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">Tu pedido</p>
              <p><span className="text-muted-foreground">Alitas:</span> {order.wings} pzas</p>
              <p><span className="text-muted-foreground">Salsa:</span> {order.sauce}</p>
              <p><span className="text-muted-foreground">Dirección:</span> {order.address}</p>
              {order.notes && <p><span className="text-muted-foreground">Nota:</span> {order.notes}</p>}
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-sm">
              <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">Repartidor</p>
              {driver ? (
                <div className="flex items-center gap-3 mt-1">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-accent/15 text-sm font-bold text-accent-foreground">
                    {driver.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </span>
                  <span className="font-medium">{driver.name}</span>
                </div>
              ) : (
                <p className="text-muted-foreground mt-1">Aún asignando repartidor…</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Mi Perfil ───────────────────────────────────────────────────────────

function TabPerfil({ customerId }: { customerId: string }) {
  const customer = useStore((s) => s.customers.find((c) => c.id === customerId));
  const [guardado, setGuardado] = useState(false);

  const [nombre,          setNombre]          = useState(customer?.name          ?? "");
  const [apellidos,       setApellidos]       = useState(customer?.apellidos      ?? "");
  const [celular,         setCelular]         = useState(customer?.phone          ?? "");
  const [direccion,       setDireccion]       = useState(customer?.address        ?? "");
  const [tipoDoc,         setTipoDoc]         = useState<TipoDocumento | "">(customer?.tipoDocumento ?? "");
  const [numeroDoc,       setNumeroDoc]       = useState(customer?.numeroDocumento ?? "");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    store.updateCustomerProfile(customerId, {
      name:             nombre.trim(),
      apellidos:        apellidos.trim() || undefined,
      phone:            celular.trim()   || undefined,
      address:          direccion.trim() || undefined,
      tipoDocumento:    tipoDoc          || undefined,
      numeroDocumento:  numeroDoc.trim() || undefined,
    });
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2500);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Mis datos personales</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Mantén tus datos actualizados para una entrega más rápida.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-border bg-card p-6 space-y-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Nombres */}
          <div className="space-y-1.5">
            <label htmlFor="p-nombre" className="text-sm font-medium">
              Nombres <span className="text-destructive">*</span>
            </label>
            <input
              id="p-nombre" type="text" required maxLength={80}
              value={nombre} onChange={(e) => setNombre(e.target.value)}
              className={inputCls} placeholder="Juan"
            />
          </div>

          {/* Apellidos */}
          <div className="space-y-1.5">
            <label htmlFor="p-apellidos" className="text-sm font-medium">Apellidos</label>
            <input
              id="p-apellidos" type="text" maxLength={80}
              value={apellidos} onChange={(e) => setApellidos(e.target.value)}
              className={inputCls} placeholder="Pérez García"
            />
          </div>

          {/* Número de celular */}
          <div className="space-y-1.5">
            <label htmlFor="p-celular" className="text-sm font-medium">Número de celular</label>
            <input
              id="p-celular" type="tel" maxLength={20}
              value={celular} onChange={(e) => setCelular(e.target.value)}
              className={inputCls} placeholder="+51 999 999 999"
            />
          </div>

          {/* Correo (solo lectura) */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Correo electrónico</label>
            <input
              type="email" disabled value={customer?.email ?? ""}
              className={`${inputCls} cursor-not-allowed opacity-60`}
            />
          </div>

          {/* Tipo de documento */}
          <div className="space-y-1.5">
            <label htmlFor="p-tipo-doc" className="text-sm font-medium">Tipo de documento</label>
            <select
              id="p-tipo-doc"
              value={tipoDoc}
              onChange={(e) => setTipoDoc(e.target.value as TipoDocumento | "")}
              className={inputCls}
            >
              <option value="">Seleccionar…</option>
              {TIPOS_DOCUMENTO.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Número de documento */}
          <div className="space-y-1.5">
            <label htmlFor="p-num-doc" className="text-sm font-medium">Número de documento</label>
            <input
              id="p-num-doc" type="text" maxLength={20}
              value={numeroDoc} onChange={(e) => setNumeroDoc(e.target.value)}
              className={inputCls} placeholder="12345678"
            />
          </div>
        </div>

        {/* Dirección (full width) */}
        <div className="space-y-1.5">
          <label htmlFor="p-direccion" className="text-sm font-medium">Dirección</label>
          <input
            id="p-direccion" type="text" maxLength={200}
            value={direccion} onChange={(e) => setDireccion(e.target.value)}
            className={inputCls}
            placeholder="Av. Los Alisos 1526, Los Olivos, Lima"
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          {guardado && (
            <span className="text-sm font-medium text-emerald-600">
              ✓ Datos guardados correctamente
            </span>
          )}
          <div className="ml-auto">
            <button type="submit" className={btnAccent}>
              Guardar cambios
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ─── Helpers visuales ─────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none ring-ring/30 transition focus:border-ring focus:ring-2";
const btnAccent =
  "rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition hover:brightness-105";

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
