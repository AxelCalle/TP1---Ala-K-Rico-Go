import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Loader2,
  LogOut,
  MapPin,
  Navigation,
  Route as RouteIcon,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { LogoIcon } from "../components/Logo";
import { store, useStore } from "@/lib/store";
import { RESTAURANTE_COORDS, RESTAURANTE_DIRECCION, ESTADO_PEDIDO_ES } from "@/lib/constants";
import { ejecutarACO_TSP, type Stop, type TSPResult } from "@/lib/aco";
import { MapaRutaMulti, type MultiStop } from "@/components/MapaRuta";
import { api, type AcoConfigApi, type PedidoApi } from "@/lib/api";

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
  asignado: "bg-accent/20 text-accent",
  en_camino: "bg-primary/15 text-primary dark:text-primary",
  entregado: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

// ─── Página principal ──────────────────────────────────────────────────────────

function PaginaRepartidor() {
  const navigate = useNavigate();
  const session = useStore((s) => s.session);
  const [montado, setMontado] = useState(false);
  const [pedidos, setPedidos] = useState<PedidoApi[]>([]);
  const [cargando, setCargando] = useState(true);
  const [tspResult, setTspResult] = useState<TSPResult | null>(null);
  const [tspRunning, setTspRunning] = useState(false);
  const [historialExpandido, setHistorialExpandido] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

  useEffect(() => {
    if (montado && (!session || (session.role !== "driver" && session.role !== "admin"))) {
      navigate({ to: "/login" });
    }
  }, [session, navigate, montado]);

  useEffect(() => {
    if (!montado || !session) return;
    setCargando(true);
    api
      .listarPedidos()
      .then((data) => {
        const arr = Array.isArray(data) ? data : ((data as any).items ?? []);
        setPedidos(arr);
      })
      .catch(() => setPedidos([]))
      .finally(() => setCargando(false));
  }, [montado, session]);

  // Ubicación GPS real → backend (el admin ve dónde está el repartidor).
  // Como máximo cada 15 s, o cada 5 s si avanzó 50 m o más.
  const ultimoEnvioRef = useRef<{ t: number; lat: number; lng: number } | null>(null);
  const enviarUbicacion = useCallback((lat: number, lng: number) => {
    const id = Number(store.get().session?.driverId);
    if (!id) return; // un admin viendo la ruta no tiene ubicación propia
    const ahora = Date.now();
    const prev = ultimoEnvioRef.current;
    if (prev) {
      const t = ahora - prev.t;
      const movido = metrosEntre(prev.lat, prev.lng, lat, lng);
      if (t < 5000 || (t < 15000 && movido < 50)) return;
    }
    ultimoEnvioRef.current = { t: ahora, lat, lng };
    api.actualizarUbicacion(id, lat, lng).catch(() => {
      /* sin conexión: se reintenta con la próxima posición */
      ultimoEnvioRef.current = prev;
    });
  }, []);

  // Stops para MapaRutaMulti memorizados: si cambiaran en cada render el mapa se reiniciaría
  const mapaStops: MultiStop[] = useMemo(
    () =>
      tspResult
        ? tspResult.orden.map((stop, idx) => {
            const pedido = pedidos.find((p) => String(p.Id_Pedido) === stop.id);
            const nombre = pedido
              ? `${pedido.Nombre_Cliente ?? ""} ${pedido.Apellido_Cliente ?? ""}`.trim()
              : "";
            return {
              coords: [stop.lat, stop.lng] as [number, number],
              label: idx === 0 ? "🏪" : String(idx),
              sublabel: idx === 0 ? "Ala K' Rico GO" : nombre || stop.label,
              direccion: idx === 0 ? RESTAURANTE_DIRECCION : pedido?.Direccion_Destino,
              estadoPedido: pedido ? (STATUS_ES[pedido.Estado] ?? pedido.Estado) : undefined,
              eta: idx === 0 ? "Salida" : `+${tspResult.etaAcumulado[idx]} min`,
              href: idx === 0 ? undefined : `/driver/${stop.id}`,
              pedidoId: idx === 0 ? undefined : Number(stop.id),
            };
          })
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo se recalcula con una nueva ruta
    [tspResult],
  );

  // Confirmación de entrega desde la ruta: marca el pedido y lo saca de la lista de activos
  const entregarDesdeRuta = useCallback(
    async (indiceParada: number) => {
      const id = mapaStops[indiceParada]?.pedidoId;
      if (!id) return;
      await api.cambiarEstadoPedido(id, "entregado");
      setPedidos((prev) =>
        prev.map((p) =>
          p.Id_Pedido === id
            ? { ...p, Estado: "entregado", Entrega_Pedido: new Date().toISOString() }
            : p,
        ),
      );
    },
    [mapaStops],
  );

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
  const pedidosHistorial = pedidos
    .filter((p) => p.Estado === "entregado" || p.Estado === "cancelado")
    .sort((a, b) => b.Id_Pedido - a.Id_Pedido);
  const totalEntregados = pedidos.filter((p) => p.Estado === "entregado").length;

  async function generarRutaOptima() {
    if (pedidosActivos.length === 0) return;
    setTspRunning(true);
    setTspResult(null);
    // Parámetros guardados por el administrador (HU025); si falla, se usan los del piloto
    let config: Partial<AcoConfigApi> = {};
    try {
      config = await api.obtenerAcoConfig();
    } catch {
      /* valores por defecto */
    }
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
            lat: p.Lat_Destino,
            lng: p.Lng_Destino,
            label: `AKA-${String(p.Id_Pedido).padStart(4, "0")}`,
          })),
        ];
        setTspResult(ejecutarACO_TSP(stops, config));
      } catch {
        setTspResult(null);
      } finally {
        setTspRunning(false);
      }
    }, 60);
  }

  const activosOrdenados = [...pedidosActivos].sort((a, b) => a.Id_Pedido - b.Id_Pedido);
  const posicionEnRuta = (id: number) =>
    tspResult ? tspResult.orden.findIndex((s) => s.id === String(id)) : -1;

  return (
    <div className="min-h-dvh bg-background">
      {/* Header */}
      <header className="safe-top sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-3">
          <Link
            to="/"
            className="flex min-w-0 items-center gap-2"
            aria-label="Ala K' Rico GO — inicio"
          >
            <LogoIcon size={32} />
            <span className="font-display text-base tracking-wide">GO</span>
            <span className="rounded-sm bg-secondary px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-secondary-foreground">
              Repartidor
            </span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-3">
            <span className="hidden max-w-[16rem] truncate text-sm text-muted-foreground md:inline">
              {nombreRepartidor}
            </span>
            <Link
              to="/admin"
              aria-label="Panel de administración"
              className="inline-flex h-11 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
            <button
              onClick={cerrarSesion}
              aria-label="Cerrar sesión"
              className="inline-flex h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:space-y-6 sm:px-6 sm:py-8">
        {/* ── Encabezado + acción principal ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-semibold sm:text-3xl">{nombreRepartidor}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {cargando
                ? "Cargando pedidos…"
                : `${pedidosActivos.length} pedido${pedidosActivos.length !== 1 ? "s" : ""} activo${pedidosActivos.length !== 1 ? "s" : ""} · ${totalEntregados} entregado${totalEntregados !== 1 ? "s" : ""}`}
            </p>
          </div>

          {/* Botón principal ACO */}
          <button
            onClick={generarRutaOptima}
            disabled={tspRunning || pedidosActivos.length === 0}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-accent px-5 text-sm font-bold uppercase tracking-wide text-accent-foreground shadow-(--shadow-flame) transition hover:brightness-110 disabled:opacity-50 disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto sm:shrink-0"
          >
            {tspRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Calculando…
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" aria-hidden="true" />
                {tspResult ? "Recalcular ruta óptima" : "Generar ruta óptima"}
              </>
            )}
          </button>
        </div>

        {/* ── Ruta óptima: mapa predominante + panel de navegación ── */}
        <section aria-labelledby="titulo-ruta" className="space-y-3">
          {tspResult ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2
                  id="titulo-ruta"
                  className="flex items-center gap-2 font-sans text-base font-semibold tracking-normal"
                >
                  <RouteIcon className="h-4 w-4 text-accent" aria-hidden="true" />
                  Ruta óptima — {tspResult.orden.length - 1} entrega
                  {tspResult.orden.length - 1 !== 1 ? "s" : ""}
                </h2>
                <div className="grid w-full grid-cols-3 gap-2 sm:w-auto">
                  <StatBox label="Paradas" value={String(tspResult.orden.length - 1)} />
                  <StatBox label="Distancia" value={`${tspResult.distanciaKm} km`} />
                  <StatBox label="ETA total" value={`${tspResult.etaMin} min`} />
                </div>
              </div>
              <MapaRutaMulti
                stops={mapaStops}
                altura="clamp(440px, 74svh, 780px)"
                onUbicacion={enviarUbicacion}
                onEntregar={entregarDesdeRuta}
              />
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <MapPin className="mt-px h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                Toca un pin o una parada para ver el pedido. «Navegar con GPS» usa la ubicación de
                tu celular; «Simular» recorre la ruta automáticamente (demostración).
              </p>
            </>
          ) : tspRunning ? (
            <div
              role="status"
              className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card py-14"
            >
              <Loader2 className="h-8 w-8 animate-spin text-accent" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">Optimizando con ACO…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
              <h2 id="titulo-ruta" className="sr-only">
                Ruta óptima
              </h2>
              <Navigation className="h-10 w-10 text-muted-foreground/30" aria-hidden="true" />
              <p className="text-sm font-medium text-muted-foreground">
                Presioná <strong>Generar ruta óptima</strong>
              </p>
              <p className="max-w-xs text-xs text-muted-foreground">
                El ACO calculará el orden óptimo para entregar todos los pedidos activos y lo
                mostrará en el mapa.
              </p>
            </div>
          )}
        </section>

        {/* ── Pedidos activos para entregar ── */}
        <section
          aria-labelledby="titulo-activos"
          className="overflow-hidden rounded-xl border border-border bg-card"
        >
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            <h2 id="titulo-activos" className="font-sans text-sm font-semibold tracking-normal">
              Pedidos activos
              {pedidosActivos.length > 0 && (
                <span className="ml-2 rounded-full bg-accent/20 px-2 py-0.5 text-xs font-bold text-accent">
                  {pedidosActivos.length}
                </span>
              )}
            </h2>
          </div>

          {cargando ? (
            <div role="status" className="px-4 py-10 text-center">
              <Loader2
                className="mx-auto h-5 w-5 animate-spin text-muted-foreground"
                aria-hidden="true"
              />
              <span className="sr-only">Cargando pedidos</span>
            </div>
          ) : pedidosActivos.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              No tenés pedidos activos por el momento.
            </p>
          ) : (
            <>
              {/* Móvil / tablet: cards */}
              <ul className="divide-y divide-border md:hidden">
                {activosOrdenados.map((o) => {
                  const posEnRuta = posicionEnRuta(o.Id_Pedido);
                  const p0 = parsearProducto(o.Productos);
                  return (
                    <li key={o.Id_Pedido} className={`p-4 ${posEnRuta > 0 ? "bg-accent/5" : ""}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          {posEnRuta > 0 && <BadgeParada n={posEnRuta} />}
                          <span className="font-mono text-xs text-muted-foreground">
                            AKA-{String(o.Id_Pedido).padStart(4, "0")}
                          </span>
                        </div>
                        <EstadoPedido estado={o.Estado} />
                      </div>
                      <p className="mt-2 break-words font-medium">
                        {o.Nombre_Cliente ?? ""} {o.Apellido_Cliente ?? ""}
                      </p>
                      <p className="mt-0.5 flex items-start gap-1.5 text-sm text-muted-foreground">
                        <MapPin
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent"
                          aria-hidden="true"
                        />
                        <span className="min-w-0 break-words">{o.Direccion_Destino}</span>
                      </p>
                      {(p0.alitas || p0.salsa) && (
                        <p className="mt-1 text-sm">
                          {p0.alitas && <span className="font-medium">{p0.alitas} alitas</span>}
                          {p0.salsa && <span className="text-muted-foreground"> · {p0.salsa}</span>}
                        </p>
                      )}
                      <a
                        href={`/driver/${o.Id_Pedido}`}
                        className="mt-3 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-border text-sm font-semibold transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Ver detalle <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    </li>
                  );
                })}
              </ul>

              {/* Desktop: tabla */}
              <table className="hidden w-full text-sm md:table">
                <thead className="bg-secondary text-secondary-foreground">
                  <tr className="text-left">
                    <Th>Pedido</Th>
                    <Th>Cliente</Th>
                    <Th>Producto</Th>
                    <Th>Dirección</Th>
                    <Th>Estado</Th>
                    <Th>
                      <span className="sr-only">Acciones</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {activosOrdenados.map((o) => {
                    const posEnRuta = posicionEnRuta(o.Id_Pedido);
                    const p0 = parsearProducto(o.Productos);
                    const woId = `AKA-${String(o.Id_Pedido).padStart(4, "0")}`;
                    return (
                      <tr
                        key={o.Id_Pedido}
                        className={`border-t border-border transition-colors ${
                          posEnRuta > 0 ? "bg-accent/5" : "hover:bg-muted/40"
                        }`}
                      >
                        <Td>
                          <div className="flex items-center gap-2">
                            {posEnRuta > 0 && <BadgeParada n={posEnRuta} />}
                            <span className="font-mono text-xs text-muted-foreground">{woId}</span>
                          </div>
                        </Td>
                        <Td>
                          <div className="font-medium">
                            {o.Nombre_Cliente ?? ""} {o.Apellido_Cliente ?? ""}
                          </div>
                        </Td>
                        <Td>
                          {p0.alitas || p0.salsa ? (
                            <div className="space-y-0.5">
                              {p0.alitas && <div className="font-medium">{p0.alitas} alitas</div>}
                              {p0.salsa && (
                                <div className="text-xs text-muted-foreground">{p0.salsa}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </Td>
                        <Td>
                          <div className="max-w-[16rem] text-xs text-muted-foreground lg:max-w-xs">
                            {o.Direccion_Destino}
                          </div>
                        </Td>
                        <Td>
                          <EstadoPedido estado={o.Estado} />
                        </Td>
                        <Td>
                          <a
                            href={`/driver/${o.Id_Pedido}`}
                            aria-label={`Ver pedido ${woId}`}
                            className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-3 text-xs font-medium transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            Ver <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          </a>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </section>

        {/* ── Historial de entregas ── */}
        {pedidosHistorial.length > 0 && (
          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <button
              onClick={() => setHistorialExpandido((v) => !v)}
              aria-expanded={historialExpandido}
              aria-controls="historial-entregas"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Historial de entregas
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold">
                  {pedidosHistorial.length}
                </span>
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${historialExpandido ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>

            {historialExpandido && (
              <div id="historial-entregas" className="border-t border-border">
                {/* Móvil: lista compacta */}
                <ul className="divide-y divide-border sm:hidden">
                  {pedidosHistorial.map((o) => {
                    const p0 = parsearProducto(o.Productos);
                    const fecha = o.Entrega_Pedido ?? o.Cancelacion_Pedido ?? o.Creacion_Pedido;
                    return (
                      <li key={o.Id_Pedido} className="px-4 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs text-muted-foreground">
                            AKA-{String(o.Id_Pedido).padStart(4, "0")}
                          </span>
                          <EstadoPedido estado={o.Estado} />
                        </div>
                        <p className="mt-1 break-words text-sm font-medium">
                          {o.Nombre_Cliente ?? ""} {o.Apellido_Cliente ?? ""}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {[
                            p0.alitas ? `${p0.alitas} alitas` : null,
                            p0.salsa,
                            fecha ? formatearFecha(fecha) : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </p>
                      </li>
                    );
                  })}
                </ul>

                {/* sm+: tabla */}
                <table className="hidden w-full text-sm sm:table">
                  <thead className="bg-secondary/50 text-secondary-foreground">
                    <tr className="text-left">
                      <Th>Pedido</Th>
                      <Th>Cliente</Th>
                      <Th>Producto</Th>
                      <Th>Fecha</Th>
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
                          <Td>
                            {p0.alitas || p0.salsa ? (
                              <div className="text-xs">
                                {p0.alitas && <span>{p0.alitas} alitas</span>}
                                {p0.salsa && (
                                  <span className="text-muted-foreground"> · {p0.salsa}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </Td>
                          <Td>
                            <span className="whitespace-nowrap text-xs text-muted-foreground">
                              {fecha ? formatearFecha(fecha) : "—"}
                            </span>
                          </Td>
                          <Td>
                            <EstadoPedido estado={o.Estado} />
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Distancia aproximada en metros (suficiente para decidir si enviar la ubicación). */
function metrosEntre(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const kLng = 111320 * Math.cos((lat1 * Math.PI) / 180);
  return Math.hypot((lat2 - lat1) * 111320, (lng2 - lng1) * kLng);
}

function formatearFecha(fecha: string): string {
  return new Date(fecha).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function EstadoPedido({ estado }: { estado: string }) {
  return (
    <span
      className={`inline-block shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[estado] ?? "bg-muted text-muted-foreground"}`}
    >
      {STATUS_ES[estado] ?? estado}
    </span>
  );
}

/** Número de parada en la ruta óptima (mismo color que el pin "pendiente" del mapa) */
function BadgeParada({ n }: { n: number }) {
  return (
    <span
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-700 text-[11px] font-bold text-white"
      aria-label={`Parada ${n} de la ruta`}
    >
      {n}
    </span>
  );
}

function parsearProducto(raw: string | null | undefined): {
  alitas?: number;
  salsa?: string;
  notas?: string;
} {
  try {
    const lista = JSON.parse(raw ?? "[]");
    const p0 = Array.isArray(lista) ? (lista[0] ?? {}) : lista;
    if (!p0.alitas && !p0.salsa && p0.nombre) {
      const match = String(p0.nombre).match(/^(\d+)\s*alitas?\s*[-·]?\s*(.*)/i);
      return {
        alitas: match?.[1] ? Number(match[1]) : undefined,
        salsa: match?.[2]?.trim() || undefined,
        notas: p0.notas,
      };
    }
    return p0;
  } catch {
    return {};
  }
}

// ─── Componentes de tabla ─────────────────────────────────────────────────────

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide ${className ?? ""}`}>
      {children}
    </th>
  );
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
