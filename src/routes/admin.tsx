import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  AlertTriangle, BarChart2, Check, ClipboardList, Copy, Drumstick, Edit2,
  KeyRound, LayoutDashboard, Loader2, LogOut, Plus, Settings, ShieldOff,
  Truck, UserCheck, UserX,
} from "lucide-react";
import { store, useStore, SAUCES, type Sauce, type Driver, type OrderStatus, type AcoConfig } from "@/lib/store";
import { api } from "@/lib/api";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Administrador — Ala K' Rico GO" }],
  }),
  component: PaginaAdmin,
});

// ─── Tipos ────────────────────────────────────────────────────────────────────

type SeccionAdmin = "dashboard" | "pedidos" | "repartidores" | "reportes" | "configuracion";

// ─── Traducciones ─────────────────────────────────────────────────────────────

const ESTADO_PEDIDO: Record<string, string> = {
  sin_asignar: "Sin asignar",
  asignado:    "Asignado",
  en_camino:   "En camino",
  entregado:   "Entregado",
};

// ─── Página principal ─────────────────────────────────────────────────────────

function PaginaAdmin() {
  const navigate = useNavigate();
  const session  = useStore((s) => s.session);
  const [seccion, setSeccion] = useState<SeccionAdmin>("dashboard");
  const [montado, setMontado] = useState(false);

  useEffect(() => { setMontado(true); }, []);

  useEffect(() => {
    if (montado && (!session || session.role !== "admin")) {
      navigate({ to: "/login" });
    }
  }, [session, navigate, montado]);

  if (!montado || !session || session.role !== "admin") return null;

  function cerrarSesion() {
    store.logout();
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-accent text-accent-foreground">
              <Drumstick className="h-5 w-5" />
            </span>
            <span className="text-lg font-semibold tracking-tight">Ala K' Rico GO</span>
            <span className="ml-2 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
              Administrador
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {session?.email ?? "invitado"}
            </span>
            <Link
              to="/driver"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium transition hover:bg-secondary"
            >
              <Truck className="h-4 w-4" /> Vista repartidor
            </Link>
            <button
              onClick={cerrarSesion}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              <LogOut className="h-4 w-4" /> Salir
            </button>
          </div>
        </div>
      </header>

      {/* Navegación de secciones */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl gap-0 overflow-x-auto px-6">
          <NavBtn activo={seccion === "dashboard"}    onClick={() => setSeccion("dashboard")}    icon={<LayoutDashboard className="h-4 w-4" />} label="Dashboard" />
          <NavBtn activo={seccion === "pedidos"}      onClick={() => setSeccion("pedidos")}      icon={<ClipboardList className="h-4 w-4" />}  label="Pedidos" />
          <NavBtn activo={seccion === "repartidores"} onClick={() => setSeccion("repartidores")} icon={<Truck className="h-4 w-4" />}          label="Repartidores" />
          <NavBtn activo={seccion === "reportes"}     onClick={() => setSeccion("reportes")}     icon={<BarChart2 className="h-4 w-4" />}      label="Reportes" />
          <NavBtn activo={seccion === "configuracion"} onClick={() => setSeccion("configuracion")} icon={<Settings className="h-4 w-4" />}    label="Configuración" />
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {seccion === "dashboard"    && <SeccionDashboard />}
        {seccion === "pedidos"      && <SeccionPedidos />}
        {seccion === "repartidores" && <SeccionRepartidores />}
        {seccion === "reportes"     && <SeccionReportes />}
        {seccion === "configuracion" && <SeccionConfiguracion />}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN: DASHBOARD (HU030)
// ═══════════════════════════════════════════════════════════════════════════════

function SeccionDashboard() {
  const orders  = useStore((s) => s.orders);
  const drivers = useStore((s) => s.drivers);

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const hoyMs = hoy.getTime();

  const pedidosHoy    = orders.filter((o) => o.createdAt >= hoyMs);
  const entregadosHoy = pedidosHoy.filter((o) => o.status === "entregado");
  const activosHoy    = pedidosHoy.filter((o) => ["asignado", "en_camino"].includes(o.status));
  const repartidoresActivos = drivers.filter((d) => d.activo !== false).length;

  const tasaCumplimiento = pedidosHoy.length > 0
    ? Math.round((entregadosHoy.length / pedidosHoy.length) * 100)
    : 0;

  const tiempoPromedio = (() => {
    const conTiempos = orders.filter((o) => o.deliveredAt && o.assignedAt);
    if (!conTiempos.length) return null;
    const suma = conTiempos.reduce((acc, o) => acc + (o.deliveredAt! - o.assignedAt!), 0);
    return Math.round(suma / conTiempos.length / 60000);
  })();

  const pedidosPorEstado = [
    { label: "Sin asignar", count: orders.filter((o) => o.status === "sin_asignar").length, color: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" },
    { label: "Asignados",   count: orders.filter((o) => o.status === "asignado").length,    color: "bg-accent/20 text-accent-foreground" },
    { label: "En camino",   count: orders.filter((o) => o.status === "en_camino").length,   color: "bg-primary/15 text-primary" },
    { label: "Entregados",  count: orders.filter((o) => o.status === "entregado").length,   color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
    { label: "Cancelados",  count: orders.filter((o) => o.status === "cancelado").length,   color: "bg-destructive/15 text-destructive" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Resumen operativo en tiempo real.</p>
      </div>

      {/* KPIs principales */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard titulo="Pedidos hoy"        valor={pedidosHoy.length}                                sufijo=""         highlight />
        <KpiCard titulo="Activos ahora"      valor={activosHoy.length}                                sufijo=""         />
        <KpiCard titulo="Repartidores activos" valor={repartidoresActivos}                            sufijo=""         />
        <KpiCard titulo="Tasa de cumplimiento" valor={`${tasaCumplimiento}%`}                         sufijo=""         highlight />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard titulo="Tiempo promedio de entrega" valor={tiempoPromedio !== null ? `${tiempoPromedio} min` : "Sin datos"} sufijo="" />
        <KpiCard titulo="Total pedidos sistema"      valor={orders.length}                            sufijo=""         />
      </div>

      {/* Distribución por estado */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">Distribución por estado</h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {pedidosPorEstado.map((e) => (
            <div key={e.label} className={`rounded-xl px-4 py-3 text-center ${e.color}`}>
              <div className="text-2xl font-bold">{e.count}</div>
              <div className="mt-0.5 text-xs font-medium">{e.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Últimos pedidos del día */}
      {pedidosHoy.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-base font-semibold">Pedidos de hoy</h2>
          <div className="space-y-2">
            {pedidosHoy.slice(0, 10).map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-4 rounded-lg bg-muted/40 px-4 py-2.5 text-sm">
                <span className="font-mono text-xs text-muted-foreground">{o.id}</span>
                <span className="font-medium">{o.customer}</span>
                <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${ESTADO_COLOR[o.status] ?? ""}`}>
                  {ESTADO_PEDIDO[o.status] ?? o.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ titulo, valor, sufijo, highlight }: { titulo: string; valor: string | number; sufijo?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-5 ${highlight ? "border-accent/40 bg-accent/5" : "border-border bg-card"}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <p className={`mt-2 text-3xl font-bold ${highlight ? "text-accent-foreground" : ""}`}>
        {valor}{sufijo}
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN: REPORTES (HU026 / HU027)
// ═══════════════════════════════════════════════════════════════════════════════

function SeccionReportes() {
  const orders  = useStore((s) => s.orders);
  const drivers = useStore((s) => s.drivers);

  const entregados = orders.filter((o) => o.status === "entregado");

  // Métricas de tiempos
  const tiempos = entregados
    .filter((o) => o.deliveredAt && o.assignedAt)
    .map((o) => Math.round((o.deliveredAt! - o.assignedAt!) / 60000));

  const promedio  = tiempos.length ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length) : null;
  const minimo    = tiempos.length ? Math.min(...tiempos) : null;
  const maximo    = tiempos.length ? Math.max(...tiempos) : null;
  const desviacion = tiempos.length > 1
    ? Math.round(Math.sqrt(tiempos.reduce((a, b) => a + Math.pow(b - (promedio ?? 0), 2), 0) / tiempos.length))
    : null;

  // Ranking de repartidores
  const rankingDrivers = drivers.map((d) => {
    const entregasConductor = entregados.filter((o) => o.driverId === d.id);
    const tiemposConductor  = entregasConductor
      .filter((o) => o.deliveredAt && o.assignedAt)
      .map((o) => Math.round((o.deliveredAt! - o.assignedAt!) / 60000));
    const promedioPropio = tiemposConductor.length
      ? Math.round(tiemposConductor.reduce((a, b) => a + b, 0) / tiemposConductor.length)
      : null;
    return { driver: d, entregas: entregasConductor.length, promedioMin: promedioPropio };
  }).sort((a, b) => b.entregas - a.entregas);

  const promGlobal = promedio ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reportes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Análisis de tiempos de entrega y desempeño de repartidores.
        </p>
      </div>

      {/* Resumen estadístico HU026 */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">Tiempos de entrega</h2>
        {tiempos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay entregas completadas con datos de tiempo.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-muted/30 p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Promedio</p>
              <p className="mt-1 text-2xl font-bold text-accent-foreground">{promedio} min</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Mínimo</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">{minimo} min</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Máximo</p>
              <p className="mt-1 text-2xl font-bold text-primary">{maximo} min</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Desv. estándar</p>
              <p className="mt-1 text-2xl font-bold">{desviacion} min</p>
            </div>
          </div>
        )}
      </div>

      {/* Ranking de repartidores HU027 */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">Desempeño de repartidores</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr className="text-left">
                <Encabezado>#</Encabezado>
                <Encabezado>Repartidor</Encabezado>
                <Encabezado>Entregas</Encabezado>
                <Encabezado>Tiempo promedio</Encabezado>
                <Encabezado>Estado</Encabezado>
              </tr>
            </thead>
            <tbody>
              {rankingDrivers.map((r, i) => {
                const bajDesempeno = promGlobal > 0 && r.promedioMin !== null && r.promedioMin > promGlobal * 1.3;
                return (
                  <tr key={r.driver.id} className="border-t border-border">
                    <Celda className="text-muted-foreground font-mono text-xs">#{i + 1}</Celda>
                    <Celda>
                      <div className="font-medium">{r.driver.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{r.driver.id}</div>
                    </Celda>
                    <Celda>
                      <span className="font-semibold">{r.entregas}</span>
                    </Celda>
                    <Celda>
                      {r.promedioMin !== null
                        ? <span className={bajDesempeno ? "text-destructive font-semibold" : ""}>{r.promedioMin} min</span>
                        : <span className="text-muted-foreground">—</span>}
                    </Celda>
                    <Celda>
                      {bajDesempeno ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                          <AlertTriangle className="h-3 w-3" /> Atención
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                          OK
                        </span>
                      )}
                    </Celda>
                  </tr>
                );
              })}
              {rankingDrivers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No hay repartidores registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historial de pedidos */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">Historial de pedidos</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr className="text-left">
                <Encabezado>ID</Encabezado>
                <Encabezado>Cliente</Encabezado>
                <Encabezado>Repartidor</Encabezado>
                <Encabezado>Estado</Encabezado>
                <Encabezado>T. entrega</Encabezado>
                <Encabezado>Fecha</Encabezado>
              </tr>
            </thead>
            <tbody>
              {[...orders].sort((a, b) => b.createdAt - a.createdAt).slice(0, 20).map((o) => {
                const driver = drivers.find((d) => d.id === o.driverId);
                const tEntrega = o.deliveredAt && o.assignedAt
                  ? Math.round((o.deliveredAt - o.assignedAt) / 60000)
                  : null;
                return (
                  <tr key={o.id} className="border-t border-border">
                    <Celda className="font-mono text-xs">{o.id}</Celda>
                    <Celda>{o.customer}</Celda>
                    <Celda>{driver?.name ?? <span className="text-muted-foreground">—</span>}</Celda>
                    <Celda>
                      <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${ESTADO_COLOR[o.status] ?? ""}`}>
                        {ESTADO_PEDIDO[o.status] ?? o.status}
                      </span>
                    </Celda>
                    <Celda>{tEntrega !== null ? `${tEntrega} min` : <span className="text-muted-foreground">—</span>}</Celda>
                    <Celda className="text-xs text-muted-foreground">
                      {new Date(o.createdAt).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}
                    </Celda>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN: CONFIGURACIÓN ACO (HU025)
// ═══════════════════════════════════════════════════════════════════════════════

const ACO_RANGOS: Record<keyof AcoConfig, { min: number; max: number; step: number; label: string }> = {
  alfa:       { min: 0.5, max: 5,    step: 0.1,  label: "Alfa (α) — Peso de feromonas" },
  beta:       { min: 0.5, max: 5,    step: 0.1,  label: "Beta (β) — Peso heurístico" },
  rho:        { min: 0.01, max: 0.9, step: 0.01, label: "Rho (ρ) — Tasa de evaporación" },
  Q:          { min: 0.1, max: 10,   step: 0.1,  label: "Q — Constante de feromona" },
  numAnts:    { min: 5,   max: 100,  step: 1,    label: "Número de hormigas" },
  iterations: { min: 10,  max: 200,  step: 5,    label: "Iteraciones" },
  elite:      { min: 0,   max: 10,   step: 1,    label: "Refuerzo élite" },
  tauMin:     { min: 0.001, max: 0.5, step: 0.001, label: "Tau mínimo (piso de feromona)" },
};

function SeccionConfiguracion() {
  const acoConfig = useStore((s) => s.acoConfig);
  const [local, setLocal]     = useState<AcoConfig>({ ...acoConfig });
  const [errores, setErrores] = useState<Partial<Record<keyof AcoConfig, string>>>({});
  const [guardado, setGuardado]   = useState(false);
  const [cargando, setCargando]   = useState(true);
  const [errorApi, setErrorApi]   = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Cargar config desde la BD al montar
  useEffect(() => {
    api.obtenerAcoConfig()
      .then((cfg) => {
        setLocal(cfg);
        store.updateAcoConfig(cfg);
      })
      .catch(() => {
        // Sin backend: usar valores del store local
      })
      .finally(() => setCargando(false));
  }, []);

  function handleChange(campo: keyof AcoConfig, val: string) {
    const num = parseFloat(val);
    setLocal((prev) => ({ ...prev, [campo]: isNaN(num) ? prev[campo] : num }));
    setErrores((prev) => { const copia = { ...prev }; delete copia[campo]; return copia; });
    setGuardado(false);
    setErrorApi(null);
  }

  function validar(): boolean {
    const nuevosErrores: Partial<Record<keyof AcoConfig, string>> = {};
    (Object.keys(ACO_RANGOS) as (keyof AcoConfig)[]).forEach((k) => {
      const rango = ACO_RANGOS[k];
      if (local[k] < rango.min || local[k] > rango.max) {
        nuevosErrores[k] = `Debe estar entre ${rango.min} y ${rango.max}.`;
      }
    });
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  async function handleGuardar(e: FormEvent) {
    e.preventDefault();
    if (!validar()) return;
    setGuardando(true);
    setErrorApi(null);
    try {
      await api.guardarAcoConfig(local);
    } catch {
      setErrorApi("No se pudo guardar en el servidor. Los cambios se aplicaron localmente.");
    }
    store.updateAcoConfig(local);
    setGuardando(false);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 3000);
  }

  function handleReset() {
    setLocal({ ...acoConfig });
    setErrores({});
    setGuardado(false);
    setErrorApi(null);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configuración ACO</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ajusta los parámetros del algoritmo de optimización de rutas (Ant Colony Optimization).
        </p>
      </div>

      {cargando ? (
        <div className="rounded-xl border border-border bg-card p-10 flex items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Cargando configuración desde el servidor…</span>
        </div>
      ) : (
      <form onSubmit={handleGuardar} className="rounded-xl border border-border bg-card p-6 space-y-6">
        <div className="grid gap-5 sm:grid-cols-2">
          {(Object.keys(ACO_RANGOS) as (keyof AcoConfig)[]).map((campo) => {
            const rango = ACO_RANGOS[campo];
            return (
              <label key={campo} className="space-y-1.5">
                <span className="text-sm font-medium">{rango.label}</span>
                <input
                  type="number"
                  step={rango.step}
                  min={rango.min}
                  max={rango.max}
                  value={local[campo]}
                  onChange={(e) => handleChange(campo, e.target.value)}
                  className={`${clsInput} ${errores[campo] ? "border-destructive" : ""}`}
                />
                {errores[campo] && (
                  <p className="text-xs text-destructive">{errores[campo]}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Rango: [{rango.min} – {rango.max}] · En BD: {local[campo]}
                </p>
              </label>
            );
          })}
        </div>

        {errorApi && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{errorApi}</p>
        )}

        <div className="flex items-center justify-between gap-4 pt-2">
          {guardado && (
            <span className="text-sm font-medium text-emerald-600">
              ✓ Configuración guardada en SQL Server. Se aplica en el próximo cálculo ACO.
            </span>
          )}
          <div className="ml-auto flex gap-3">
            <button type="button" onClick={handleReset} className={clsBtnSecundario}>
              Restaurar
            </button>
            <button type="submit" disabled={guardando} className={`${clsBtnAccent} inline-flex items-center gap-2 disabled:opacity-60`}>
              {guardando ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</> : "Guardar configuración"}
            </button>
          </div>
        </div>
      </form>
      )}

      {/* Valores actuales en sistema */}
      <div className="rounded-xl border border-border bg-muted/30 p-5 text-sm">
        <p className="mb-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Valores en uso</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(ACO_RANGOS) as (keyof AcoConfig)[]).map((k) => (
            <div key={k} className="rounded-lg border border-border bg-card px-3 py-2 text-center">
              <p className="text-xs text-muted-foreground">{k}</p>
              <p className="font-semibold">{acoConfig[k]}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN: PEDIDOS
// ═══════════════════════════════════════════════════════════════════════════════

function SeccionPedidos() {
  const orders  = useStore((s) => s.orders);
  const drivers = useStore((s) => s.drivers);
  const [abierto, setAbierto] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);

  function copiarSeguimiento(id: string) {
    const url = `${window.location.origin}/seguimiento/${id}`;
    navigator.clipboard?.writeText(url);
    setCopiado(id);
    setTimeout(() => setCopiado(null), 1500);
  }

  const repartidoresActivos = drivers.filter((d) => d.activo !== false);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tablero de pedidos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Registra un nuevo pedido y asígnalo a un repartidor.
          </p>
        </div>
        <button
          onClick={() => setAbierto(true)}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground shadow-[var(--shadow-amber)] transition hover:brightness-105"
        >
          <Plus className="h-4 w-4" /> Nuevo pedido
        </button>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-secondary-foreground">
            <tr className="text-left">
              <Encabezado>Pedido</Encabezado>
              <Encabezado>Cliente</Encabezado>
              <Encabezado>Dirección</Encabezado>
              <Encabezado>Alitas</Encabezado>
              <Encabezado>Salsa</Encabezado>
              <Encabezado>Estado</Encabezado>
              <Encabezado>Repartidor</Encabezado>
              <Encabezado>Seguimiento</Encabezado>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-border">
                <Celda className="font-mono text-xs">{o.id}</Celda>
                <Celda>
                  <div className="font-medium">{o.customer}</div>
                  <div className="text-xs text-muted-foreground">{o.phone}</div>
                </Celda>
                <Celda className="max-w-xs text-muted-foreground">{o.address}</Celda>
                <Celda>{o.wings}</Celda>
                <Celda>
                  <span className="rounded-md bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent-foreground">
                    {o.sauce}
                  </span>
                </Celda>
                <Celda>
                  <SelectEstado
                    estado={o.status}
                    onChange={(s) => store.setStatus(o.id, s)}
                  />
                </Celda>
                <Celda>
                  <select
                    value={o.driverId ?? ""}
                    onChange={(e) => { if (e.target.value) store.assignOrder(o.id, e.target.value); }}
                    className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  >
                    <option value="">Sin asignar</option>
                    {repartidoresActivos.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </Celda>
                <Celda>
                  <button
                    onClick={() => copiarSeguimiento(o.id)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition hover:bg-secondary"
                  >
                    {copiado === o.id
                      ? <><Check className="h-3.5 w-3.5 text-emerald-600" /> Copiado</>
                      : <><Copy className="h-3.5 w-3.5" /> Copiar enlace</>}
                  </button>
                </Celda>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  Aún no hay pedidos — registra el primero.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {abierto && <DialogNuevoPedido onClose={() => setAbierto(false)} />}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN: REPARTIDORES
// ═══════════════════════════════════════════════════════════════════════════════

function SeccionRepartidores() {
  const drivers = useStore((s) => s.drivers);
  const [modalNuevo,  setModalNuevo]  = useState(false);
  const [editando,    setEditando]    = useState<Driver | null>(null);

  const total   = drivers.length;
  const activos = drivers.filter((d) => d.activo !== false).length;

  return (
    <>
      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gestión de repartidores</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {activos} activo{activos !== 1 ? "s" : ""} · {total} registrado{total !== 1 ? "s" : ""} en total.
          </p>
        </div>
        <button
          onClick={() => setModalNuevo(true)}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground shadow-[var(--shadow-amber)] transition hover:brightness-105"
        >
          <Plus className="h-4 w-4" /> Nuevo repartidor
        </button>
      </div>

      {/* Tabla de repartidores */}
      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-secondary-foreground">
            <tr className="text-left">
              <Encabezado>Repartidor</Encabezado>
              <Encabezado>DNI</Encabezado>
              <Encabezado>Correo</Encabezado>
              <Encabezado>Teléfono</Encabezado>
              <Encabezado>Zona</Encabezado>
              <Encabezado>Estado</Encabezado>
              <Encabezado>Acciones</Encabezado>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => {
              const activo = d.activo !== false;
              return (
                <tr key={d.id} className={`border-t border-border ${activo ? "" : "opacity-60"}`}>
                  {/* Avatar + nombre */}
                  <Celda>
                    <div className="flex items-center gap-3">
                      <Avatar nombre={d.name} activo={activo} />
                      <div>
                        <div className="font-medium leading-tight">{d.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {d.id}
                        </div>
                      </div>
                    </div>
                  </Celda>
                  <Celda className="text-muted-foreground">{d.dni ?? "—"}</Celda>
                  <Celda className="text-muted-foreground">{d.email ?? "—"}</Celda>
                  <Celda className="text-muted-foreground">{d.phone ?? "—"}</Celda>
                  <Celda>
                    {d.zona
                      ? <span className="rounded-md bg-secondary px-2 py-0.5 text-xs">{d.zona}</span>
                      : <span className="text-muted-foreground">—</span>}
                  </Celda>
                  <Celda>
                    <PastillaActivo activo={activo} />
                  </Celda>
                  <Celda>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditando(d)}
                        title="Editar datos"
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition hover:bg-secondary"
                      >
                        <Edit2 className="h-3.5 w-3.5" /> Editar
                      </button>
                      <button
                        onClick={() => store.toggleActivoRepartidor(d.id)}
                        title={activo ? "Desactivar cuenta" : "Activar cuenta"}
                        className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                          activo
                            ? "border border-destructive/40 text-destructive hover:bg-destructive/10"
                            : "border border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10"
                        }`}
                      >
                        {activo
                          ? <><UserX className="h-3.5 w-3.5" /> Desactivar</>
                          : <><UserCheck className="h-3.5 w-3.5" /> Activar</>}
                      </button>
                    </div>
                  </Celda>
                </tr>
              );
            })}
            {drivers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  Aún no hay repartidores registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modales */}
      {modalNuevo && <DialogNuevoRepartidor onClose={() => setModalNuevo(false)} />}
      {editando   && <DialogEditarRepartidor driver={editando} onClose={() => setEditando(null)} />}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL: NUEVO REPARTIDOR  (HU004 escenarios 1 y 2)
// ═══════════════════════════════════════════════════════════════════════════════

function DialogNuevoRepartidor({ onClose }: { onClose: () => void }) {
  const [nombre,  setNombre]  = useState("");
  const [dni,     setDni]     = useState("");
  const [correo,  setCorreo]  = useState("");
  const [telefono, setTelefono] = useState("");
  const [zona,    setZona]    = useState("");
  const [error,   setError]   = useState("");

  // Estado post-creación: mostrar credenciales generadas
  const [credenciales, setCredenciales] = useState<{ correo: string; password: string } | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (nombre.trim().length < 2) { setError("Ingresa el nombre completo."); return; }
    if (!correo.includes("@"))    { setError("Ingresa un correo válido."); return; }

    const resultado = store.agregarRepartidorAdmin({
      name: nombre, dni, email: correo, phone: telefono, zona,
    });

    if (resultado.resultado === "email_taken") {
      setError("Ya existe una cuenta con ese correo electrónico.");
      return;
    }

    setCredenciales({ correo: resultado.driver.email!, password: resultado.passwordGenerado });
  }

  return (
    <Overlay onClose={onClose}>
      {!credenciales ? (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold">Nuevo repartidor</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Completa los datos. El sistema generará las credenciales de acceso.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Campo label="Nombre completo" completo>
              <input required maxLength={80} value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className={clsInput} placeholder="Juan Pérez" />
            </Campo>
            <Campo label="DNI">
              <input maxLength={15} value={dni}
                onChange={(e) => setDni(e.target.value)}
                className={clsInput} placeholder="12345678" />
            </Campo>
            <Campo label="Correo electrónico">
              <input required type="email" maxLength={120} value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                className={clsInput} placeholder="juan@correo.com" />
            </Campo>
            <Campo label="Teléfono">
              <input type="tel" maxLength={20} value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className={clsInput} placeholder="+51 999 999 999" />
            </Campo>
            <Campo label="Zona de reparto" completo>
              <input maxLength={60} value={zona}
                onChange={(e) => setZona(e.target.value)}
                className={clsInput} placeholder="San Martín de Porres, Los Olivos…" />
            </Campo>
          </div>

          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className={clsBtnSecundario}>Cancelar</button>
            <button type="submit" className={clsBtnAccent}>Registrar repartidor</button>
          </div>
        </form>
      ) : (
        /* Pantalla de credenciales generadas */
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-500/15 text-emerald-600">
              <KeyRound className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-xl font-semibold">Repartidor registrado</h2>
              <p className="text-sm text-muted-foreground">Comparte estas credenciales de acceso.</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/50 p-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Correo</span>
              <span className="font-mono font-medium">{credenciales.correo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Contraseña inicial</span>
              <span className="font-mono font-semibold text-accent-foreground">{credenciales.password}</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            El repartidor puede cambiar su contraseña desde "¿Olvidaste tu contraseña?" en el inicio de sesión.
          </p>

          <div className="flex justify-end">
            <button onClick={onClose} className={clsBtnAccent}>Entendido</button>
          </div>
        </div>
      )}
    </Overlay>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL: EDITAR / DESACTIVAR REPARTIDOR  (HU005 los 3 escenarios)
// ═══════════════════════════════════════════════════════════════════════════════

function DialogEditarRepartidor({ driver, onClose }: { driver: Driver; onClose: () => void }) {
  const [nombre,   setNombre]   = useState(driver.name);
  const [dni,      setDni]      = useState(driver.dni ?? "");
  const [correo,   setCorreo]   = useState(driver.email ?? "");
  const [telefono, setTelefono] = useState(driver.phone ?? "");
  const [zona,     setZona]     = useState(driver.zona ?? "");
  const [guardado, setGuardado] = useState(false);
  const [confirmarDesactivar, setConfirmarDesactivar] = useState(false);

  const activo = driver.activo !== false;

  function handleGuardar(e: FormEvent) {
    e.preventDefault();
    store.actualizarRepartidor(driver.id, {
      name: nombre.trim(),
      dni:  dni.trim() || undefined,
      email: correo.trim() || undefined,
      phone: telefono.trim() || undefined,
      zona: zona.trim() || undefined,
    });
    setGuardado(true);
    setTimeout(() => { setGuardado(false); onClose(); }, 1200);
  }

  function handleToggleActivo() {
    store.toggleActivoRepartidor(driver.id);
    onClose();
  }

  return (
    <Overlay onClose={onClose}>
      <div className="space-y-6">
        {/* Encabezado */}
        <div className="flex items-center gap-3">
          <Avatar nombre={driver.name} activo={activo} size="lg" />
          <div>
            <h2 className="text-xl font-semibold">Editar repartidor</h2>
            <p className="text-sm text-muted-foreground font-mono">{driver.id}</p>
          </div>
        </div>

        {/* Formulario de edición */}
        <form onSubmit={handleGuardar} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Campo label="Nombre completo" completo>
              <input required maxLength={80} value={nombre}
                onChange={(e) => setNombre(e.target.value)} className={clsInput} />
            </Campo>
            <Campo label="DNI">
              <input maxLength={15} value={dni}
                onChange={(e) => setDni(e.target.value)} className={clsInput} placeholder="12345678" />
            </Campo>
            <Campo label="Correo electrónico">
              <input type="email" maxLength={120} value={correo}
                onChange={(e) => setCorreo(e.target.value)} className={clsInput} />
            </Campo>
            <Campo label="Teléfono">
              <input type="tel" maxLength={20} value={telefono}
                onChange={(e) => setTelefono(e.target.value)} className={clsInput} />
            </Campo>
            <Campo label="Zona de reparto" completo>
              <input maxLength={60} value={zona}
                onChange={(e) => setZona(e.target.value)} className={clsInput} />
            </Campo>
          </div>

          <div className="flex items-center justify-between gap-4 pt-1">
            {guardado && <span className="text-sm text-emerald-600 font-medium">✓ Cambios guardados</span>}
            <div className="ml-auto flex gap-3">
              <button type="button" onClick={onClose} className={clsBtnSecundario}>Cancelar</button>
              <button type="submit" className={clsBtnAccent}>Guardar cambios</button>
            </div>
          </div>
        </form>

        {/* Zona de peligro */}
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <ShieldOff className="h-4 w-4" />
            Zona de peligro
          </div>

          {!confirmarDesactivar ? (
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs text-muted-foreground">
                {activo
                  ? "Desactivar la cuenta impide que el repartidor inicie sesión. Sus pedidos asignados no se modifican."
                  : "Reactivar la cuenta permite que el repartidor vuelva a iniciar sesión."}
              </p>
              <button
                type="button"
                onClick={() => setConfirmarDesactivar(true)}
                className={`flex-none rounded-md px-3 py-2 text-xs font-semibold transition ${
                  activo
                    ? "bg-destructive text-destructive-foreground hover:opacity-90"
                    : "bg-emerald-600 text-white hover:opacity-90"
                }`}
              >
                {activo ? "Desactivar cuenta" : "Reactivar cuenta"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                ¿Confirmas que quieres {activo ? "desactivar" : "reactivar"} la cuenta de{" "}
                <span className="text-foreground">{driver.name}</span>?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmarDesactivar(false)}
                  className={clsBtnSecundario}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleToggleActivo}
                  className={`rounded-md px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 ${
                    activo ? "bg-destructive" : "bg-emerald-600"
                  }`}
                >
                  Sí, {activo ? "desactivar" : "reactivar"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Overlay>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL: NUEVO PEDIDO (sin cambios funcionales)
// ═══════════════════════════════════════════════════════════════════════════════

/** Geocodifica una dirección contra Nominatim (Lima, Perú). */
async function geocodificarDireccion(dir: string): Promise<[number, number] | undefined> {
  const intentos = [
    dir.toLowerCase().includes("peru") || dir.toLowerCase().includes("perú")
      ? dir
      : `${dir}, Lima, Peru`,
    // Sin números de puerta ni código postal
    dir.normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/\b\d{4,5}\b/g, "").replace(/,\s*,/g, ",").trim() + ", Lima, Peru",
  ];

  for (const q of intentos) {
    try {
      const params = new URLSearchParams({ q, format: "json", limit: "1", countrycodes: "pe" });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { "Accept-Language": "es" },
      });
      if (!res.ok) continue;
      const data: { lat: string; lon: string }[] = await res.json();
      if (data.length) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    } catch { /* siguiente intento */ }
  }

  // Fallback: Photon (Komoot) con bbox Lima
  try {
    const sinNum = dir.normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/\b\d{4,5}\b/g, "").trim();
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

function DialogNuevoPedido({ onClose }: { onClose: () => void }) {
  const [cliente,        setCliente]        = useState("");
  const [telefono,       setTelefono]       = useState("");
  const [direccion,      setDireccion]      = useState("");
  const [alitas,         setAlitas]         = useState(12);
  const [salsa,          setSalsa]          = useState<Sauce>("Buffalo");
  const [notas,          setNotas]          = useState("");
  const [geocodificando, setGeocodificando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!cliente.trim() || !direccion.trim() || alitas < 1) return;

    setGeocodificando(true);
    const coords = await geocodificarDireccion(direccion.trim());
    setGeocodificando(false);

    store.addOrder({
      customer: cliente.trim().slice(0, 100),
      phone:    telefono.trim().slice(0, 40),
      address:  direccion.trim().slice(0, 200),
      wings:    Math.min(200, Math.max(1, alitas)),
      sauce:    salsa,
      notes:    notas.trim().slice(0, 200) || undefined,
      coords,   // guardadas al crear — el mapa del repartidor las usa directamente
    });
    onClose();
  }

  return (
    <Overlay onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold">Nuevo pedido de alitas</h2>
          <p className="mt-1 text-sm text-muted-foreground">Completa los datos del cliente y la salsa.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Campo label="Nombre del cliente">
            <input required maxLength={100} value={cliente}
              onChange={(e) => setCliente(e.target.value)} className={clsInput} />
          </Campo>
          <Campo label="Teléfono">
            <input maxLength={40} value={telefono}
              onChange={(e) => setTelefono(e.target.value)} className={clsInput} placeholder="+51 999 999 999" />
          </Campo>
          <Campo label="Dirección de entrega" completo>
            <input required maxLength={200} value={direccion}
              onChange={(e) => setDireccion(e.target.value)} className={clsInput}
              placeholder="Jr. Ejemplo 123, San Martín de Porres, Lima" />
          </Campo>
          <Campo label="Cantidad de alitas">
            <input required type="number" min={1} max={200} value={alitas}
              onChange={(e) => setAlitas(parseInt(e.target.value || "0", 10))} className={clsInput} />
          </Campo>
          <Campo label="Salsa">
            <select value={salsa} onChange={(e) => setSalsa(e.target.value as Sauce)} className={clsInput}>
              {SAUCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Campo>
          <Campo label="Notas" completo>
            <input maxLength={200} value={notas}
              onChange={(e) => setNotas(e.target.value)} className={clsInput} placeholder="Tocar dos veces, ranch extra…" />
          </Campo>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={geocodificando} className={clsBtnSecundario}>
            Cancelar
          </button>
          <button
            type="submit"
            disabled={geocodificando}
            className={`${clsBtnAccent} inline-flex items-center gap-2 disabled:opacity-60`}
          >
            {geocodificando
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Verificando dirección…</>
              : "Registrar pedido"}
          </button>
        </div>
      </form>
    </Overlay>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTES COMPARTIDOS
// ═══════════════════════════════════════════════════════════════════════════════

/** Contenedor de modal con fondo oscuro */
function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-elegant)]"
      >
        {children}
      </div>
    </div>
  );
}

/** Avatar circular con iniciales */
function Avatar({
  nombre, activo, size = "md",
}: { nombre: string; activo: boolean; size?: "md" | "lg" }) {
  const initiales = nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  const dim = size === "lg" ? "h-12 w-12 text-base" : "h-9 w-9 text-sm";
  return (
    <span className={`grid flex-none place-items-center rounded-full font-semibold ${dim} ${
      activo ? "bg-accent/20 text-accent-foreground" : "bg-muted text-muted-foreground"
    }`}>
      {initiales || "?"}
    </span>
  );
}

/** Pastilla estado activo/inactivo */
function PastillaActivo({ activo }: { activo: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${
      activo
        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
        : "bg-muted text-muted-foreground"
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${activo ? "bg-emerald-500" : "bg-muted-foreground"}`} />
      {activo ? "Activo" : "Inactivo"}
    </span>
  );
}

/** Select inline para cambiar el estado de un pedido */
const ESTADOS_PEDIDO: { value: OrderStatus; label: string }[] = [
  { value: "sin_asignar", label: "Sin asignar" },
  { value: "asignado",    label: "Asignado"    },
  { value: "en_camino",   label: "En camino"   },
  { value: "entregado",   label: "Entregado"   },
];

const ESTADO_COLOR: Record<string, string> = {
  sin_asignar: "bg-muted text-muted-foreground border-border",
  asignado:    "bg-accent/15 text-accent-foreground border-accent/30",
  en_camino:   "bg-primary/15 text-primary border-primary/30",
  entregado:   "bg-emerald-500/15 text-emerald-700 border-emerald-400/30 dark:text-emerald-300",
};

function SelectEstado({
  estado,
  onChange,
}: {
  estado: string;
  onChange: (s: OrderStatus) => void;
}) {
  return (
    <select
      value={estado}
      onChange={(e) => onChange(e.target.value as OrderStatus)}
      className={`rounded-md border px-2 py-1.5 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-ring/40 ${
        ESTADO_COLOR[estado] ?? "bg-muted text-muted-foreground border-border"
      }`}
    >
      {ESTADOS_PEDIDO.map((s) => (
        <option key={s.value} value={s.value}>{s.label}</option>
      ))}
    </select>
  );
}

/** Pastilla de estado de pedido */
function PastillaEstado({ estado }: { estado: string }) {
  const mapa: Record<string, string> = {
    sin_asignar: "bg-muted text-muted-foreground",
    asignado:    "bg-accent/20 text-accent-foreground",
    en_camino:   "bg-primary text-primary-foreground",
    entregado:   "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  };
  return (
    <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${mapa[estado] ?? ""}`}>
      {ESTADO_PEDIDO[estado] ?? estado}
    </span>
  );
}

/** Botón de navegación entre secciones */
function NavBtn({
  activo, onClick, icon, label,
}: { activo: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${
        activo
          ? "border-accent text-accent-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon} {label}
    </button>
  );
}

// ─── Helpers de tabla ─────────────────────────────────────────────────────────

function Encabezado({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">{children}</th>;
}
function Celda({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}

// ─── Helpers de formulario ────────────────────────────────────────────────────

const clsInput =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring/30 transition focus:border-ring focus:ring-2";
const clsBtnAccent =
  "rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:brightness-105";
const clsBtnSecundario =
  "rounded-md border border-border px-4 py-2 text-sm font-medium transition hover:bg-secondary";

function Campo({
  label, children, completo,
}: { label: string; children: React.ReactNode; completo?: boolean }) {
  return (
    <label className={`space-y-1.5 ${completo ? "col-span-2" : ""}`}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
