import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Drumstick, ExternalLink, Loader2, LogOut, MapPin, Navigation, Route as RouteIcon, ShieldCheck } from "lucide-react";
import { store, useStore } from "@/lib/store";
import { construirGrafo, ejecutarACO, type AcoGraph, type AcoResult } from "@/lib/aco";
import { MapaRuta } from "@/components/MapaRuta";
import type { Order } from "@/lib/store";

export const Route = createFileRoute("/driver")({
  head: () => ({
    meta: [{ title: "Portal del repartidor — Ala K' Rico GO" }],
  }),
  component: PaginaRepartidor,
});

const RESTAURANTE_DIRECCION = "Jr. Áncash 3855, San Martín de Porres 15101 Lima Perú";
const RESTAURANTE_COORDS: [number, number] = [-12.0278455, -77.0895871];

const STATUS_ES: Record<string, string> = {
  sin_asignar: "Sin asignar",
  asignado: "Asignado",
  en_camino: "En camino",
  entregado: "Entregado",
};

// ─── Página principal ──────────────────────────────────────────────────────────

function PaginaRepartidor() {
  const navigate = useNavigate();
  const session = useStore((s) => s.session);
  const drivers = useStore((s) => s.drivers);
  const orders = useStore((s) => s.orders);

  const [pedidoActivo, setPedidoActivo] = useState<Order | null>(null);

  const activeDriverId = session?.driverId ?? drivers[0]?.id ?? "";
  const activeDriver = drivers.find((d) => d.id === activeDriverId);
  const myOrders = orders.filter((o) => o.driverId === activeDriverId);

  function cerrarSesion() {
    store.logout();
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-accent text-accent-foreground">
              <Drumstick className="h-5 w-5" />
            </span>
            <span className="text-lg font-semibold tracking-tight">Ala K' Rico GO</span>
            <span className="ml-2 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
              Repartidor
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {activeDriver?.name ?? "Repartidor"}
            </span>
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium transition hover:bg-secondary"
            >
              <ShieldCheck className="h-4 w-4" /> Admin
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

      {/* Layout principal: tabla + mapa lado a lado */}
      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[1fr_400px]">

        {/* Columna izquierda: pedidos */}
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {activeDriver?.name ?? "Repartidor"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {myOrders.length} pedido{myOrders.length === 1 ? "" : "s"} asignado{myOrders.length === 1 ? "" : "s"}.
              Selecciona uno para ver la ruta.
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-secondary-foreground">
                <tr className="text-left">
                  <Encabezado>Pedido</Encabezado>
                  <Encabezado>Cliente</Encabezado>
                  <Encabezado>Estado</Encabezado>
                  <Encabezado>Acción</Encabezado>
                </tr>
              </thead>
              <tbody>
                {myOrders.map((o) => (
                  <tr
                    key={o.id}
                    className={`border-t border-border transition-colors ${
                      pedidoActivo?.id === o.id ? "bg-accent/8" : "hover:bg-muted/40"
                    }`}
                  >
                    <Celda>
                      <div className="font-mono text-xs text-muted-foreground">{o.id}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{o.address}</div>
                    </Celda>
                    <Celda>
                      <div className="font-medium">{o.customer}</div>
                      <div className="text-xs text-muted-foreground">{o.phone}</div>
                    </Celda>
                    <Celda>
                      <span className="inline-block rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {STATUS_ES[o.status] ?? o.status}
                      </span>
                    </Celda>
                    <Celda>
                      <button
                        onClick={() => setPedidoActivo(o)}
                        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                          pedidoActivo?.id === o.id
                            ? "bg-accent text-accent-foreground"
                            : "bg-primary text-primary-foreground hover:opacity-90"
                        }`}
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        {pedidoActivo?.id === o.id ? "Activo" : "Generar ruta"}
                      </button>
                    </Celda>
                  </tr>
                ))}
                {myOrders.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      Aún no tienes pedidos asignados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Columna derecha: mapa siempre visible */}
        <PanelMapa pedido={pedidoActivo} />
      </main>
    </div>
  );
}

// ─── Panel de mapa (siempre visible) ─────────────────────────────────────────

function PanelMapa({ pedido }: { pedido: Order | null }) {
  const [acoResult, setAcoResult] = useState<AcoResult | null>(null);
  const [acoRunning, setAcoRunning] = useState(false);
  const [grafo, setGrafo] = useState<AcoGraph | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Cuando cambia el pedido, reiniciar el estado ACO y construir nuevo grafo
  useEffect(() => {
    setAcoResult(null);
    setGrafo(pedido ? construirGrafo(pedido.id) : null);
  }, [pedido?.id]);


  const navegacionUrl = pedido
    ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(RESTAURANTE_DIRECCION)}&destination=${encodeURIComponent(pedido.address)}&travelmode=driving`
    : "#";

  // Si el ACO ya calculó, usa sus valores (km y ETA ya vienen calibrados para moto).
  // Si no, muestra una estimación inicial basada en el ID del pedido.
  const distanciaKm = pedido
    ? acoResult
      ? acoResult.distanceKm.toFixed(1)
      : (2 + (pedido.id.charCodeAt(pedido.id.length - 1) % 5)).toFixed(1)
    : null;
  const etaMin = pedido
    ? acoResult
      ? acoResult.etaMin
      : 5 + (pedido.id.charCodeAt(pedido.id.length - 1) % 8)
    : null;

  const redibujar = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !grafo) return;
    const dpr = window.devicePixelRatio ?? 1;
    const cssW = canvas.clientWidth || 360;
    const cssH = canvas.clientHeight || 160;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    dibujarGrafo(ctx, cssW, cssH, grafo, acoResult);
  }, [grafo, acoResult]);

  useEffect(() => {
    redibujar();
  }, [redibujar]);

  function calcularACO() {
    if (!grafo) return;
    setAcoRunning(true);
    setTimeout(() => {
      try {
        setAcoResult(ejecutarACO(grafo));
      } catch {
        setAcoResult(null);
      } finally {
        setAcoRunning(false);
      }
    }, 60);
  }

  return (
    <div className="sticky top-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">

      {/* Encabezado */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Navigation className="h-4 w-4 text-accent" />
          {pedido ? (
            <span>Ruta → <span className="text-accent-foreground">{pedido.customer}</span></span>
          ) : (
            <span className="text-muted-foreground">Selecciona un pedido</span>
          )}
        </div>
        {pedido && (
          <a
            href={navegacionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <ExternalLink className="h-3 w-3" /> Navegar
          </a>
        )}
      </div>

      {/* Mapa con altura fija */}
      {!pedido ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 bg-muted">
          <MapPin className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Selecciona un pedido para ver la ruta</p>
        </div>
      ) : (
        <MapaRuta
          key={pedido.id}
          origen={RESTAURANTE_DIRECCION}
          coordsOrigen={RESTAURANTE_COORDS}
          destino={pedido.address}
          coordsDestino={pedido.coords}
          altura={320}
        />
      )}

      {/* Info y ACO (solo si hay pedido seleccionado) */}
      {pedido && (
        <div className="border-t border-border p-4 space-y-3">
          {/* Dirección */}
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="mt-0.5 h-4 w-4 flex-none text-accent" />
            <span className="text-muted-foreground">{pedido.address}</span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className={`rounded-lg border p-2 text-center ${acoResult ? "border-accent/40 bg-accent/10" : "border-border"}`}>
              <div className="text-xs text-muted-foreground">Distancia</div>
              <div className="font-semibold">{distanciaKm} km</div>
            </div>
            <div className={`rounded-lg border p-2 text-center ${acoResult ? "border-accent/40 bg-accent/10" : "border-border"}`}>
              <div className="text-xs text-muted-foreground">ETA</div>
              <div className="font-semibold">{etaMin} min</div>
            </div>
          </div>

          {/* ACO */}
          <div>
            <canvas
              ref={canvasRef}
              className="w-full rounded-md bg-muted"
              style={{ height: 120 }}
            />
            <button
              onClick={calcularACO}
              disabled={acoRunning}
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground transition hover:brightness-105 disabled:opacity-60"
            >
              {acoRunning ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Calculando…</>
              ) : (
                <><RouteIcon className="h-3.5 w-3.5" /> {acoResult ? "Recalcular ACO" : "Calcular ruta óptima (ACO)"}</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Función de dibujo ACO ────────────────────────────────────────────────────

function dibujarGrafo(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  grafo: AcoGraph,
  resultado: AcoResult | null,
) {
  const PAD = 18;
  ctx.clearRect(0, 0, W, H);
  const toX = (x: number) => PAD + x * (W - PAD * 2);
  const toY = (y: number) => PAD + y * (H - PAD * 2);

  let maxFer = 0;
  if (resultado) resultado.pheromones.forEach((v) => { if (v > maxFer) maxFer = v; });

  const optimas = new Set<string>();
  if (resultado) {
    for (let i = 0; i < resultado.path.length - 1; i++) {
      const a = resultado.path[i], b = resultado.path[i + 1];
      optimas.add(a < b ? `${a}-${b}` : `${b}-${a}`);
    }
  }

  for (const e of grafo.edges) {
    const k = e.from < e.to ? `${e.from}-${e.to}` : `${e.to}-${e.from}`;
    if (optimas.has(k)) continue;
    const ph = resultado ? (resultado.pheromones.get(k) ?? 0) / maxFer : 0;
    ctx.beginPath();
    ctx.moveTo(toX(grafo.nodes[e.from].x), toY(grafo.nodes[e.from].y));
    ctx.lineTo(toX(grafo.nodes[e.to].x), toY(grafo.nodes[e.to].y));
    ctx.strokeStyle = resultado ? `rgba(99,102,241,${0.07 + ph * 0.3})` : "rgba(148,163,184,0.18)";
    ctx.lineWidth = resultado ? 1 + ph * 2 : 1;
    ctx.stroke();
  }

  if (resultado?.path.length) {
    ctx.beginPath();
    ctx.moveTo(toX(grafo.nodes[resultado.path[0]].x), toY(grafo.nodes[resultado.path[0]].y));
    for (let i = 1; i < resultado.path.length; i++) {
      ctx.lineTo(toX(grafo.nodes[resultado.path[i]].x), toY(grafo.nodes[resultado.path[i]].y));
    }
    ctx.strokeStyle = "hsl(var(--accent))";
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  for (const n of grafo.nodes) {
    const cx = toX(n.x), cy = toY(n.y);
    ctx.beginPath();
    ctx.arc(cx, cy, n.id === 0 || n.id === 1 ? 7 : resultado?.path.includes(n.id) ? 4.5 : 3, 0, Math.PI * 2);
    ctx.fillStyle =
      n.id === 0 ? "hsl(var(--primary))" :
      n.id === 1 ? "hsl(var(--accent))" :
      resultado?.path.includes(n.id) ? "hsl(var(--accent) / 0.65)" :
      "hsl(var(--muted-foreground) / 0.3)";
    ctx.fill();
    if (n.label) {
      ctx.fillStyle = "hsl(var(--primary-foreground))";
      ctx.font = "bold 7px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(n.label, cx, cy);
    }
  }
}

// ─── Componentes de tabla ─────────────────────────────────────────────────────

function Encabezado({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">{children}</th>;
}
function Celda({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}
