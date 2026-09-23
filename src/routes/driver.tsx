import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CheckCircle2, ExternalLink, Loader2, LogOut, MapPin,
  Navigation, Route as RouteIcon, ShieldCheck, Zap,
} from "lucide-react";
import { LogoIcon } from "../components/Logo";
import { store, useStore } from "@/lib/store";
import { RESTAURANTE_COORDS, RESTAURANTE_DIRECCION, ESTADO_PEDIDO_ES } from "@/lib/constants";
import { ejecutarACO_TSP, type Stop, type TSPResult } from "@/lib/aco";
import { MapaRutaMulti, type MultiStop } from "@/components/MapaRuta";
import { api, type PedidoApi } from "@/lib/api";

export const Route = createFileRoute("/driver")({
  head: () => ({
    meta: [{ title: "Portal del repartidor — Ala K' Rico GO" }],
  }),
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const session = store.get().session;
    if (!session || (session.role !== "driver" && session.role !== "admin")) {
      throw redirect({ to: "/login" });
    }
  },
  component: PaginaRepartidor,
});

const STATUS_ES = ESTADO_PEDIDO_ES;

const STATUS_COLOR: Record<string, string> = {
  sin_asignar: "bg-muted text-muted-foreground",
  asignado:    "bg-accent/20 text-accent",
  en_camino:   "bg-primary/15 text-primary dark:text-primary",
  entregado:   "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

/** Colores para los marcadores del mapa según posición en la ruta */
const STOP_COLORS = [
  "#ea580c", "#d97706", "#92400e", "#b45309",
  "#dc2626", "#c2410c", "#78350f", "#9a3412",
];

// ─── Página principal ──────────────────────────────────────────────────────────

function PaginaRepartidor() {
  const navigate  = useNavigate();
  const session   = useStore((s) => s.session);
  const [montado, setMontado]   = useState(false);
  const [pedidos, setPedidos]   = useState<PedidoApi[]>([]);
  const [cargando, setCargando] = useState(true);
  const [tspResult, setTspResult] = useState<TSPResult | null>(null);
  const [tspRunning, setTspRunning] = useState(false);
  const [historialExpandido, setHistorialExpandido] = useState(false);

  useEffect(() => { setMontado(true); }, []);

  useEffect(() => {
    if (montado && (!session || (session.role !== "driver" && session.role !== "admin"))) {
      navigate({ to: "/login" });
    }
  }, [session, navigate, montado]);

  useEffect(() => {
    if (!montado || !session) return;
    setCargando(true);
    api.listarPedidos()
      .then((data) => {
        const arr = Array.isArray(data) ? data : ((data as any).items ?? []);
        setPedidos(arr);
      })
      .catch(() => setPedidos([]))
      .finally(() => setCargando(false));
  }, [montado, session]);

  if (!montado || !session) return null;

  const nombreRepartidor = session.nombre
    ? `${session.nombre} ${session.apellido ?? ""}`.trim()
    : "Repartidor";

  function cerrarSesion() {
    store.logout();
    navigate({ to: "/" });
  }

  // Activos: entran en la optimización de ruta
  const pedidosActivos = pedidos.filter(
    (p) => p.Estado !== "entregado" && p.Estado !== "cancelado",
  );
  // Historial: entregados y cancelados — sección separada
  const pedidosHistorial = pedidos.filter(
    (p) => p.Estado === "entregado" || p.Estado === "cancelado",
  ).sort((a, b) => b.Id_Pedido - a.Id_Pedido);

  function generarRutaOptima() {
    if (pedidosActivos.length === 0) return;
    setTspRunning(true);
    setTspResult(null);
    setTimeout(() => {
      try {
        const stops: Stop[] = [
          {
            id: "depot",
            lat: RESTAURANTE_COORDS[0],
            lng: RESTAURANTE_COORDS[1],
            label: "Ala K' Rico GO",
          },
          ...pedidosActivos.map((p) => ({
            id: String(p.Id_Pedido),
            lat:  p.Lat_Destino,
            lng:  p.Lng_Destino,
            label: `AKA-${String(p.Id_Pedido).padStart(4, "0")}`,
          })),
        ];
        setTspResult(ejecutarACO_TSP(stops));
      } catch {
        setTspResult(null);
      } finally {
        setTspRunning(false);
      }
    }, 60);
  }

  // Armar los stops para MapaRutaMulti a partir del TSP result
  const mapaStops: MultiStop[] = tspResult
    ? tspResult.orden.map((stop, idx) => ({
        coords: [stop.lat, stop.lng] as [number, number],
        label: idx === 0 ? "🏪" : String(idx),
        sublabel: stop.label,
        color: STOP_COLORS[idx % STOP_COLORS.length],
      }))
    : [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <LogoIcon size={32} />
            <span className="font-display text-base tracking-wide">GO</span>
            <span className="ml-2 rounded-sm bg-secondary px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-secondary-foreground">
              Repartidor
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{nombreRepartidor}</span>
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Admin</span>
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

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[1fr_420px]">

        {/* ── Columna izquierda: lista de pedidos ── */}
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">{nombreRepartidor}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {cargando
                  ? "Cargando pedidos…"
                  : `${pedidosActivos.length} pedido${pedidosActivos.length !== 1 ? "s" : ""} activo${pedidosActivos.length !== 1 ? "s" : ""} · ${pedidos.filter((p) => p.Estado === "entregado").length} entregado${pedidos.filter((p) => p.Estado === "entregado").length !== 1 ? "s" : ""}`}
              </p>
            </div>

            {/* Botón principal ACO */}
            <button
              onClick={generarRutaOptima}
              disabled={tspRunning || pedidosActivos.length === 0}
              className="inline-flex shrink-0 items-center gap-2 rounded-sm bg-accent px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-accent-foreground transition hover:brightness-110 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {tspRunning ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Calculando…</>
              ) : (
                <><Zap className="h-4 w-4" /> Generar ruta óptima</>
              )}
            </button>
          </div>

          {/* ── Pedidos activos para entregar ── */}
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              <span className="text-sm font-semibold">
                Pedidos activos
                {pedidosActivos.length > 0 && (
                  <span className="ml-2 rounded-full bg-accent/20 px-2 py-0.5 text-xs font-bold text-accent">
                    {pedidosActivos.length}
                  </span>
                )}
              </span>
            </div>
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-secondary text-secondary-foreground">
                <tr className="text-left">
                  <Th>Pedido</Th>
                  <Th>Cliente</Th>
                  <Th className="hidden sm:table-cell">Producto</Th>
                  <Th className="hidden md:table-cell">Dirección</Th>
                  <Th>Estado</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                    </td>
                  </tr>
                ) : pedidosActivos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      No tenés pedidos activos por el momento.
                    </td>
                  </tr>
                ) : (
                  [...pedidosActivos]
                    .sort((a, b) => a.Id_Pedido - b.Id_Pedido)
                    .map((o) => {
                      const posEnRuta = tspResult
                        ? tspResult.orden.findIndex((s) => s.id === String(o.Id_Pedido))
                        : -1;
                      const p0 = parsearProducto(o.Productos);
                      return (
                        <tr
                          key={o.Id_Pedido}
                          className={`border-t border-border transition-colors ${
                            posEnRuta > 0 ? "bg-accent/5" : "hover:bg-muted/40"
                          }`}
                        >
                          <Td>
                            <div className="flex items-center gap-2">
                              {posEnRuta > 0 && (
                                <span
                                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                                  style={{ background: STOP_COLORS[posEnRuta % STOP_COLORS.length] }}
                                >
                                  {posEnRuta}
                                </span>
                              )}
                              <span className="font-mono text-xs text-muted-foreground">
                                AKA-{String(o.Id_Pedido).padStart(4, "0")}
                              </span>
                            </div>
                          </Td>
                          <Td>
                            <div className="font-medium">
                              {o.Nombre_Cliente ?? ""} {o.Apellido_Cliente ?? ""}
                            </div>
                          </Td>
                          <Td className="hidden sm:table-cell">
                            {p0.alitas || p0.salsa ? (
                              <div className="space-y-0.5">
                                {p0.alitas && <div className="font-medium">{p0.alitas} alitas</div>}
                                {p0.salsa && <div className="text-xs text-muted-foreground">{p0.salsa}</div>}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </Td>
                          <Td className="hidden md:table-cell">
                            <div className="max-w-[180px] truncate text-xs text-muted-foreground">
                              {o.Direccion_Destino}
                            </div>
                          </Td>
                          <Td>
                            <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[o.Estado] ?? "bg-muted text-muted-foreground"}`}>
                              {STATUS_ES[o.Estado] ?? o.Estado}
                            </span>
                          </Td>
                          <Td>
                            <a
                              href={`/driver/${o.Id_Pedido}`}
                              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium transition hover:bg-secondary"
                            >
                              Ver <ExternalLink className="h-3 w-3" />
                            </a>
                          </Td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>

          {/* ── Historial de entregas ── */}
          {pedidosHistorial.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <button
                onClick={() => setHistorialExpandido((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-muted/40"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4" />
                  Historial de entregas
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold">
                    {pedidosHistorial.length}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {historialExpandido ? "Ocultar ▲" : "Ver ▼"}
                </span>
              </button>

              {historialExpandido && (
                <div className="overflow-x-auto border-t border-border">
                  <table className="w-full min-w-[400px] text-sm">
                    <thead className="bg-secondary/50 text-secondary-foreground">
                      <tr className="text-left">
                        <Th>Pedido</Th>
                        <Th>Cliente</Th>
                        <Th className="hidden sm:table-cell">Producto</Th>
                        <Th className="hidden md:table-cell">Fecha</Th>
                        <Th>Estado</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {pedidosHistorial.map((o) => {
                        const p0 = parsearProducto(o.Productos);
                        const fecha = o.Entrega_Pedido ?? o.Cancelacion_Pedido ?? o.Creacion_Pedido;
                        return (
                          <tr key={o.Id_Pedido} className="border-t border-border opacity-70">
                            <Td>
                              <span className="font-mono text-xs text-muted-foreground">
                                AKA-{String(o.Id_Pedido).padStart(4, "0")}
                              </span>
                            </Td>
                            <Td>
                              <div className="text-sm">
                                {o.Nombre_Cliente ?? ""} {o.Apellido_Cliente ?? ""}
                              </div>
                            </Td>
                            <Td className="hidden sm:table-cell">
                              {p0.alitas || p0.salsa ? (
                                <div className="text-xs">
                                  {p0.alitas && <span>{p0.alitas} alitas</span>}
                                  {p0.salsa && <span className="text-muted-foreground"> · {p0.salsa}</span>}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </Td>
                            <Td className="hidden md:table-cell">
                              <span className="text-xs text-muted-foreground">
                                {fecha ? new Date(fecha).toLocaleDateString("es-PE", {
                                  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                                }) : "—"}
                              </span>
                            </Td>
                            <Td>
                              <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[o.Estado] ?? "bg-muted text-muted-foreground"}`}>
                                {STATUS_ES[o.Estado] ?? o.Estado}
                              </span>
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Columna derecha: panel de ruta óptima ── */}
        <div className="sticky top-6 space-y-4">
          {!tspResult && !tspRunning && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card py-16 text-center">
              <Navigation className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">
                Presioná <strong>Generar ruta óptima</strong>
              </p>
              <p className="max-w-[200px] text-xs text-muted-foreground">
                El ACO calculará el orden óptimo para entregar todos los pedidos activos.
              </p>
            </div>
          )}

          {tspRunning && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card py-16">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
              <p className="text-sm text-muted-foreground">Optimizando con ACO…</p>
            </div>
          )}

          {tspResult && (
            <>
              {/* Estadísticas totales */}
              <div className="grid grid-cols-3 gap-2">
                <StatBox label="Paradas" value={String(tspResult.orden.length - 1)} />
                <StatBox label="Distancia" value={`${tspResult.distanciaKm} km`} />
                <StatBox label="ETA total" value={`${tspResult.etaMin} min`} />
              </div>

              {/* Secuencia de paradas */}
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="border-b border-border px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <RouteIcon className="h-4 w-4 text-accent" />
                    Ruta óptima — {tspResult.orden.length - 1} entrega{tspResult.orden.length - 1 !== 1 ? "s" : ""}
                  </div>
                </div>
                <ol className="divide-y divide-border">
                  {tspResult.orden.map((stop, idx) => {
                    const pedido = pedidos.find((p) => String(p.Id_Pedido) === stop.id);
                    const etaStr = idx === 0 ? "Salida" : `+${tspResult.etaAcumulado[idx]} min`;
                    const isDepot = idx === 0;

                    return (
                      <li key={stop.id} className="flex items-start gap-3 px-4 py-3">
                        {/* Número de parada */}
                        <span
                          className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                          style={{ background: STOP_COLORS[idx % STOP_COLORS.length] }}
                        >
                          {isDepot ? "🏪" : idx}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium">
                              {isDepot
                                ? "Ala K' Rico GO"
                                : `${pedido?.Nombre_Cliente ?? ""} ${pedido?.Apellido_Cliente ?? ""}`.trim() || stop.label}
                            </span>
                            <span className="shrink-0 text-xs font-semibold text-accent">{etaStr}</span>
                          </div>
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">
                            {isDepot ? RESTAURANTE_DIRECCION : pedido?.Direccion_Destino ?? ""}
                          </div>
                          {!isDepot && pedido && (
                            <div className="mt-1 flex items-center gap-2">
                              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLOR[pedido.Estado] ?? ""}`}>
                                {STATUS_ES[pedido.Estado] ?? pedido.Estado}
                              </span>
                              <a
                                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pedido.Direccion_Destino.slice(0, 200))}&travelmode=driving`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground focus-visible:underline focus-visible:outline-none"
                              >
                                <ExternalLink className="h-3 w-3" /> Navegar
                              </a>
                            </div>
                          )}
                          {isDepot && (
                            <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                              <CheckCircle2 className="h-3 w-3 text-green-500" /> Punto de partida
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>

              {/* Mapa multi-parada */}
              <div className="overflow-hidden rounded-xl border border-border">
                <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-3 text-sm font-medium">
                  <MapPin className="h-4 w-4 text-accent" />
                  Ruta en mapa
                </div>
                <MapaRutaMulti stops={mapaStops} altura={320} />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parsearProducto(raw: string | null | undefined): { alitas?: number; salsa?: string; notas?: string } {
  try {
    const lista = JSON.parse(raw ?? "[]");
    const p0 = Array.isArray(lista) ? (lista[0] ?? {}) : lista;
    if (!p0.alitas && !p0.salsa && p0.nombre) {
      const match = String(p0.nombre).match(/^(\d+)\s*alitas?\s*[-·]?\s*(.*)/i);
      return { alitas: match?.[1] ? Number(match[1]) : undefined, salsa: match?.[2]?.trim() || undefined, notas: p0.notas };
    }
    return p0;
  } catch { return {}; }
}

// ─── Componentes de tabla ─────────────────────────────────────────────────────

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide ${className ?? ""}`}>{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className ?? ""}`}>{children}</td>;
}
function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-bold text-accent">{value}</div>
    </div>
  );
}
