import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, Legend, ReferenceLine } from "recharts";
import {
  AlertTriangle, BarChart2, Check, ClipboardList, Copy, Edit2,
  KeyRound, LayoutDashboard, Loader2, LogOut, Plus, Settings, ShieldOff,
  Truck, UserCheck, UserX,
} from "lucide-react";
import { LogoIcon } from "../components/Logo";
import { store, useStore, SAUCES, type Sauce, type OrderStatus, type AcoConfig } from "@/lib/store";
import { ESTADO_PEDIDO_ES } from "@/lib/constants";
import { api } from "@/lib/api";
import { MapaSelectorUbicacion } from "@/components/MapaSelectorUbicacion";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Administrador — Ala K' Rico GO" }],
  }),
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const session = store.get().session;
    if (!session || session.role !== "admin") {
      throw redirect({ to: "/login" });
    }
  },
  component: PaginaAdmin,
});

// ─── Tipos ────────────────────────────────────────────────────────────────────

type SeccionAdmin = "dashboard" | "pedidos" | "repartidores" | "reportes" | "configuracion";

// ─── Traducciones ─────────────────────────────────────────────────────────────

const ESTADO_PEDIDO = ESTADO_PEDIDO_ES;

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
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <LogoIcon size={32} />
            <span className="font-display text-base tracking-wide">GO</span>
            <span className="ml-2 rounded-sm bg-secondary px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-secondary-foreground">
              Administrador
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {session?.email ?? "invitado"}
            </span>
            <Link
              to="/driver"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Truck className="h-4 w-4" />
              <span className="hidden sm:inline">Vista repartidor</span>
            </Link>
            <button
              onClick={cerrarSesion}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navegación de secciones */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl gap-0 overflow-x-auto px-4 sm:px-6">
          <NavBtn activo={seccion === "dashboard"}    onClick={() => setSeccion("dashboard")}    icon={<LayoutDashboard className="h-4 w-4" />} label="Dashboard" />
          <NavBtn activo={seccion === "pedidos"}      onClick={() => setSeccion("pedidos")}      icon={<ClipboardList className="h-4 w-4" />}  label="Pedidos" />
          <NavBtn activo={seccion === "repartidores"} onClick={() => setSeccion("repartidores")} icon={<Truck className="h-4 w-4" />}          label="Repartidores" />
          <NavBtn activo={seccion === "reportes"}     onClick={() => setSeccion("reportes")}     icon={<BarChart2 className="h-4 w-4" />}      label="Reportes" />
          <NavBtn activo={seccion === "configuracion"} onClick={() => setSeccion("configuracion")} icon={<Settings className="h-4 w-4" />}    label="Configuración" />
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {seccion === "dashboard"    && <SeccionDashboard />}
        {seccion === "pedidos"      && <SeccionPedidos />}
        {seccion === "repartidores" && <SeccionRepartidores />}
        {seccion === "reportes"     && <SeccionReportes />}
        {seccion === "configuracion" && <SeccionConfiguracion />}
      </main>

      <footer className="mt-auto border-t border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2">
            <LogoIcon size={18} />
            <span className="text-xs font-medium text-muted-foreground">
              Ala K' Rico GO — Panel Administrativo
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Optimización de rutas ACO · {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN: DASHBOARD (HU030)
// ═══════════════════════════════════════════════════════════════════════════════

function SeccionDashboard() {
  const [dash,    setDash]    = useState<import("@/lib/api").DashboardApi | null>(null);
  const [pedidos, setPedidos] = useState<import("@/lib/api").PedidoApi[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    Promise.all([
      api.dashboard().then(setDash).catch(() => {}),
      api.listarPedidosAdmin({ pageSize: 100 }).then((r) => setPedidos(r.items ?? [])).catch(() => {}),
    ]).finally(() => setCargando(false));
  }, []);

  const kpis = dash?.kpis;

  const CHART_COLORS: Record<string, string> = {
    "Sin asignar": "var(--amber)",
    "Asignados":   "var(--accent)",
    "En camino":   "var(--primary)",
    "Entregados":  "oklch(0.60 0.17 150)",
    "Cancelados":  "var(--destructive)",
  };

  const pedidosPorEstado = dash?.porEstado
    ? [
        { label: "Sin asignar", count: dash.porEstado.find((e) => e.Estado === "sin_asignar")?.cantidad ?? 0, color: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" },
        { label: "Asignados",   count: dash.porEstado.find((e) => e.Estado === "asignado")?.cantidad   ?? 0, color: "bg-accent/20 text-accent" },
        { label: "En camino",   count: dash.porEstado.find((e) => e.Estado === "en_camino")?.cantidad  ?? 0, color: "bg-primary/15 text-primary" },
        { label: "Entregados",  count: dash.porEstado.find((e) => e.Estado === "entregado")?.cantidad  ?? 0, color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
        { label: "Cancelados",  count: dash.porEstado.find((e) => e.Estado === "cancelado")?.cantidad  ?? 0, color: "bg-destructive/15 text-destructive" },
      ]
    : [];

  const recientes = dash?.recientes ?? [];

  const totalSistema   = pedidosPorEstado.reduce((s, e) => s + e.count, 0);
  const entregadosTotal = pedidosPorEstado.find((e) => e.label === "Entregados")?.count ?? 0;
  const canceladosTotal = pedidosPorEstado.find((e) => e.label === "Cancelados")?.count ?? 0;
  const tasaHistorica   = totalSistema > 0 ? Math.round((entregadosTotal / totalSistema) * 100) : 0;

  const porSemana = (() => {
    const MAX_MIN = 1440;
    const mapa = new Map<string, { suma: number; count: number }>();
    pedidos.forEach((p) => {
      if (!p.Entrega_Pedido || !p.Creacion_Pedido) return;
      const mins = (new Date(p.Entrega_Pedido).getTime() - new Date(p.Creacion_Pedido).getTime()) / 60000;
      if (mins <= 0 || mins > MAX_MIN) return;
      const d = new Date(p.Creacion_Pedido);
      d.setHours(0, 0, 0, 0);
      const offset = d.getDay() === 0 ? -6 : 1 - d.getDay();
      d.setDate(d.getDate() + offset);
      const key = d.toISOString().slice(0, 10);
      if (!mapa.has(key)) mapa.set(key, { suma: 0, count: 0 });
      const w = mapa.get(key)!;
      w.suma += mins;
      w.count++;
    });
    return Array.from(mapa.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, { suma, count }]) => {
        const lunes = new Date(key + "T00:00:00");
        const label = lunes.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
        return { semana: label, avg: Math.round(suma / count), n: count };
      });
  })();

  const porMes = (() => {
    const mapa = new Map<string, { total: number; entregados: number; cancelados: number }>();
    pedidos.forEach((p) => {
      const key = p.Creacion_Pedido?.slice(0, 7);
      if (!key) return;
      if (!mapa.has(key)) mapa.set(key, { total: 0, entregados: 0, cancelados: 0 });
      const m = mapa.get(key)!;
      m.total++;
      if (p.Estado === "entregado") m.entregados++;
      if (p.Estado === "cancelado") m.cancelados++;
    });
    return Array.from(mapa.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, vals]) => {
        const [y, mo] = key.split("-");
        const label = new Date(+y, +mo - 1).toLocaleDateString("es-PE", { month: "short", year: "2-digit" });
        return { mes: label, ...vals };
      });
  })();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Resumen operativo en tiempo real.</p>
      </div>

      <div aria-live="polite" aria-busy={cargando} aria-label="Estado del dashboard">
      {cargando ? (
        <div className="flex items-center gap-2 text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Cargando datos...
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPIs principales */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard titulo="Pedidos hoy"          valor={kpis?.total_hoy ?? 0}   sufijo="" highlight />
            <KpiCard titulo="Activos ahora"         valor={kpis?.activos ?? 0}     sufijo="" />
            <KpiCard titulo="Repartidores activos"  valor={kpis?.repartidores_activos ?? 0} sufijo="" />
            <KpiCard titulo="Entregados hoy"        valor={kpis?.entregados ?? 0}  sufijo="" highlight />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <KpiCard titulo="Tiempo promedio de entrega" valor={kpis?.avg_minutos != null ? `${Math.round(kpis.avg_minutos)} min` : "Sin datos"} sufijo="" />
            <KpiCard titulo="Total pedidos sistema"      valor={totalSistema} sufijo="" />
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

          {/* Totales históricos */}
          <div>
            <h2 className="mb-3 text-base font-semibold">Totales históricos</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard titulo="Total en sistema"        valor={totalSistema}      sufijo="" />
              <KpiCard titulo="Total entregados"       valor={entregadosTotal}   sufijo="" />
              <KpiCard titulo="Total cancelados"       valor={canceladosTotal}   sufijo="" />
              <KpiCard titulo="Tasa de éxito histórica" valor={`${tasaHistorica}%`} sufijo="" highlight />
            </div>
          </div>

          {/* Evolución mensual */}
          {porMes.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="mb-4 text-base font-semibold">Evolución mensual de pedidos</h2>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={porMes} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "13px" }}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Line type="monotone" dataKey="total"      name="Total"      stroke="var(--accent)"      strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="entregados" name="Entregados" stroke="oklch(0.60 0.17 150)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="cancelados" name="Cancelados" stroke="var(--destructive)"  strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Evolución semanal del tiempo promedio */}
          {porSemana.length >= 2 && (
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-1 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold">Tiempo promedio de entrega — por semana</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Minutos desde creación hasta entrega · excluye pedidos &gt; 24 h
                  </p>
                </div>
                <span className="shrink-0 rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  SLA: 45 min
                </span>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={porSemana} margin={{ top: 16, right: 12, bottom: 0, left: 0 }}>
                  <XAxis dataKey="semana" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={32}
                    tickFormatter={(v) => `${v}m`}
                  />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }}
                    labelStyle={{ fontWeight: 600, marginBottom: "2px" }}
                    formatter={(v: number, name: string) =>
                      name === "Promedio" ? [`${v} min`, name] : [v, name]
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <ReferenceLine
                    y={45}
                    stroke="var(--destructive)"
                    strokeDasharray="4 3"
                    strokeWidth={1.5}
                    label={{ value: "45 min", position: "insideTopRight", fontSize: 10, fill: "var(--destructive)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avg"
                    name="Promedio"
                    stroke="var(--accent)"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "var(--accent)", strokeWidth: 0 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="n"
                    name="Pedidos"
                    stroke="var(--muted-foreground)"
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Gráfico pedidos por estado */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-base font-semibold">Pedidos por estado</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={pedidosPorEstado} barCategoryGap="30%">
                <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "13px" }}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Bar dataKey="count" name="Pedidos" radius={[4, 4, 0, 0]}>
                  {pedidosPorEstado.map((e) => (
                    <Cell key={e.label} fill={CHART_COLORS[e.label] ?? "var(--muted-foreground)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Últimos pedidos */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-base font-semibold">Últimos pedidos</h2>
            {recientes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin pedidos registrados.</p>
            ) : (
              <div className="space-y-2">
                {recientes.map((p) => (
                  <div key={p.Id_Pedido} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-4 py-2.5 text-sm">
                    <span className="font-mono text-xs text-muted-foreground shrink-0">#{p.Id_Pedido}</span>
                    <span className="font-medium min-w-0 truncate">{p.Nombre_Cliente ?? "Cliente"}</span>
                    <span className="hidden text-xs text-muted-foreground sm:inline shrink-0">{p.Creacion_Pedido?.slice(0, 10)}</span>
                    <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${ESTADO_COLOR[p.Estado] ?? ""}`}>
                      {ESTADO_PEDIDO[p.Estado] ?? p.Estado}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function KpiCard({ titulo, valor, sufijo, highlight }: { titulo: string; valor: string | number; sufijo?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-5 ${highlight ? "border-accent/40 bg-accent/5" : "border-border bg-card"}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <p className={`mt-2 text-3xl font-bold ${highlight ? "text-accent" : ""}`}>
        {valor}{sufijo}
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN: REPORTES (HU026 / HU027)
// ═══════════════════════════════════════════════════════════════════════════════

function SeccionReportes() {
  type T = import("@/lib/api").ReporteTiemposApi;
  type R = import("@/lib/api").RankingRepartidorApi;
  type P = import("@/lib/api").PedidoApi;
  type F = import("@/lib/api").PilotoFaseApi;
  type A = import("@/lib/api").AuditoriaApi;

  const [tiempos,   setTiempos]   = useState<T | null>(null);
  const [ranking,   setRanking]   = useState<R[]>([]);
  const [pedidos,   setPedidos]   = useState<P[]>([]);
  const [piloto,    setPiloto]    = useState<F[]>([]);
  const [auditoria, setAuditoria] = useState<A[]>([]);
  const [cargando,  setCargando]  = useState(true);
  const [errCarga,  setErrCarga]  = useState<string | null>(null);
  const [desde,     setDesde]     = useState("");
  const [hasta,     setHasta]     = useState("");

  const cargarTiempos = (d?: string, h?: string) =>
    api.reporteTiempos(d || h ? { desde: d, hasta: h } : undefined).then(setTiempos).catch(() => {});

  useEffect(() => {
    setCargando(true);
    setErrCarga(null);
    Promise.all([
      cargarTiempos(),
      api.reporteRepartidores().then(setRanking).catch(() => {}),
      api.listarPedidosAdmin({ pageSize: 20 })
        .then((r) => setPedidos(r.items ?? []))
        .catch((e: unknown) => {
          const msg = e instanceof Error ? e.message : String(e);
          setErrCarga((prev) => prev ? prev : `Historial: ${msg}`);
        }),
      api.reportePiloto().then(setPiloto).catch(() => {}),
      api.listarAuditoria({ pageSize: 50 })
        .then((r) => setAuditoria(r.items ?? []))
        .catch((e: unknown) => {
          const msg = e instanceof Error ? e.message : String(e);
          setErrCarga((prev) => prev ? `${prev} / Auditoría: ${msg}` : `Auditoría: ${msg}`);
        }),
    ]).finally(() => setCargando(false));
  }, []);

  const promGlobal = tiempos?.promedio ?? 0;

  // Agrupar piloto por fase para resumen
  const faseSummary = ["FIFO", "ACO"].map((f) => {
    const rows = piloto.filter((r) => r.fase === f);
    if (!rows.length) return null;
    const totalN   = rows.reduce((s, r) => s + r.n, 0);
    const tpeProm  = totalN ? rows.reduce((s, r) => s + r.tpe_promedio * r.n, 0) / totalN : 0;
    const pct45    = totalN ? rows.reduce((s, r) => s + (r.pct_45min * r.n) / 100, 0) / totalN * 100 : 0;
    const tpeMin   = Math.min(...rows.map((r) => r.tpe_min));
    const tpeMax   = Math.max(...rows.map((r) => r.tpe_max));
    return { fase: f, n: totalN, tpeProm: tpeProm.toFixed(1), tpeMin, tpeMax, pct45: pct45.toFixed(1) };
  }).filter(Boolean);

  const EVENTO_COLOR: Record<string, string> = {
    login_ok:          "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    login_fallido:     "bg-destructive/10 text-destructive",
    repartidor_creado: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    pedido_creado:     "bg-accent/10 text-accent",
    aco_config_update: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Reportes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Estadísticas en tiempo real desde SQL Server.
        </p>
      </div>

      {cargando && (
        <div className="flex items-center gap-2 text-muted-foreground" role="status" aria-live="polite">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Cargando datos…
        </div>
      )}

      {errCarga && !cargando && (
        <p className="rounded-md bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          Error al cargar datos: {errCarga}
        </p>
      )}

      {/* ── Filtro de fechas ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-4">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Desde</span>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
            className="block rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Hasta</span>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
            className="block rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
        </label>
        <button
          onClick={() => cargarTiempos(desde || undefined, hasta || undefined)}
          className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Aplicar filtro
        </button>
        {(desde || hasta) && (
          <button onClick={() => { setDesde(""); setHasta(""); cargarTiempos(); }}
            className="rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Limpiar
          </button>
        )}
      </div>

      {/* ── Tiempos de entrega (HU026) ─────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">Tiempos de entrega (entregas completadas)</h2>
        {!tiempos || tiempos.total === 0 ? (
          <p className="text-sm text-muted-foreground">Sin entregas completadas en el período seleccionado.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-5">
            {[
              { label: "Total entregas",  val: tiempos.total,                             color: "" },
              { label: "Promedio",        val: tiempos.promedio != null ? `${tiempos.promedio} min` : "—",   color: "text-accent" },
              { label: "Mínimo",          val: tiempos.minimo   != null ? `${tiempos.minimo} min`   : "—",   color: "text-emerald-600" },
              { label: "Máximo",          val: tiempos.maximo   != null ? `${tiempos.maximo} min`   : "—",   color: "text-primary" },
              { label: "Desv. estándar",  val: tiempos.desviacion != null ? `${Math.round(tiempos.desviacion)} min` : "—", color: "" },
            ].map((c) => (
              <div key={c.label} className="rounded-xl border border-border bg-muted/30 p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{c.label}</p>
                <p className={`mt-1 text-2xl font-bold ${c.color}`}>{c.val}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Comparativa FIFO vs ACO (tesis) ───────────────────────────────── */}
      {faseSummary.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-1 text-base font-semibold">Comparativa piloto — FIFO vs ACO</h2>
          <p className="mb-4 text-xs text-muted-foreground">Datos del experimento de la tesis (Tabla A.1)</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {faseSummary.map((f) => f && (
              <div key={f.fase} className={`rounded-xl border p-5 ${f.fase === "ACO" ? "border-accent/40 bg-accent/5" : "border-border bg-muted/20"}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className={`rounded-md px-2.5 py-0.5 text-sm font-bold ${f.fase === "ACO" ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"}`}>
                    {f.fase}
                  </span>
                  <span className="text-sm text-muted-foreground">{f.n} pedidos</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">TPE promedio</span><span className="font-bold">{f.tpeProm} min</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">TPE mínimo</span><span>{f.tpeMin} min</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">TPE máximo</span><span>{f.tpeMax} min</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Entregas ≤ 45 min</span>
                    <span className={`font-semibold ${parseFloat(f.pct45) >= 80 ? "text-emerald-600" : "text-destructive"}`}>{f.pct45}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Tabla por jornada */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-secondary text-secondary-foreground">
                <tr className="text-left">
                  <Encabezado>Jornada</Encabezado>
                  <Encabezado>Fase</Encabezado>
                  <Encabezado>Pedidos</Encabezado>
                  <Encabezado>TPE promedio</Encabezado>
                  <Encabezado>TPE min</Encabezado>
                  <Encabezado>TPE max</Encabezado>
                  <Encabezado>≤ 45 min</Encabezado>
                </tr>
              </thead>
              <tbody>
                {piloto.map((r) => (
                  <tr key={`${r.fase}-${r.jornada}`} className="border-t border-border">
                    <Celda className="font-mono">{r.jornada}</Celda>
                    <Celda><span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${r.fase === "ACO" ? "bg-accent/15 text-accent" : "bg-secondary"}`}>{r.fase}</span></Celda>
                    <Celda>{r.n}</Celda>
                    <Celda className="font-medium">{r.tpe_promedio} min</Celda>
                    <Celda>{r.tpe_min} min</Celda>
                    <Celda>{r.tpe_max} min</Celda>
                    <Celda className={parseFloat(String(r.pct_45min)) >= 80 ? "text-emerald-600 font-semibold" : "text-destructive"}>{r.pct_45min}%</Celda>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Ranking repartidores (HU027) ──────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">Desempeño de repartidores</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr className="text-left">
                <Encabezado>#</Encabezado>
                <Encabezado>Repartidor</Encabezado>
                <Encabezado>Total asignados</Encabezado>
                <Encabezado>Entregados</Encabezado>
                <Encabezado>TPE promedio</Encabezado>
                <Encabezado>Alerta</Encabezado>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r, i) => {
                const bajDesempeno = promGlobal > 0 && r.avg_minutos != null && r.avg_minutos > promGlobal * 1.3;
                return (
                  <tr key={r.Id_Usuario} className="border-t border-border">
                    <Celda className="font-mono text-xs text-muted-foreground">#{i + 1}</Celda>
                    <Celda>
                      <div className="font-medium">{r.Nombre}</div>
                      <div className="text-xs text-muted-foreground font-mono">ID #{r.Id_Usuario}</div>
                    </Celda>
                    <Celda>{r.total_pedidos}</Celda>
                    <Celda><span className="font-semibold text-emerald-700 dark:text-emerald-400">{r.entregados}</span></Celda>
                    <Celda>
                      {r.avg_minutos != null
                        ? <span className={bajDesempeno ? "text-destructive font-semibold" : ""}>{Math.round(r.avg_minutos)} min</span>
                        : <span className="text-muted-foreground">—</span>}
                    </Celda>
                    <Celda>
                      {bajDesempeno
                        ? <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"><AlertTriangle className="h-3 w-3" /> Atención</span>
                        : <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">OK</span>}
                    </Celda>
                  </tr>
                );
              })}
              {ranking.length === 0 && !cargando && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">Sin datos de repartidores.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Historial de pedidos (HU028) ──────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">Historial de pedidos (últimos 20)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr className="text-left">
                <Encabezado>#</Encabezado>
                <Encabezado>Cliente</Encabezado>
                <Encabezado>Repartidor</Encabezado>
                <Encabezado>Estado</Encabezado>
                <Encabezado>TPE</Encabezado>
                <Encabezado>Fecha</Encabezado>
              </tr>
            </thead>
            <tbody>
              {pedidos.slice(0, 20).map((p) => {
                const tpe = p.Entrega_Pedido && p.Creacion_Pedido
                  ? Math.round((new Date(p.Entrega_Pedido).getTime() - new Date(p.Creacion_Pedido).getTime()) / 60000)
                  : null;
                const repNombre = p.Nombre_Repartidor
                  ? `${p.Nombre_Repartidor} ${p.Apellido_Repartidor ?? ""}`.trim()
                  : null;
                return (
                  <tr key={p.Id_Pedido} className="border-t border-border">
                    <Celda className="font-mono text-xs text-muted-foreground">#{p.Id_Pedido}</Celda>
                    <Celda>{p.Nombre_Cliente} {p.Apellido_Cliente}</Celda>
                    <Celda>{repNombre ?? <span className="text-muted-foreground">—</span>}</Celda>
                    <Celda>
                      <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${ESTADO_COLOR[p.Estado] ?? ""}`}>
                        {ESTADO_PEDIDO[p.Estado] ?? p.Estado}
                      </span>
                    </Celda>
                    <Celda>{tpe != null ? `${tpe} min` : <span className="text-muted-foreground">—</span>}</Celda>
                    <Celda className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(p.Creacion_Pedido).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}
                    </Celda>
                  </tr>
                );
              })}
              {pedidos.length === 0 && !cargando && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">Sin pedidos registrados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Log de auditoría (HU019) ──────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">Log de auditoría (últimos 50 eventos)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr className="text-left">
                <Encabezado>Timestamp</Encabezado>
                <Encabezado>Usuario</Encabezado>
                <Encabezado>Evento</Encabezado>
                <Encabezado>Detalle</Encabezado>
                <Encabezado>IP</Encabezado>
              </tr>
            </thead>
            <tbody>
              {auditoria.map((a) => (
                <tr key={a.Id_Log} className="border-t border-border">
                  <Celda className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(a.Timestamp).toLocaleString("es-PE", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}
                  </Celda>
                  <Celda className="text-xs">
                    {a.Nombre_Usuario ?? a.Email_Intento ?? <span className="text-muted-foreground">—</span>}
                  </Celda>
                  <Celda>
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${EVENTO_COLOR[a.Evento] ?? "bg-muted text-muted-foreground"}`}>
                      {a.Evento}
                    </span>
                  </Celda>
                  <Celda className="max-w-xs text-xs text-muted-foreground truncate">{a.Detalle ?? "—"}</Celda>
                  <Celda className="font-mono text-xs text-muted-foreground">{a.IP ?? "—"}</Celda>
                </tr>
              ))}
              {auditoria.length === 0 && !cargando && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">Sin eventos registrados.</td></tr>
              )}
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
  alfa:       { min: 0.5, max: 5,    step: 0.1,   label: "Alfa (α) — Peso de feromonas" },
  beta:       { min: 0.5, max: 5,    step: 0.1,   label: "Beta (β) — Peso heurístico" },
  rho:        { min: 0.01, max: 0.9, step: 0.01,  label: "Rho (ρ) — Tasa de evaporación" },
  Q:          { min: 0.1, max: 10,   step: 0.1,   label: "Q — Constante de feromona" },
  numAnts:    { min: 5,   max: 100,  step: 1,     label: "Número de hormigas" },
  iterations: { min: 10,  max: 200,  step: 5,     label: "Iteraciones" },
  elite:      { min: 0,   max: 10,   step: 1,     label: "Refuerzo élite" },
  tauMin:     { min: 0.001, max: 0.5, step: 0.001, label: "Tau mínimo (piso de feromona)" },
};

const ACO_AYUDA: Record<keyof AcoConfig, { icono: string; desc: string; subir: string; bajar: string }> = {
  alfa: {
    icono: "🐜",
    desc: "Qué tanto influye el historial de rutas exitosas al elegir el camino. Valores altos hacen que el algoritmo confíe más en la experiencia acumulada.",
    subir: "Sigue más rutas ya probadas y exitosas.",
    bajar: "Explora más caminos nuevos y menos conocidos.",
  },
  beta: {
    icono: "📍",
    desc: "Qué tanto importa la distancia directa al destino. Valores altos priorizan ir siempre hacia el punto más cercano.",
    subir: "Favorece las rutas más cortas en distancia.",
    bajar: "Permite rodeos si el historial indica que son mejores.",
  },
  rho: {
    icono: "💨",
    desc: "Qué tan rápido se 'olvidan' las rutas malas con el tiempo (evaporación). Controla el equilibrio entre explorar y explotar.",
    subir: "Olvida rápido, explora más rutas distintas.",
    bajar: "Recuerda más rutas pasadas, converge más rápido.",
  },
  Q: {
    icono: "⚗️",
    desc: "Cuánta señal deja una hormiga al completar una buena ruta. Es el \"premio\" que se deposita en el camino elegido.",
    subir: "Refuerza más las rutas buenas encontradas.",
    bajar: "Refuerzo más suave, decisiones más equilibradas.",
  },
  numAnts: {
    icono: "🔢",
    desc: "Cuántas rutas distintas se prueban al mismo tiempo en cada ciclo de búsqueda. Más hormigas = más opciones evaluadas.",
    subir: "Más variedad y precisión, pero el cálculo tarda más.",
    bajar: "Más rápido, pero puede pasar por alto buenas rutas.",
  },
  iterations: {
    icono: "🔄",
    desc: "Cuántas veces repite el proceso completo antes de entregar el resultado final. Es el límite de tiempo de búsqueda.",
    subir: "Más tiempo de cálculo, mejor calidad de ruta.",
    bajar: "Resultado más rápido, posiblemente menos óptimo.",
  },
  elite: {
    icono: "⭐",
    desc: "Cuánto refuerzo extra recibe la mejor ruta encontrada hasta el momento. Útil para consolidar soluciones buenas. 0 = desactivado.",
    subir: "La mejor ruta acumula señal más fuerte y se impone.",
    bajar: "Todas las rutas compiten en igualdad de condiciones.",
  },
  tauMin: {
    icono: "📊",
    desc: "Nivel mínimo de señal que mantiene cualquier ruta, aunque nunca haya sido usada. Evita que el algoritmo se quede atascado.",
    subir: "Garantiza exploración de rutas poco usadas.",
    bajar: "Las rutas malas casi desaparecen del mapa.",
  },
};

function GuiaACO({ activo }: { activo: keyof AcoConfig | null }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden sticky top-6">
      <div className="border-b border-border bg-muted/40 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Guía de parámetros
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Haz clic en un campo para ver su explicación resaltada.
        </p>
      </div>
      <div className="divide-y divide-border">
        {(Object.keys(ACO_AYUDA) as (keyof AcoConfig)[]).map((campo) => {
          const ayuda = ACO_AYUDA[campo];
          const rango = ACO_RANGOS[campo];
          const esActivo = activo === campo;
          return (
            <div
              key={campo}
              className={`px-4 py-3 transition-colors ${
                esActivo ? "bg-accent/8 border-l-2 border-l-accent" : "border-l-2 border-l-transparent"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base leading-none">{ayuda.icono}</span>
                <span className={`text-xs font-semibold ${esActivo ? "text-accent" : "text-foreground"}`}>
                  {rango.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                {ayuda.desc}
              </p>
              <div className="flex flex-col gap-1">
                <span className="text-xs">
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">↑ Subir: </span>
                  <span className="text-muted-foreground">{ayuda.subir}</span>
                </span>
                <span className="text-xs">
                  <span className="font-medium text-amber-600 dark:text-amber-400">↓ Bajar: </span>
                  <span className="text-muted-foreground">{ayuda.bajar}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SeccionConfiguracion() {
  const acoConfig = useStore((s) => s.acoConfig);
  const [local,        setLocal]       = useState<AcoConfig>({ ...acoConfig });
  const [guardada,     setGuardada]    = useState<AcoConfig>({ ...acoConfig });
  const [errores,      setErrores]     = useState<Partial<Record<keyof AcoConfig, string>>>({});
  const [guardado,     setGuardado]    = useState(false);
  const [cargando,     setCargando]    = useState(true);
  const [errorApi,     setErrorApi]    = useState<string | null>(null);
  const [guardando,    setGuardando]   = useState(false);
  const [campoActivo,  setCampoActivo] = useState<keyof AcoConfig | null>(null);
  const [guiaVisible,  setGuiaVisible] = useState(false);

  useEffect(() => {
    api.obtenerAcoConfig()
      .then((cfg) => {
        setLocal(cfg);
        setGuardada(cfg);
        store.updateAcoConfig(cfg);
      })
      .catch(() => {})
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
      setGuardada({ ...local });
      store.updateAcoConfig(local);
    } catch {
      setErrorApi("No se pudo guardar en el servidor.");
    }
    setGuardando(false);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 3000);
  }

  function handleReset() {
    setLocal({ ...guardada });
    setErrores({});
    setGuardado(false);
    setErrorApi(null);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Configuración ACO</h1>
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
      <div className={`grid gap-6 items-start ${guiaVisible ? "lg:grid-cols-[1fr_290px]" : ""}`}>
        {/* ── Formulario ── */}
        <form onSubmit={handleGuardar} className="rounded-xl border border-border bg-card p-6 space-y-6">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Haz clic en un campo para ver su descripción.</p>
            <button
              type="button"
              onClick={() => setGuiaVisible((v) => !v)}
              className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {guiaVisible ? "Ocultar guía" : "Ver guía de parámetros"}
            </button>
          </div>
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
                    onFocus={() => setCampoActivo(campo)}
                    className={`${clsInput} ${errores[campo] ? "border-destructive" : ""}`}
                  />
                  {errores[campo] && (
                    <p className="text-xs text-destructive">{errores[campo]}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Rango: {rango.min} – {rango.max}
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
              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                ✓ Guardado. Se aplica en el próximo cálculo ACO.
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

        {/* ── Guía lateral ── */}
        {guiaVisible && <GuiaACO activo={campoActivo} />}
      </div>
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

type FiltroEstado = "todos" | "activos" | "completados";

function SeccionPedidos() {
  const [pedidos,      setPedidos]      = useState<import("@/lib/api").PedidoApi[]>([]);
  const [totalItems,   setTotalItems]   = useState(0);
  const [totalPages,   setTotalPages]   = useState(1);
  const [page,         setPage]         = useState(1);
  const [repartidores, setRepartidores] = useState<import("@/lib/api").RepartidorApi[]>([]);
  const [conteoSistema, setConteoSistema] = useState<{ activos: number; completados: number; total: number }>({ activos: 0, completados: 0, total: 0 });
  const [cargando,     setCargando]     = useState(true);
  const [errCarga,     setErrCarga]     = useState<string | null>(null);
  const [abierto,      setAbierto]      = useState(false);
  const [copiado,      setCopiado]      = useState<number | null>(null);
  const [filtro,       setFiltro]       = useState<FiltroEstado>("todos");
  const [confirm,      setConfirm]      = useState<{ mensaje: string; detalle?: string; accion: () => void } | null>(null);

  const PAGE_SIZE = 20;

  const grupoFiltro: "activos" | "completados" | undefined =
    filtro === "activos"     ? "activos"
    : filtro === "completados" ? "completados"
    : undefined;

  const cargar = (p = page, g = grupoFiltro) => {
    setCargando(true);
    setErrCarga(null);
    Promise.allSettled([
      api.listarPedidosAdmin({ page: p, pageSize: PAGE_SIZE, grupo: g }),
      api.listarRepartidores(),
    ])
      .then(([pedRes, repRes]) => {
        if (pedRes.status === "fulfilled") {
          setPedidos(pedRes.value.items ?? []);
          setTotalItems(pedRes.value.totalItems);
          setTotalPages(pedRes.value.totalPages);
        } else {
          const msg = pedRes.reason instanceof Error ? pedRes.reason.message : String(pedRes.reason);
          setErrCarga(`Error al cargar pedidos: ${msg}`);
        }
        if (repRes.status === "fulfilled") {
          setRepartidores(repRes.value);
        }
      })
      .finally(() => setCargando(false));
  };

  // Carga los conteos reales del sistema (activos/completados/total) desde el dashboard
  useEffect(() => {
    api.dashboard().then((d) => {
      const porEstado = d.porEstado ?? [];
      const activos = porEstado
        .filter((e) => ["sin_asignar", "asignado", "en_camino"].includes(e.Estado))
        .reduce((s, e) => s + e.cantidad, 0);
      const completados = porEstado
        .filter((e) => ["entregado", "cancelado"].includes(e.Estado))
        .reduce((s, e) => s + e.cantidad, 0);
      const total = porEstado.reduce((s, e) => s + e.cantidad, 0);
      setConteoSistema({ activos, completados, total });
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { cargar(page, grupoFiltro); }, [page, filtro]); // eslint-disable-line react-hooks/exhaustive-deps

  async function ejecutarCambioEstado(id: number, estado: string) {
    await api.cambiarEstadoPedido(id, estado).catch(() => {});
    cargar(page);
  }

  function cambiarEstado(id: number, estadoNuevo: string, estadoActual: string) {
    const etiquetas: Record<string, string> = {
      sin_asignar: "Sin asignar", asignado: "Asignado",
      en_camino: "En camino", entregado: "Entregado", cancelado: "Cancelado",
    };
    setConfirm({
      mensaje: `¿Cambiar pedido AKA-${String(id).padStart(4, "0")} a "${etiquetas[estadoNuevo] ?? estadoNuevo}"?`,
      detalle: `Estado actual: ${etiquetas[estadoActual] ?? estadoActual}`,
      accion: () => ejecutarCambioEstado(id, estadoNuevo),
    });
  }

  async function ejecutarAsignacion(idPedido: number, idRepartidor: number | null) {
    await api.asignarPedido(idPedido, idRepartidor).catch(() => {});
    cargar(page);
  }

  function asignarRepartidor(idPedido: number, idRepartidor: number | null, nombreRepartidor?: string) {
    const msg = idRepartidor
      ? `¿Asignar el pedido AKA-${String(idPedido).padStart(4, "0")} a ${nombreRepartidor ?? "este repartidor"}?`
      : `¿Quitar la asignación del pedido AKA-${String(idPedido).padStart(4, "0")}?`;
    setConfirm({ mensaje: msg, accion: () => ejecutarAsignacion(idPedido, idRepartidor) });
  }

  function copiarSeguimiento(id: number) {
    navigator.clipboard?.writeText(`${window.location.origin}/seguimiento/${id}`);
    setCopiado(id);
    setTimeout(() => setCopiado(null), 1500);
  }

  const repsActivos = repartidores.filter((r) => r.Activo_Usuario);

  const ESTADOS_ACTIVOS    = ["sin_asignar", "asignado", "en_camino"];
  const ESTADOS_COMPLETADOS = ["entregado", "cancelado"];

  const pedidosFiltrados = pedidos.filter((p) => {
    if (filtro === "activos")     return ESTADOS_ACTIVOS.includes(p.Estado);
    if (filtro === "completados") return ESTADOS_COMPLETADOS.includes(p.Estado);
    return true;
  });

  const cntActivos     = pedidos.filter((p) => ESTADOS_ACTIVOS.includes(p.Estado)).length;
  const cntCompletados = pedidos.filter((p) => ESTADOS_COMPLETADOS.includes(p.Estado)).length;

  const TABS: { key: FiltroEstado; label: string; count: number }[] = [
    { key: "activos",     label: "Activos",     count: conteoSistema.activos },
    { key: "completados", label: "Completados",  count: conteoSistema.completados },
    { key: "todos",       label: "Todos",        count: conteoSistema.total },
  ];

  return (
    <>
      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Tablero de pedidos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {cargando
              ? "Cargando…"
              : `${conteoSistema.activos} activo${conteoSistema.activos !== 1 ? "s" : ""} · ${conteoSistema.completados} completado${conteoSistema.completados !== 1 ? "s" : ""} · ${conteoSistema.total} total`}
          </p>
        </div>
        <button
          onClick={() => setAbierto(true)}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground shadow-[var(--shadow-amber)] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="h-4 w-4" /> Nuevo pedido
        </button>
      </div>

      {errCarga && !cargando && (
        <p className="rounded-md bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{errCarga}</p>
      )}

      {/* Tabs de filtro */}
      <div className="mt-5 flex gap-1 rounded-lg border border-border bg-secondary p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setFiltro(tab.key); setPage(1); }}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              filtro === tab.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              filtro === tab.key ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-secondary text-secondary-foreground">
            <tr className="text-left">
              <Encabezado className="w-28">Pedido</Encabezado>
              <Encabezado className="min-w-[9rem]">Cliente</Encabezado>
              <Encabezado className="w-[11rem]">Dirección</Encabezado>
              <Encabezado className="w-[11rem]">Productos</Encabezado>
              <Encabezado className="w-36">Estado</Encabezado>
              <Encabezado className="w-52">Repartidor</Encabezado>
              <Encabezado className="w-32">Fecha</Encabezado>
              <Encabezado className="w-24">Enlace</Encabezado>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                </td>
              </tr>
            ) : pedidosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  {filtro === "activos" ? "No hay pedidos activos en este momento." : "No hay pedidos en esta categoría."}
                </td>
              </tr>
            ) : (
              pedidosFiltrados.map((p) => {
                const completado = ESTADOS_COMPLETADOS.includes(p.Estado);
                const fechaStr = (() => {
                  const d = new Date(p.Creacion_Pedido);
                  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short" })
                    + " " + d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
                })();
                return (
                  <tr key={p.Id_Pedido} className={`border-t border-border transition-colors ${completado ? "opacity-60" : "hover:bg-muted/30"}`}>
                    <Celda className="w-28">
                      <span className="font-mono text-xs text-muted-foreground">
                        AKA-{String(p.Id_Pedido).padStart(4, "0")}
                      </span>
                    </Celda>
                    <Celda className="min-w-[9rem]">
                      <div className="font-medium">{p.Nombre_Cliente} {p.Apellido_Cliente}</div>
                    </Celda>
                    <Celda className="w-[11rem]">
                      <div className="max-w-[11rem] truncate text-xs text-muted-foreground" title={p.Direccion_Destino ?? undefined}>
                        {p.Direccion_Destino}
                      </div>
                    </Celda>
                    <Celda className="w-[11rem]">
                      <ResumenProductos raw={p.Productos} />
                    </Celda>
                    <Celda className="w-36">
                      {completado ? (
                        <span className={`inline-block rounded-md px-2.5 py-1 text-xs font-semibold ${
                          p.Estado === "entregado"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {p.Estado === "entregado" ? "Entregado" : "Cancelado"}
                        </span>
                      ) : (
                        <SelectEstado
                          estado={p.Estado}
                          onChange={(s) => cambiarEstado(p.Id_Pedido, s, p.Estado)}
                        />
                      )}
                    </Celda>
                    <Celda className="w-52">
                      {completado ? (
                        <span className="text-xs text-muted-foreground">
                          {p.Nombre_Repartidor
                            ? `${p.Nombre_Repartidor} ${p.Apellido_Repartidor ?? ""}`.trim()
                            : "—"}
                        </span>
                      ) : (
                        <select
                          aria-label={`Asignar repartidor para pedido ${p.Id_Pedido}`}
                          value={p.Id_Repartidor ?? ""}
                          onChange={(e) => {
                            const rid = e.target.value ? Number(e.target.value) : null;
                            const rep = repsActivos.find((r) => r.Id_Usuario === rid);
                            const nombre = rep ? `${rep.Nombre_Usuario} ${rep.Apellido_Usuario?.split(" ")[0] ?? ""}`.trim() : undefined;
                            asignarRepartidor(p.Id_Pedido, rid, nombre);
                          }}
                          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                        >
                          <option value="">Sin asignar</option>
                          {repsActivos.map((r) => (
                            <option key={r.Id_Usuario} value={r.Id_Usuario}>
                              {r.Nombre_Usuario} {r.Apellido_Usuario?.split(" ")[0]}
                            </option>
                          ))}
                        </select>
                      )}
                    </Celda>
                    <Celda className="w-32 whitespace-nowrap text-xs text-muted-foreground">
                      {fechaStr}
                    </Celda>
                    <Celda>
                      <button
                        onClick={() => copiarSeguimiento(p.Id_Pedido)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {copiado === p.Id_Pedido
                          ? <><Check className="h-3.5 w-3.5 text-emerald-600" /> Copiado</>
                          : <><Copy className="h-3.5 w-3.5" /> Copiar</>}
                      </button>
                    </Celda>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-4 text-sm text-muted-foreground">
          <span aria-live="polite" aria-atomic="true">
            {totalItems} pedido{totalItems !== 1 ? "s" : ""} · página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium transition hover:bg-secondary disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              ← Anterior
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium transition hover:bg-secondary disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}

      {abierto && <DialogNuevoPedido onClose={() => { setAbierto(false); cargar(1); }} />}

      {confirm && (
        <ConfirmDialog
          mensaje={confirm.mensaje}
          detalle={confirm.detalle}
          onConfirmar={() => { confirm.accion(); setConfirm(null); }}
          onCancelar={() => setConfirm(null)}
        />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN: REPARTIDORES
// ═══════════════════════════════════════════════════════════════════════════════

function SeccionRepartidores() {
  const [repartidores, setRepartidores] = useState<import("@/lib/api").RepartidorApi[]>([]);
  const [cargando,     setCargando]     = useState(true);
  const [modalNuevo,   setModalNuevo]   = useState(false);
  const [editando,     setEditando]     = useState<import("@/lib/api").RepartidorApi | null>(null);

  const cargar = () => {
    setCargando(true);
    api.listarRepartidores()
      .then(setRepartidores)
      .catch(() => {})
      .finally(() => setCargando(false));
  };
  useEffect(() => { cargar(); }, []);

  const total   = repartidores.length;
  const activos = repartidores.filter((r) => r.Activo_Usuario).length;

  return (
    <>
      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Gestión de repartidores</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {activos} activo{activos !== 1 ? "s" : ""} · {total} registrado{total !== 1 ? "s" : ""} en total.
          </p>
        </div>
        <button
          onClick={() => setModalNuevo(true)}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground shadow-[var(--shadow-amber)] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="h-4 w-4" /> Nuevo repartidor
        </button>
      </div>

      {/* Tabla de repartidores */}
      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-secondary text-secondary-foreground">
            <tr className="text-left">
              <Encabezado className="min-w-[12rem]">Repartidor</Encabezado>
              <Encabezado className="w-24">DNI</Encabezado>
              <Encabezado className="min-w-[12rem]">Correo</Encabezado>
              <Encabezado className="w-32">Teléfono</Encabezado>
              <Encabezado className="w-16">Zona</Encabezado>
              <Encabezado className="w-24">Estado</Encabezado>
              <Encabezado className="w-48">Acciones</Encabezado>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></td></tr>
            ) : repartidores.map((r) => {
              const activo = r.Activo_Usuario;
              const nombre = `${r.Nombre_Usuario} ${r.Apellido_Usuario}`.trim();
              return (
                <tr key={r.Id_Usuario} className={`border-t border-border ${activo ? "" : "opacity-60"}`}>
                  <Celda>
                    <div className="flex items-center gap-3">
                      <Avatar nombre={nombre} activo={activo} />
                      <div>
                        <div className="font-medium leading-tight">{nombre}</div>
                        <div className="text-xs text-muted-foreground font-mono">ID #{r.Id_Usuario}</div>
                      </div>
                    </div>
                  </Celda>
                  <Celda className="w-24 whitespace-nowrap text-muted-foreground">{r.DNI_Usuario ?? "—"}</Celda>
                  <Celda className="min-w-[12rem]">
                    <div className="max-w-[16rem] truncate text-muted-foreground" title={r.Email_Usuario}>{r.Email_Usuario}</div>
                  </Celda>
                  <Celda className="w-32 whitespace-nowrap text-muted-foreground">{r.Telf_Usuario ?? "—"}</Celda>
                  <Celda><span className="text-muted-foreground">—</span></Celda>
                  <Celda><PastillaActivo activo={activo} /></Celda>
                  <Celda>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditando(r)}
                        aria-label={`Editar repartidor ${nombre}`}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Edit2 className="h-3.5 w-3.5" aria-hidden="true" /> Editar
                      </button>
                      <button
                        onClick={() => api.toggleRepartidor(r.Id_Usuario).then(cargar)}
                        aria-label={activo ? `Desactivar repartidor ${nombre}` : `Activar repartidor ${nombre}`}
                        className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          activo
                            ? "border border-destructive/40 text-destructive hover:bg-destructive/10"
                            : "border border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10"
                        }`}
                      >
                        {activo
                          ? <><UserX className="h-3.5 w-3.5" aria-hidden="true" /> Desactivar</>
                          : <><UserCheck className="h-3.5 w-3.5" aria-hidden="true" /> Activar</>}
                      </button>
                    </div>
                  </Celda>
                </tr>
              );
            })}
            {!cargando && repartidores.length === 0 && (
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
      {modalNuevo && <DialogNuevoRepartidor onClose={() => { setModalNuevo(false); cargar(); }} />}
      {editando   && <DialogEditarRepartidor repartidor={editando} onClose={() => { setEditando(null); cargar(); }} />}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL: NUEVO REPARTIDOR  (HU004 escenarios 1 y 2)
// ═══════════════════════════════════════════════════════════════════════════════

function DialogNuevoRepartidor({ onClose }: { onClose: () => void }) {
  const [nombre,   setNombre]   = useState("");
  const [apellido, setApellido] = useState("");
  const [dni,      setDni]      = useState("");
  const [correo,   setCorreo]   = useState("");
  const [telefono, setTelefono] = useState("");
  const [error,    setError]    = useState("");
  const [enviando, setEnviando] = useState(false);

  const [credenciales, setCredenciales] = useState<{ correo: string; password: string } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (nombre.trim().length < 2) { setError("Ingresa el nombre."); return; }
    if (!dni.trim())               { setError("El DNI es obligatorio."); return; }
    if (!correo.includes("@"))     { setError("Ingresa un correo válido."); return; }
    setEnviando(true);
    try {
      const res = await api.crearRepartidor({ nombre: nombre.trim(), apellido: apellido.trim(), email: correo.trim(), dni: dni.trim(), telefono: telefono.trim() });
      setCredenciales({ correo: correo.trim(), password: res.passwordAuto });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.includes("email_taken") ? "Ya existe una cuenta con ese correo." : "Error al registrar. Verifica los datos.");
    } finally {
      setEnviando(false);
    }
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
            <Campo label="Nombre(s)">
              <input required maxLength={80} value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className={clsInput} placeholder="Juan" />
            </Campo>
            <Campo label="Apellidos">
              <input maxLength={80} value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                className={clsInput} placeholder="Pérez García" />
            </Campo>
            <Campo label="DNI">
              <input required maxLength={8} value={dni}
                onChange={(e) => setDni(e.target.value)}
                className={clsInput} placeholder="12345678" />
            </Campo>
            <Campo label="Teléfono">
              <input type="tel" maxLength={9} value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className={clsInput} placeholder="987654321" />
            </Campo>
            <Campo label="Correo electrónico" completo>
              <input required type="email" maxLength={120} value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                className={clsInput} placeholder="juan@correo.com" />
            </Campo>
          </div>

          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className={clsBtnSecundario}>Cancelar</button>
            <button type="submit" disabled={enviando} className={`${clsBtnAccent} inline-flex items-center gap-2 disabled:opacity-60`}>
              {enviando ? <><Loader2 className="h-4 w-4 animate-spin" /> Registrando…</> : "Registrar repartidor"}
            </button>
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
              <span className="font-mono font-semibold text-accent">{credenciales.password}</span>
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

function DialogEditarRepartidor({ repartidor: r, onClose }: { repartidor: import("@/lib/api").RepartidorApi; onClose: () => void }) {
  const [nombre,   setNombre]   = useState(r.Nombre_Usuario);
  const [apellido, setApellido] = useState(r.Apellido_Usuario);
  const [dni,      setDni]      = useState(r.DNI_Usuario ?? "");
  const [correo,   setCorreo]   = useState(r.Email_Usuario);
  const [telefono, setTelefono] = useState(r.Telf_Usuario ?? "");
  const [guardado, setGuardado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [confirmarDesactivar, setConfirmarDesactivar] = useState(false);

  const activo = r.Activo_Usuario;

  async function handleGuardar(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    try {
      await api.editarRepartidor(r.Id_Usuario, {
        nombre: nombre.trim(), apellido: apellido.trim(),
        email: correo.trim(), dni: dni.trim(), telefono: telefono.trim(),
      });
      setGuardado(true);
      setTimeout(() => { setGuardado(false); onClose(); }, 1200);
    } catch {
      // sin feedback extra — onClose igual
    } finally {
      setGuardando(false);
    }
  }

  async function handleToggleActivo() {
    await api.toggleRepartidor(r.Id_Usuario).catch(() => {});
    onClose();
  }

  return (
    <Overlay onClose={onClose}>
      <div className="space-y-6">
        {/* Encabezado */}
        <div className="flex items-center gap-3">
          <Avatar nombre={`${r.Nombre_Usuario} ${r.Apellido_Usuario}`.trim()} activo={activo} size="lg" />
          <div>
            <h2 className="text-xl font-semibold">Editar repartidor</h2>
            <p className="text-sm text-muted-foreground font-mono">ID #{r.Id_Usuario}</p>
          </div>
        </div>

        {/* Formulario de edición */}
        <form onSubmit={handleGuardar} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Campo label="Nombre(s)">
              <input required maxLength={80} value={nombre}
                onChange={(e) => setNombre(e.target.value)} className={clsInput} />
            </Campo>
            <Campo label="Apellidos">
              <input maxLength={80} value={apellido}
                onChange={(e) => setApellido(e.target.value)} className={clsInput} />
            </Campo>
            <Campo label="DNI">
              <input maxLength={8} value={dni}
                onChange={(e) => setDni(e.target.value)} className={clsInput} placeholder="12345678" />
            </Campo>
            <Campo label="Teléfono">
              <input type="tel" maxLength={9} value={telefono}
                onChange={(e) => setTelefono(e.target.value)} className={clsInput} />
            </Campo>
            <Campo label="Correo electrónico" completo>
              <input type="email" maxLength={120} value={correo}
                onChange={(e) => setCorreo(e.target.value)} className={clsInput} />
            </Campo>
          </div>

          <div className="flex items-center justify-between gap-4 pt-1">
            {guardado && <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">✓ Cambios guardados</span>}
            <div className="ml-auto flex gap-3">
              <button type="button" onClick={onClose} className={clsBtnSecundario}>Cancelar</button>
              <button type="submit" disabled={guardando} className={`${clsBtnAccent} inline-flex items-center gap-2 disabled:opacity-60`}>
                {guardando ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</> : "Guardar cambios"}
              </button>
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
                    : "bg-emerald-600 text-white hover:opacity-90 dark:bg-emerald-500"
                }`}
              >
                {activo ? "Desactivar cuenta" : "Reactivar cuenta"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                ¿Confirmas que quieres {activo ? "desactivar" : "reactivar"} la cuenta de{" "}
                <span className="text-foreground">{r.Nombre_Usuario} {r.Apellido_Usuario}</span>?
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

function DialogNuevoPedido({ onClose }: { onClose: () => void }) {
  const [cliente,   setCliente]   = useState("");
  const [telefono,  setTelefono]  = useState("");
  const [alitas,    setAlitas]    = useState(12);
  const [salsa,     setSalsa]     = useState<Sauce>("Buffalo");
  const [notas,     setNotas]     = useState("");
  const [error,     setError]     = useState("");
  const [enviando,  setEnviando]  = useState(false);
  const [coords,    setCoords]    = useState<[number, number] | null>(null);
  const [direccion, setDireccion] = useState("");

  // Coordenadas del restaurante (origen fijo)
  const LAT_REST = -12.0278455;
  const LNG_REST = -77.0895871;

  function handleSeleccionMapa(c: [number, number], dir: string) {
    setCoords(c);
    setDireccion(dir);
    setError("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!cliente.trim() || alitas < 1) return;
    if (!coords) {
      setError("Fija el punto de entrega en el mapa.");
      return;
    }

    setEnviando(true);
    try {
      await api.crearPedido({
        latDestino:       coords[0],
        lngDestino:       coords[1],
        direccionDestino: direccion.slice(0, 200) || `${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}`,
        productos:        [{ nombre: `${alitas} alitas - ${salsa}`, cliente: cliente.trim(), telefono: telefono.trim(), notas: notas.trim() || undefined }],
        latOrigen:        LAT_REST,
        lngOrigen:        LNG_REST,
      });
      onClose();
    } catch {
      setError("Error al guardar el pedido. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
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

        {/* Selector de ubicación en mapa */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Punto de entrega</p>
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            <span className="text-accent">📍</span>
            {coords
              ? <span className="text-foreground">{direccion || `${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}`}</span>
              : <span>Toca el mapa o arrastra el pin para fijar el punto de entrega</span>
            }
          </div>
          <MapaSelectorUbicacion onSeleccion={handleSeleccionMapa} altura={280} />
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={enviando} className={clsBtnSecundario}>
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando}
            className={`${clsBtnAccent} inline-flex items-center gap-2 disabled:opacity-60`}
          >
            {enviando
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</>
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
function Overlay({ children, onClose, titulo }: { children: React.ReactNode; onClose: () => void; titulo?: string }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-8"
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

/** Diálogo de confirmación genérico */
function ConfirmDialog({
  mensaje, detalle, labelConfirmar = "Confirmar", destructivo = false, onConfirmar, onCancelar,
}: {
  mensaje: string;
  detalle?: string;
  labelConfirmar?: string;
  destructivo?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  return (
    <Overlay onClose={onCancelar} titulo="Confirmación">
      <div className="space-y-4">
        <p className="text-base font-semibold">{mensaje}</p>
        {detalle && <p className="text-sm text-muted-foreground">{detalle}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <button onClick={onCancelar} className={clsBtnSecundario}>Cancelar</button>
          <button
            onClick={onConfirmar}
            className={destructivo
              ? "rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              : clsBtnAccent}
          >
            {labelConfirmar}
          </button>
        </div>
      </div>
    </Overlay>
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
      activo ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"
    }`}>
      {initiales || "?"}
    </span>
  );
}

/** Pastilla estado activo/inactivo */
function PastillaActivo({ activo }: { activo: boolean }) {
  return (
    <span
      aria-label={activo ? "Estado: activo" : "Estado: inactivo"}
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${
        activo
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          : "bg-muted text-muted-foreground"
      }`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${activo ? "bg-emerald-500" : "bg-muted-foreground"}`} />
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
  asignado:    "bg-accent/15 text-accent border-accent/30",
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
      aria-label="Cambiar estado del pedido"
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


/** Botón de navegación entre secciones */
function NavBtn({
  activo, onClick, icon, label,
}: { activo: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-current={activo ? "page" : undefined}
      className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        activo
          ? "border-accent text-accent"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon} {label}
    </button>
  );
}

// ─── Helpers de tabla ─────────────────────────────────────────────────────────

function Encabezado({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide ${className}`}>{children}</th>;
}
function Celda({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}

function ResumenProductos({ raw }: { raw: string | null | undefined }) {
  if (!raw) return <span className="text-muted-foreground">—</span>;
  try {
    const lista = JSON.parse(raw);
    const p0 = Array.isArray(lista) ? lista[0] : lista;
    if (!p0) return <span className="text-muted-foreground">—</span>;

    // Formato cliente: { alitas, salsa, notas }
    if (p0.alitas) {
      const texto = `${p0.alitas} alitas${p0.salsa ? ` · ${p0.salsa}` : ""}`;
      return (
        <div className="space-y-0.5">
          <div className="text-xs font-medium">{texto}</div>
          {p0.notas && <div className="text-[10px] text-muted-foreground truncate max-w-[10rem]">{p0.notas}</div>}
        </div>
      );
    }
    // Formato admin: { nombre, cliente, notas }
    if (p0.nombre) {
      return (
        <div className="space-y-0.5">
          <div className="text-xs font-medium truncate max-w-[10rem]">{p0.nombre}</div>
          {p0.notas && <div className="text-[10px] text-muted-foreground truncate max-w-[10rem]">{p0.notas}</div>}
        </div>
      );
    }
    // Fallback legible
    const resumen = Object.entries(p0).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(" · ");
    return <div className="text-xs truncate max-w-[10rem]" title={resumen}>{resumen || "—"}</div>;
  } catch {
    return <span className="text-[10px] text-muted-foreground truncate max-w-[10rem]">{raw}</span>;
  }
}

// ─── Helpers de formulario ────────────────────────────────────────────────────

const clsInput =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring/30 transition focus:border-ring focus:ring-2";
const clsBtnAccent =
  "rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const clsBtnSecundario =
  "rounded-md border border-border px-4 py-2 text-sm font-medium transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
