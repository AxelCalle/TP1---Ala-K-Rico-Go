import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Drumstick,
  ExternalLink,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  Route as RouteIcon,
  Truck,
  X,
} from "lucide-react";
import { store } from "@/lib/store";
import { RESTAURANTE_COORDS, RESTAURANTE_DIRECCION } from "@/lib/constants";
import { construirGrafo, ejecutarACO, type AcoGraph, type AcoResult } from "@/lib/aco";
import { MapaRuta } from "@/components/MapaRuta";
import { api } from "@/lib/api";

export const Route = createFileRoute("/driver_/$orderId")({
  beforeLoad: () => {
    const session = store.get().session;
    if (!session || !["driver", "admin"].includes(session.role)) {
      throw redirect({ to: "/login" });
    }
  },
  head: ({ params }) => ({
    meta: [{ title: `Ruta ${params.orderId} — Ala K' Rico GO` }],
  }),
  component: PaginaRuta,
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center bg-background p-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Pedido no encontrado</h1>
        <Link to="/driver" className="mt-4 inline-block text-foreground underline">
          Volver al portal del repartidor
        </Link>
      </div>
    </div>
  ),
});

const PICKUP = {
  label: "Cocina Ala K' Rico GO",
  address: RESTAURANTE_DIRECCION,
  coords: RESTAURANTE_COORDS,
};

function dibujarGrafo(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  graph: AcoGraph,
  result: AcoResult | null,
) {
  const PAD = 28;
  ctx.clearRect(0, 0, W, H);
  const toX = (x: number) => PAD + x * (W - PAD * 2);
  const toY = (y: number) => PAD + y * (H - PAD * 2);

  let maxPh = 0;
  if (result)
    result.pheromones.forEach((v) => {
      if (v > maxPh) maxPh = v;
    });

  const bestEdges = new Set<string>();
  if (result) {
    for (let i = 0; i < result.path.length - 1; i++) {
      const a = result.path[i],
        b = result.path[i + 1];
      bestEdges.add(a < b ? `${a}-${b}` : `${b}-${a}`);
    }
  }

  for (const e of graph.edges) {
    const key = e.from < e.to ? `${e.from}-${e.to}` : `${e.to}-${e.from}`;
    if (bestEdges.has(key)) continue;
    const ph = result ? (result.pheromones.get(key) ?? 0) / maxPh : 0;
    ctx.beginPath();
    ctx.moveTo(toX(graph.nodes[e.from].x), toY(graph.nodes[e.from].y));
    ctx.lineTo(toX(graph.nodes[e.to].x), toY(graph.nodes[e.to].y));
    ctx.strokeStyle = result ? `rgba(212,83,15,${0.08 + ph * 0.35})` : "rgba(148,163,184,0.25)";
    ctx.lineWidth = result ? 1 + ph * 2.5 : 1;
    ctx.stroke();
  }

  if (result && result.path.length > 1) {
    ctx.beginPath();
    const first = graph.nodes[result.path[0]];
    ctx.moveTo(toX(first.x), toY(first.y));
    for (let i = 1; i < result.path.length; i++) {
      const n = graph.nodes[result.path[i]];
      ctx.lineTo(toX(n.x), toY(n.y));
    }
    ctx.strokeStyle = "#d4530f";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  for (const n of graph.nodes) {
    const cx = toX(n.x),
      cy = toY(n.y);
    const isEndpoint = n.id === 0 || n.id === 1;
    const onPath = result?.path.includes(n.id);
    ctx.beginPath();
    ctx.arc(cx, cy, isEndpoint ? 9 : onPath ? 6 : 4, 0, Math.PI * 2);
    if (n.id === 0) ctx.fillStyle = "#1c120c";
    else if (n.id === 1) ctx.fillStyle = "#d4530f";
    else if (onPath) ctx.fillStyle = "rgba(212,83,15,0.7)";
    else ctx.fillStyle = "rgba(107,91,78,0.4)";
    ctx.fill();
    if (n.label) {
      ctx.fillStyle = "#fdf8f2";
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(n.label, cx, cy);
    }
  }
}

function PaginaRuta() {
  const { orderId } = Route.useParams();
  const qc = useQueryClient();

  const {
    data: pedido,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["pedido", orderId],
    queryFn: () => api.obtenerPedido(Number(orderId)),
    refetchInterval: 15000,
    retry: 1,
  });

  const [resultadoACO, setResultadoACO] = useState<AcoResult | null>(null);
  const [calculandoACO, setCalculandoACO] = useState(false);
  const [grafoACO] = useState<AcoGraph>(() => construirGrafo(orderId));
  const [mostrarIncidencia, setMostrarIncidencia] = useState(false);
  const [incidenciaTipo, setIncidenciaTipo] = useState("Dirección no encontrada");
  const [incidenciaDetalle, setIncidenciaDetalle] = useState("");
  const [incidenciaEnviada, setIncidenciaEnviada] = useState(false);
  const [enviandoIncidencia, setEnviandoIncidencia] = useState(false);
  const [cambioEstadoLoading, setCambioEstadoLoading] = useState(false);
  const [errorEstado, setErrorEstado] = useState<string | null>(null);
  const [errorIncidencia, setErrorIncidencia] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const redibujar = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio ?? 1;
    const cssW = canvas.clientWidth || 400;
    const cssH = canvas.clientHeight || 220;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    dibujarGrafo(ctx, cssW, cssH, grafoACO, resultadoACO);
  }, [grafoACO, resultadoACO]);

  useEffect(() => {
    redibujar();
  }, [redibujar]);

  // Redibujar el grafo si cambia el ancho (rotación del móvil, resize de ventana)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => redibujar());
    ro.observe(canvas);
    return () => ro.disconnect();
    // isLoading: el canvas recién existe cuando termina de cargar el pedido
  }, [redibujar, isLoading]);

  const ejecutarOptimizacion = useCallback(() => {
    setCalculandoACO(true);
    setTimeout(() => {
      try {
        setResultadoACO(ejecutarACO(grafoACO));
      } catch {
        setResultadoACO(null);
      } finally {
        setCalculandoACO(false);
      }
    }, 60);
  }, [grafoACO]);

  async function cambiarEstado(nuevoEstado: string) {
    if (!pedido) return;
    setErrorEstado(null);
    setCambioEstadoLoading(true);
    try {
      await api.cambiarEstadoPedido(pedido.Id_Pedido, nuevoEstado);
      qc.invalidateQueries({ queryKey: ["pedido", orderId] });
      qc.invalidateQueries({ queryKey: ["mis-pedidos"] });
    } catch {
      setErrorEstado("No se pudo actualizar el estado. Inténtalo nuevamente.");
    } finally {
      setCambioEstadoLoading(false);
    }
  }

  async function enviarIncidencia() {
    if (!pedido) return;
    setErrorIncidencia(null);
    setEnviandoIncidencia(true);
    try {
      await api.reportarIncidencia(
        pedido.Id_Pedido,
        incidenciaTipo,
        incidenciaDetalle || undefined,
      );
      setIncidenciaEnviada(true);
      setMostrarIncidencia(false);
    } catch {
      setErrorIncidencia("No se pudo enviar el reporte. Inténtalo nuevamente.");
    } finally {
      setEnviandoIncidencia(false);
    }
  }

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (isError || !pedido) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Pedido no encontrado</h1>
          <Link to="/driver" className="mt-4 inline-block text-foreground underline">
            Volver al portal del repartidor
          </Link>
        </div>
      </div>
    );
  }

  const p0 = (() => {
    try {
      const lista = JSON.parse(pedido.Productos ?? "[]");
      const raw = Array.isArray(lista) ? (lista[0] ?? {}) : lista;
      // Normaliza formato admin { nombre: "6 alitas - BBQ" } al mismo shape que el formato cliente
      if (!raw.alitas && !raw.salsa && raw.nombre) {
        const match = String(raw.nombre).match(/^(\d+)\s*alitas?\s*[-·]?\s*(.*)/i);
        return {
          alitas: match?.[1] ? Number(match[1]) : undefined,
          salsa: match?.[2]?.trim() || undefined,
          notas: raw.notas,
        };
      }
      return raw;
    } catch {
      return {};
    }
  })();
  const estado = pedido.Estado;
  const nombreCliente =
    `${pedido.Nombre_Cliente ?? ""} ${pedido.Apellido_Cliente ?? ""}`.trim() || "Cliente";
  const telefonoCliente = pedido.Telf_Cliente ?? "";
  const woId = `AKA-${String(pedido.Id_Pedido).padStart(4, "0")}`;
  const coordsDestino: [number, number] = [pedido.Lat_Destino, pedido.Lng_Destino];

  const urlNavegacion = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    PICKUP.address,
  )}&destination=${encodeURIComponent(pedido.Direccion_Destino)}&travelmode=driving`;

  const distanceKm = resultadoACO
    ? resultadoACO.distanceKm.toFixed(1)
    : (2 + (pedido.Id_Pedido % 5)).toFixed(1);

  const etaMin = resultadoACO ? resultadoACO.etaMin : 5 + (pedido.Id_Pedido % 8);

  const entregado = estado === "entregado";

  /** Botones de cambio de estado: barra fija inferior en móvil, columna lateral en desktop */
  const botonesEstado = (
    <div className={`grid gap-2 ${estado === "en_camino" ? "grid-cols-1" : "grid-cols-2"}`}>
      {estado !== "en_camino" && (
        <button
          onClick={() => cambiarEstado("en_camino")}
          disabled={cambioEstadoLoading}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-semibold transition hover:bg-secondary disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {cambioEstadoLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Truck className="h-4 w-4" aria-hidden="true" />
          )}
          Iniciar entrega
        </button>
      )}
      <button
        onClick={() => cambiarEstado("entregado")}
        disabled={cambioEstadoLoading}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-accent px-3 text-sm font-semibold text-accent-foreground transition hover:brightness-105 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {cambioEstadoLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        )}
        Marcar entregado
      </button>
    </div>
  );

  return (
    <div className={`min-h-dvh bg-background ${entregado ? "" : "pb-28 lg:pb-0"}`}>
      <header className="safe-top sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-2 py-2 sm:px-6">
          <Link
            to="/driver"
            className="inline-flex h-11 items-center gap-2 rounded-md px-2 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            <span className="hidden sm:inline">Volver a pedidos</span>
            <span className="sm:hidden">Pedidos</span>
          </Link>
          <p className="min-w-0 truncate font-mono text-sm font-semibold">{woId}</p>
          <Link
            to="/"
            className="flex h-11 items-center gap-2 rounded-md px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Ala K' Rico GO — inicio"
          >
            <span className="grid h-8 w-8 place-items-center rounded-md bg-accent text-accent-foreground">
              <Drumstick className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="hidden text-sm font-semibold tracking-tight sm:inline">
              Ala K' Rico GO
            </span>
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-4 px-0 py-0 sm:gap-6 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Mapa */}
        <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
          <section className="overflow-hidden border-b border-border bg-card sm:rounded-xl sm:border sm:shadow-(--shadow-elegant)">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5 sm:px-5">
              <h2 className="flex items-center gap-2 font-sans text-sm font-medium tracking-normal">
                <Navigation className="h-4 w-4 text-accent" aria-hidden="true" />
                Mejor ruta al destino
              </h2>
              <a
                href={urlNavegacion}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Abrir en Google Maps
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
            <MapaRuta
              origen={PICKUP.address}
              coordsOrigen={PICKUP.coords}
              destino={pedido.Direccion_Destino}
              coordsDestino={coordsDestino}
              altura="clamp(320px, 55svh, 560px)"
            />
          </section>

          {/* ACO */}
          <section className="mx-4 overflow-hidden rounded-xl border border-border bg-card shadow-(--shadow-elegant) sm:mx-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-5">
              <h2 className="flex items-center gap-2 font-sans text-sm font-medium tracking-normal">
                <RouteIcon className="h-4 w-4 text-accent" aria-hidden="true" />
                Optimización de ruta (ACO)
              </h2>
              {resultadoACO && (
                <span className="rounded-md bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
                  {resultadoACO.path.length - 1} segmentos · {resultadoACO.distanceKm.toFixed(1)} km
                </span>
              )}
            </div>
            <div className="p-4">
              <canvas
                ref={canvasRef}
                className="w-full rounded-lg bg-muted"
                style={{ height: 220 }}
                role="img"
                aria-label={
                  resultadoACO
                    ? `Grafo de colonia de hormigas con la ruta óptima de ${resultadoACO.distanceKm.toFixed(1)} km`
                    : "Grafo de colonia de hormigas sin calcular"
                }
              />
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  {resultadoACO
                    ? `Ruta óptima en ${resultadoACO.iterations} iteraciones · ${resultadoACO.path.length} nodos.`
                    : "Presiona el botón para calcular la ruta óptima con colonias de hormigas."}
                </p>
                <button
                  onClick={ejecutarOptimizacion}
                  disabled={calculandoACO}
                  className="inline-flex h-11 w-full flex-none items-center justify-center gap-1.5 rounded-md bg-accent px-4 text-sm font-semibold text-accent-foreground transition hover:brightness-105 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
                >
                  {calculandoACO ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Calculando…
                    </>
                  ) : (
                    <>
                      <RouteIcon className="h-3.5 w-3.5" />{" "}
                      {resultadoACO ? "Recalcular" : "Generar ruta"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="mx-4 space-y-4 pb-6 sm:mx-0 sm:pb-0">
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">{woId}</span>
              {p0.salsa && (
                <span className="rounded-md bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
                  {p0.salsa}
                </span>
              )}
            </div>
            <h1 className="mt-2 break-words text-2xl font-semibold">{nombreCliente}</h1>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-start gap-2 text-foreground">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                <span className="min-w-0 break-words">{pedido.Direccion_Destino}</span>
              </div>
              {telefonoCliente ? (
                <a
                  href={`tel:${telefonoCliente}`}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border font-semibold transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Phone className="h-4 w-4 text-accent" aria-hidden="true" /> Llamar al cliente
                  <span className="font-normal text-muted-foreground">· {telefonoCliente}</span>
                </a>
              ) : (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" aria-hidden="true" /> Sin teléfono registrado
                </span>
              )}
            </div>
            {p0.notas && (
              <p className="mt-3 rounded-md bg-secondary px-3 py-2 text-xs text-secondary-foreground">
                Nota: {p0.notas}
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Estadistica label="Alitas" value={p0.alitas ?? "—"} />
            <Estadistica label="Distancia" value={`${distanceKm} km`} highlight={!!resultadoACO} />
            <Estadistica label="ETA" value={`${etaMin} min`} highlight={!!resultadoACO} />
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold">Paradas de la ruta</h3>
            <ol className="mt-3 space-y-3 text-sm">
              <ParadaRuta index="A" title="Recogida" sub={PICKUP.label} addr={PICKUP.address} />
              <ParadaRuta
                index="B"
                title="Entrega"
                sub={nombreCliente}
                addr={pedido.Direccion_Destino}
                accent
              />
            </ol>
          </div>

          {/* Acciones de estado */}
          {estado === "entregado" ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-4 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
              Pedido entregado
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2.5 text-xs">
                <span className="text-muted-foreground">Estado actual</span>
                <span
                  className={`font-semibold ${
                    estado === "en_camino"
                      ? "text-primary"
                      : estado === "asignado"
                        ? "text-accent"
                        : "text-muted-foreground"
                  }`}
                >
                  {estado === "sin_asignar" && "⏳ Sin asignar"}
                  {estado === "asignado" && "🍗 En preparación"}
                  {estado === "en_camino" && "🛵 En camino"}
                </span>
              </div>

              {errorEstado && (
                <p
                  role="alert"
                  className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive"
                >
                  {errorEstado}
                </p>
              )}
              {/* En móvil los botones viven en la barra fija inferior */}
              <div className="hidden lg:block">{botonesEstado}</div>

              {!incidenciaEnviada ? (
                !mostrarIncidencia ? (
                  <button
                    onClick={() => setMostrarIncidencia(true)}
                    className="mt-1 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-muted-foreground transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Reportar incidencia
                  </button>
                ) : (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p id="titulo-incidencia" className="text-sm font-semibold text-destructive">
                        Reportar incidencia
                      </p>
                      <button
                        onClick={() => setMostrarIncidencia(false)}
                        aria-label="Cerrar reporte de incidencia"
                        className="-mr-2 grid h-10 min-h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                    <label htmlFor="incidencia-tipo" className="sr-only">
                      Tipo de incidencia
                    </label>
                    <select
                      id="incidencia-tipo"
                      value={incidenciaTipo}
                      onChange={(e) => setIncidenciaTipo(e.target.value)}
                      className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option>Dirección no encontrada</option>
                      <option>Cliente no disponible</option>
                      <option>Accidente o emergencia</option>
                      <option>Pedido dañado</option>
                      <option>Otro</option>
                    </select>
                    <label htmlFor="incidencia-detalle" className="sr-only">
                      Detalle de la incidencia
                    </label>
                    <textarea
                      id="incidencia-detalle"
                      value={incidenciaDetalle}
                      onChange={(e) => setIncidenciaDetalle(e.target.value)}
                      rows={2}
                      placeholder="Describe el problema…"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                    />
                    {errorIncidencia && (
                      <p role="alert" className="text-xs text-destructive">
                        {errorIncidencia}
                      </p>
                    )}
                    <button
                      onClick={enviarIncidencia}
                      disabled={enviandoIncidencia}
                      className="h-11 w-full rounded-md bg-destructive px-3 text-sm font-semibold text-destructive-foreground transition hover:opacity-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {enviandoIncidencia ? (
                        <Loader2 className="inline h-4 w-4 animate-spin mr-1" />
                      ) : null}
                      Enviar reporte al administrador
                    </button>
                  </div>
                )
              ) : (
                <div className="rounded-xl border border-yellow-400/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
                  <AlertTriangle className="inline h-4 w-4 mr-1" />
                  Incidencia reportada. El administrador fue notificado.
                </div>
              )}
            </div>
          )}

          {store.get().session?.role === "admin" && (
            <p className="text-center text-xs text-muted-foreground">
              Vista de administrador — cambios de estado se aplican al backend
            </p>
          )}
        </aside>
      </main>

      {/* Barra de acciones fija (móvil/tablet): siempre al alcance del pulgar */}
      {!entregado && (
        <div className="pb-safe-3 fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 pt-3 shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.3)] backdrop-blur lg:hidden">
          {errorEstado && (
            <p role="alert" className="mb-2 text-xs text-destructive">
              {errorEstado}
            </p>
          )}
          {botonesEstado}
        </div>
      )}
    </div>
  );
}

function Estadistica({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 text-center ${highlight ? "border-accent/40 bg-accent/10" : "border-border bg-card"}`}
    >
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${highlight ? "text-accent" : ""}`}>{value}</div>
    </div>
  );
}

function ParadaRuta({
  index,
  title,
  sub,
  addr,
  accent,
}: {
  index: string;
  title: string;
  sub: string;
  addr: string;
  accent?: boolean;
}) {
  return (
    <li className="flex gap-3">
      <span
        className={`grid h-7 w-7 flex-none place-items-center rounded-full text-xs font-bold ${accent ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground"}`}
      >
        {index}
      </span>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </div>
        <div className="font-medium">{sub}</div>
        <div className="text-xs text-muted-foreground">{addr}</div>
      </div>
    </li>
  );
}
