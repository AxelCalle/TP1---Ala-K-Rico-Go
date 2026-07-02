import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Drumstick, Loader2, MapPin, Navigation, Phone, Route as RouteIcon, Truck, X } from "lucide-react";
import { store, useStore } from "@/lib/store";
import { construirGrafo, ejecutarACO, type AcoGraph, type AcoResult } from "@/lib/aco";
import { MapaRuta } from "@/components/MapaRuta";

export const Route = createFileRoute("/driver/$orderId")({
  head: ({ params }) => ({
    meta: [{ title: `Ruta ${params.orderId} — Ala K' Rico GO` }],
  }),
  component: PaginaRuta,
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center bg-background p-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Pedido no encontrado</h1>
        <Link to="/driver" className="mt-4 inline-block text-accent-foreground underline">
          Volver al portal del repartidor
        </Link>
      </div>
    </div>
  ),
});

const PICKUP = {
  label: "Cocina Ala K' Rico GO",
  address: "Jr. Áncash 3855, San Martín de Porres 15101 Lima Perú",
  coords: [-12.0278455, -77.0895871] as [number, number],
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

  // Compute max pheromone for normalisation
  let maxPh = 0;
  if (result) result.pheromones.forEach((v) => { if (v > maxPh) maxPh = v; });

  // Best path edge set for quick lookup
  const bestEdges = new Set<string>();
  if (result) {
    for (let i = 0; i < result.path.length - 1; i++) {
      const a = result.path[i], b = result.path[i + 1];
      bestEdges.add(a < b ? `${a}-${b}` : `${b}-${a}`);
    }
  }

  // Draw all edges
  for (const e of graph.edges) {
    const key = e.from < e.to ? `${e.from}-${e.to}` : `${e.to}-${e.from}`;
    const isBest = bestEdges.has(key);

    if (isBest) continue; // draw best path on top

    const ph = result ? (result.pheromones.get(key) ?? 0) / maxPh : 0;
    ctx.beginPath();
    ctx.moveTo(toX(graph.nodes[e.from].x), toY(graph.nodes[e.from].y));
    ctx.lineTo(toX(graph.nodes[e.to].x), toY(graph.nodes[e.to].y));
    ctx.strokeStyle = result
      ? `rgba(99,102,241,${0.08 + ph * 0.35})`
      : "rgba(148,163,184,0.25)";
    ctx.lineWidth = result ? 1 + ph * 2.5 : 1;
    ctx.stroke();
  }

  // Draw best path (highlighted)
  if (result && result.path.length > 1) {
    ctx.beginPath();
    const first = graph.nodes[result.path[0]];
    ctx.moveTo(toX(first.x), toY(first.y));
    for (let i = 1; i < result.path.length; i++) {
      const n = graph.nodes[result.path[i]];
      ctx.lineTo(toX(n.x), toY(n.y));
    }
    ctx.strokeStyle = "hsl(var(--accent))";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  // Draw nodes
  for (const n of graph.nodes) {
    const cx = toX(n.x);
    const cy = toY(n.y);
    const isEndpoint = n.id === 0 || n.id === 1;
    const onPath = result?.path.includes(n.id);

    ctx.beginPath();
    ctx.arc(cx, cy, isEndpoint ? 9 : onPath ? 6 : 4, 0, Math.PI * 2);

    if (n.id === 0) {
      ctx.fillStyle = "hsl(var(--primary))";
    } else if (n.id === 1) {
      ctx.fillStyle = "hsl(var(--accent))";
    } else if (onPath) {
      ctx.fillStyle = "hsl(var(--accent) / 0.7)";
    } else {
      ctx.fillStyle = "hsl(var(--muted-foreground) / 0.4)";
    }
    ctx.fill();

    if (n.label) {
      ctx.fillStyle = "hsl(var(--primary-foreground))";
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(n.label, cx, cy);
    }
  }
}

function PaginaRuta() {
  const { orderId } = Route.useParams();
  const order = useStore((s) => s.orders.find((o) => o.id === orderId));

  const [resultadoACO, setResultadoACO] = useState<AcoResult | null>(null);
  const [calculandoACO, setCalculandoACO] = useState(false);
  const [grafoACO] = useState<AcoGraph>(() => construirGrafo(orderId));
  const [mostrarIncidencia, setMostrarIncidencia] = useState(false);
  const [incidenciaTipo, setIncidenciaTipo] = useState("Dirección no encontrada");
  const [incidenciaDetalle, setIncidenciaDetalle] = useState("");
  const [incidenciaEnviada, setIncidenciaEnviada] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // En SSR localStorage no existe → order es undefined; solo tirar notFound en el cliente
  if (!order) {
    if (typeof window !== "undefined") throw notFound();
    return null;
  }

  const urlNavegacion = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    PICKUP.address,
  )}&destination=${encodeURIComponent(order.address)}&travelmode=driving`;

  const distanceKm = resultadoACO
    ? resultadoACO.distanceKm.toFixed(1)
    : (2 + (order.id.charCodeAt(order.id.length - 1) % 5)).toFixed(1);

  const etaMin = resultadoACO
    ? resultadoACO.etaMin
    : 5 + (order.id.charCodeAt(order.id.length - 1) % 8);

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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/driver" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Volver a pedidos
          </Link>
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-accent text-accent-foreground">
              <Drumstick className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight">Ala K' Rico GO</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[1fr_360px]">
        {/* Map section */}
        <div className="flex flex-col gap-6">
          <section className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-elegant)]">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Navigation className="h-4 w-4 text-accent" />
                Mejor ruta al destino
              </div>
              <a
                href={urlNavegacion}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
              >
                Abrir en Google Maps →
              </a>
            </div>
            <MapaRuta
              origen={PICKUP.address}
              coordsOrigen={PICKUP.coords}
              destino={order.address}
              coordsDestino={order.coords}
              altura={400}
            />
          </section>

          {/* ACO visualization panel */}
          <section className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-elegant)]">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <RouteIcon className="h-4 w-4 text-accent" />
                Optimización de ruta (ACO)
              </div>
              {resultadoACO && (
                <span className="rounded-md bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                  {resultadoACO.path.length - 1} segmentos · {resultadoACO.distanceKm.toFixed(1)} km
                </span>
              )}
            </div>

            <div className="p-4">
              <canvas
                ref={canvasRef}
                className="w-full rounded-lg bg-muted"
                style={{ height: 220 }}
              />

              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {resultadoACO
                    ? `Ruta óptima encontrada en ${resultadoACO.iterations} iteraciones con ${resultadoACO.path.length} nodos.`
                    : "Presiona el botón para calcular la ruta óptima con colonias de hormigas."}
                </p>
                <button
                  onClick={ejecutarOptimizacion}
                  disabled={calculandoACO}
                  className="inline-flex flex-none items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground transition hover:brightness-105 disabled:opacity-60"
                >
                  {calculandoACO ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Calculando…
                    </>
                  ) : (
                    <>
                      <RouteIcon className="h-3.5 w-3.5" />
                      {resultadoACO ? "Recalcular" : "Generar ruta"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">{order.id}</span>
              <span className="rounded-md bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                {order.sauce}
              </span>
            </div>
            <h2 className="mt-2 text-xl font-semibold">{order.customer}</h2>
            <div className="mt-3 space-y-2 text-sm">
              <a href={`tel:${order.phone}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                <Phone className="h-4 w-4" /> {order.phone || "Sin teléfono"}
              </a>
              <div className="flex items-start gap-2 text-foreground">
                <MapPin className="mt-0.5 h-4 w-4 text-accent" />
                <span>{order.address}</span>
              </div>
            </div>
            {order.notes && (
              <p className="mt-3 rounded-md bg-secondary px-3 py-2 text-xs text-secondary-foreground">
                Nota: {order.notes}
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Estadistica label="Alitas" value={order.wings} />
            <Estadistica
              label="Distancia"
              value={`${distanceKm} km`}
              highlight={!!resultadoACO}
            />
            <Estadistica
              label="ETA"
              value={`${etaMin} min`}
              highlight={!!resultadoACO}
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold">Paradas de la ruta</h3>
            <ol className="mt-3 space-y-3 text-sm">
              <ParadaRuta index="A" title="Recogida" sub={PICKUP.label} addr={PICKUP.address} />
              <ParadaRuta index="B" title="Entrega" sub={order.customer} addr={order.address} accent />
            </ol>
          </div>

          {/* ── Acciones de estado ─────────────────────────────────────── */}
          {order.status === "entregado" ? (
            /* Pedido ya entregado */
            <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-4 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
              Pedido entregado
            </div>
          ) : (
            <div className="space-y-2">
              {/* Estado actual */}
              <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2.5 text-xs">
                <span className="text-muted-foreground">Estado actual</span>
                <span className={`font-semibold ${
                  order.status === "en_camino"
                    ? "text-primary"
                    : order.status === "asignado"
                    ? "text-accent-foreground"
                    : "text-muted-foreground"
                }`}>
                  {order.status === "sin_asignar" && "⏳ Sin asignar"}
                  {order.status === "asignado"    && "🍗 En preparación"}
                  {order.status === "en_camino"   && "🛵 En camino"}
                </span>
              </div>

              {/* Botones de avance */}
              <div className={`grid gap-2 ${order.status === "en_camino" ? "grid-cols-1" : "grid-cols-2"}`}>
                {order.status !== "en_camino" && (
                  <button
                    onClick={() => store.setStatus(order.id, "en_camino")}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2.5 text-sm font-semibold transition hover:bg-secondary"
                  >
                    <Truck className="h-4 w-4" /> Iniciar entrega
                  </button>
                )}
                <button
                  onClick={() => store.setStatus(order.id, "entregado")}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-3 py-2.5 text-sm font-semibold text-accent-foreground transition hover:brightness-105"
                >
                  <CheckCircle2 className="h-4 w-4" /> Marcar entregado
                </button>
              </div>

              {/* Reportar incidencia (HU009 escenario 2) */}
              {!incidenciaEnviada ? (
                !mostrarIncidencia ? (
                  <button
                    onClick={() => setMostrarIncidencia(true)}
                    className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-secondary"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" /> Reportar incidencia
                  </button>
                ) : (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-destructive">Reportar incidencia</p>
                      <button onClick={() => setMostrarIncidencia(false)} className="text-muted-foreground hover:text-foreground">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <select
                      value={incidenciaTipo}
                      onChange={(e) => setIncidenciaTipo(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option>Dirección no encontrada</option>
                      <option>Cliente no disponible</option>
                      <option>Accidente o emergencia</option>
                      <option>Pedido dañado</option>
                      <option>Otro</option>
                    </select>
                    <textarea
                      value={incidenciaDetalle}
                      onChange={(e) => setIncidenciaDetalle(e.target.value)}
                      rows={2}
                      placeholder="Describe el problema…"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                    />
                    <button
                      onClick={() => { setIncidenciaEnviada(true); setMostrarIncidencia(false); }}
                      className="w-full rounded-md bg-destructive px-3 py-2 text-sm font-semibold text-destructive-foreground transition hover:opacity-90"
                    >
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
        </aside>
      </main>
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
    <div className={`rounded-xl border p-3 text-center ${highlight ? "border-accent/40 bg-accent/10" : "border-border bg-card"}`}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${highlight ? "text-accent-foreground" : ""}`}>
        {value}
      </div>
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
        className={`grid h-7 w-7 flex-none place-items-center rounded-full text-xs font-bold ${
          accent ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground"
        }`}
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
