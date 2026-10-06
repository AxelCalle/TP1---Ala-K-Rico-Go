import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  MapPin,
  PackageCheck,
  Truck,
  ChefHat,
  ClipboardList,
  ChevronLeft,
  Phone,
  Loader2,
  Navigation,
  Timer,
  XCircle,
} from "lucide-react";
import { LogoIcon } from "../components/Logo";
import { store } from "@/lib/store";
import { api } from "@/lib/api";
import { MapaRuta } from "@/components/MapaRuta";
import { RESTAURANTE_COORDS, RESTAURANTE_DIRECCION } from "@/lib/constants";

export const Route = createFileRoute("/seguimiento/$orderId")({
  head: ({ params }) => ({
    meta: [{ title: `Seguimiento ${params.orderId} — Ala K' Rico GO` }],
  }),
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const session = store.get().session;
    if (!session) throw redirect({ to: "/login" });
  },
  component: PaginaSeguimiento,
  notFoundComponent: () => (
    <div className="grid min-h-dvh place-items-center bg-background p-6 text-center">
      <div className="space-y-4">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground">
          <PackageCheck className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-semibold">Pedido no encontrado</h1>
        <p className="text-sm text-muted-foreground">
          Verifica el código de seguimiento o revisa tus pedidos activos.
        </p>
        <Link
          to="/cliente"
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Ver mis pedidos
        </Link>
      </div>
    </div>
  ),
});

const STEPS = [
  {
    key: "sin_asignar",
    label: "Pedido recibido",
    icon: ClipboardList,
    desc: "Tu pedido fue registrado y está en cola.",
  },
  {
    key: "asignado",
    label: "En preparación",
    icon: ChefHat,
    desc: "Nuestro equipo está preparando tus alitas.",
  },
  { key: "en_camino", label: "En camino", icon: Truck, desc: "Tu repartidor está en camino." },
  {
    key: "entregado",
    label: "Entregado",
    icon: PackageCheck,
    desc: "¡Pedido entregado! Buen provecho.",
  },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

const GREETINGS: Record<StepKey, (nombre: string) => string> = {
  sin_asignar: (n) => `Recibimos tu pedido, ${n}.`,
  asignado: (n) => `Tus alitas están en preparación, ${n}.`,
  en_camino: (n) => `¡Ya van en camino, ${n}!`,
  entregado: (n) => `¡Que aproveche, ${n}!`,
};

const SUBTITLES: Record<StepKey, string> = {
  sin_asignar: "Estamos procesando tu orden. Te notificaremos cuando salga de cocina.",
  asignado: "Un repartidor fue asignado. En breve estarán de camino.",
  en_camino: "Tu repartidor está en ruta. Prepara un lugar para recibirlas.",
  entregado: "Gracias por elegir Ala K' Rico GO. ¡Vuelve pronto!",
};

function PaginaSeguimiento() {
  const { orderId } = Route.useParams();

  // Acepta formato "AKA-1042" (desde la landing) o numérico directo
  const numericId = parseInt(orderId.replace(/^AKA-0*/i, ""), 10);

  const {
    data: pedido,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["seguimiento", orderId],
    queryFn: () => {
      if (!numericId || isNaN(numericId)) throw new Error("id_invalido");
      return api.obtenerPedido(numericId);
    },
    refetchInterval: 10000,
    retry: 1,
    enabled: !!numericId && !isNaN(numericId),
  });

  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Cargando pedido"
        className="grid min-h-dvh place-items-center bg-background"
      >
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (isError || !pedido) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background p-6 text-center">
        <div className="space-y-4">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground">
            <PackageCheck className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-semibold">Pedido no encontrado</h1>
          <p className="text-sm text-muted-foreground">
            Verifica el código de seguimiento o revisa tus pedidos activos.
          </p>
          <Link
            to="/cliente"
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Ver mis pedidos
          </Link>
        </div>
      </div>
    );
  }

  const productos = (() => {
    try {
      return JSON.parse(pedido.Productos ?? "[]");
    } catch {
      return [];
    }
  })();
  const p0 = productos[0] ?? {};

  const estado = pedido.Estado as StepKey;
  const currentIndex = STEPS.findIndex((s) => s.key === estado);
  const currentStep = STEPS[currentIndex] ?? STEPS[0];

  const nombre = pedido.Nombre_Cliente?.split(" ")[0] ?? "Cliente";
  const coordsDestino: [number, number] = [pedido.Lat_Destino, pedido.Lng_Destino];

  const nombreRepartidor = pedido.Nombre_Repartidor
    ? `${pedido.Nombre_Repartidor} ${pedido.Apellido_Repartidor ?? ""}`.trim()
    : null;

  const woId = `AKA-${String(pedido.Id_Pedido).padStart(4, "0")}`;
  const cancelado = pedido.Estado === "cancelado";

  // Datos de presentación: distancia en línea recta y ETA aproximado (misma
  // heurística que la vista de cliente: ~20 min desde la asignación).
  const distanciaKm = distanciaHaversineKm(RESTAURANTE_COORDS, coordsDestino);
  const etaMin =
    estado === "en_camino"
      ? Math.max(
          1,
          20 -
            (pedido.Asignacion_Pedido
              ? Math.round((Date.now() - new Date(pedido.Asignacion_Pedido).getTime()) / 60000)
              : 0),
        )
      : null;

  return (
    <div className="min-h-dvh overflow-x-clip bg-background">
      {/* Header sticky compacto con safe-area (notch) */}
      <header className="safe-top sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-2 sm:px-6">
          <Link
            to="/cliente"
            aria-label="Volver a mis pedidos"
            className="inline-flex h-11 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Mis pedidos</span>
          </Link>
          <p className="min-w-0 truncate font-mono text-sm font-semibold">{woId}</p>
          <Link
            to="/"
            aria-label="Ala K' Rico GO — inicio"
            className="inline-flex h-11 items-center gap-2 rounded-md px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LogoIcon size={28} />
            <span className="hidden font-display text-base tracking-wide sm:inline">GO</span>
          </Link>
        </div>
      </header>

      {/*
       * Móvil: estado compacto → mapa grande (≈60svh) → timeline → detalles.
       * ≥lg: mapa alto a la izquierda (sticky) + panel lateral de 380px.
       */}
      <main className="mx-auto grid max-w-6xl gap-4 px-3 py-4 sm:px-6 sm:py-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-6">
        {/* Encabezado de estado (en desktop va arriba del panel lateral) */}
        <section
          aria-labelledby="seg-titulo"
          className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5 lg:col-start-2 lg:row-start-1"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {cancelado ? "Pedido cancelado" : (STEPS[currentIndex]?.label ?? "Pedido")}
              </p>
              <h1
                id="seg-titulo"
                className="mt-1 break-words text-2xl font-semibold leading-tight sm:text-3xl"
              >
                {cancelado
                  ? `Tu pedido fue cancelado, ${nombre}.`
                  : (GREETINGS[currentStep.key]?.(nombre) ?? `Hola, ${nombre}`)}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {cancelado
                  ? "Si tienes dudas, llámanos y te ayudamos."
                  : SUBTITLES[currentStep.key]}
              </p>
            </div>
            <span
              aria-hidden="true"
              className={`grid h-12 w-12 shrink-0 place-items-center rounded-full sm:h-14 sm:w-14 ${
                estado === "entregado"
                  ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : cancelado
                    ? "bg-destructive/15 text-destructive"
                    : estado === "en_camino"
                      ? "bg-accent/15 text-accent"
                      : "bg-muted text-muted-foreground"
              }`}
            >
              {(() => {
                const Icon = cancelado ? XCircle : currentStep.icon;
                return <Icon className="h-6 w-6 sm:h-7 sm:w-7" />;
              })()}
            </span>
          </div>

          {/* ETA / distancia destacados */}
          {!cancelado && (
            <dl className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-accent/10 px-3 py-2.5">
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Timer className="h-3.5 w-3.5 flex-none" /> Llegada aprox.
                </dt>
                <dd className="mt-0.5 font-display text-2xl leading-none text-foreground">
                  {etaMin != null
                    ? `~${etaMin} min`
                    : estado === "entregado"
                      ? "Entregado"
                      : "Calculando…"}
                </dd>
              </div>
              <div className="rounded-lg bg-muted px-3 py-2.5">
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Navigation className="h-3.5 w-3.5 flex-none" /> Distancia
                </dt>
                <dd className="mt-0.5 font-display text-2xl leading-none text-foreground">
                  {distanciaKm.toFixed(1)} km
                </dd>
              </div>
            </dl>
          )}
        </section>

        {/* Mapa — Leaflet + OpenStreetMap, NUNCA Google Maps.
            La altura se controla con una variable CSS para que sea grande en móvil
            y ocupe casi todo el alto de la ventana en desktop. isolate contiene los
            z-index de Leaflet para que no tapen el header sticky. */}
        <section
          aria-label="Mapa de la entrega"
          className="isolate min-w-0 overflow-hidden rounded-xl border border-border bg-card [--mapa-h:clamp(300px,58svh,520px)] lg:sticky lg:top-[calc(env(safe-area-inset-top)+4.5rem)] lg:col-start-1 lg:row-span-4 lg:row-start-1 lg:[--mapa-h:calc(100dvh-8.5rem)]"
        >
          <div className="flex items-center gap-2 border-b border-border px-4 py-3 sm:px-5">
            <MapPin className="h-4 w-4 flex-none text-accent" />
            <span className="min-w-0 truncate text-sm font-medium">
              {estado === "en_camino" ? "Tu pedido va en camino" : "Destino de entrega"}
            </span>
          </div>
          <MapaRuta
            origen={RESTAURANTE_DIRECCION}
            coordsOrigen={RESTAURANTE_COORDS}
            destino={pedido.Direccion_Destino}
            coordsDestino={coordsDestino}
            altura="var(--mapa-h)"
          />
        </section>

        {/* Stepper: Recibido → En preparación → En camino → Entregado */}
        <section
          aria-labelledby="seg-estado"
          className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5 lg:col-start-2"
        >
          <h2
            id="seg-estado"
            className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Estado del pedido
          </h2>
          <ol className="relative space-y-0">
            {STEPS.map((step, i) => {
              const done = i < currentIndex;
              const active = i === currentIndex;
              const future = i > currentIndex;
              const isLast = i === STEPS.length - 1;
              const Icon = step.icon;

              return (
                <li
                  key={step.key}
                  className="flex gap-3 sm:gap-4"
                  aria-current={active ? "step" : undefined}
                >
                  <div className="flex flex-col items-center">
                    <span
                      className={`relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 transition-all ${
                        done
                          ? "border-primary bg-primary text-primary-foreground"
                          : active
                            ? "border-accent bg-accent text-accent-foreground"
                            : "border-border bg-background text-muted-foreground"
                      }`}
                    >
                      {done ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Icon className={`h-4 w-4 ${active ? "" : "opacity-50"}`} />
                      )}
                      {active && (
                        <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-20 motion-reduce:hidden" />
                      )}
                    </span>
                    {!isLast && (
                      <div
                        className={`my-1 w-0.5 flex-1 min-h-[20px] transition-colors ${
                          done ? "bg-primary" : "bg-border"
                        }`}
                      />
                    )}
                  </div>
                  <div className={`min-w-0 pb-4 pt-2 ${isLast ? "pb-0" : ""}`}>
                    <p
                      className={`text-sm font-semibold ${future ? "text-muted-foreground" : "text-foreground"}`}
                    >
                      {step.label}
                    </p>
                    {active && <p className="mt-0.5 text-xs text-accent">{step.desc}</p>}
                    {done && <p className="mt-0.5 text-xs text-muted-foreground">Completado</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Detalles + repartidor: 2 columnas en tablet, apilados en el panel lateral */}
        <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:col-start-2 lg:grid-cols-1">
          <section className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tu repartidor
            </h2>
            {nombreRepartidor && estado !== "sin_asignar" ? (
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent/15 text-base font-bold text-accent">
                  {nombreRepartidor
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="break-words font-semibold">{nombreRepartidor}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {estado === "en_camino"
                      ? "En camino a tu dirección"
                      : estado === "entregado"
                        ? "Pedido entregado"
                        : "Listo para salir de cocina"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 shrink-0 rounded-full bg-muted" />
                <p className="min-w-0 text-sm text-muted-foreground">
                  {estado === "sin_asignar"
                    ? "Estamos asignando un repartidor a tu pedido."
                    : "Un repartidor está siendo asignado."}
                </p>
              </div>
            )}
          </section>

          <section className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tu pedido
            </h2>
            <dl className="space-y-2.5 text-sm">
              {p0.alitas && <FilaDato label="Alitas" value={`${p0.alitas} piezas`} />}
              {p0.salsa && <FilaDato label="Salsa" value={p0.salsa} />}
              <FilaDato label="Dirección" value={pedido.Direccion_Destino} multiline />
              {p0.notas && <FilaDato label="Notas" value={p0.notas} multiline />}
            </dl>
          </section>
        </div>

        {/* Contacto: botones táctiles (tel:) */}
        <section aria-label="Contacto" className="grid min-w-0 gap-2 lg:col-start-2">
          {pedido.Telf_Cliente && (
            <a
              href={`tel:${pedido.Telf_Cliente}`}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-accent hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Phone className="h-4 w-4 flex-none" />
              <span className="min-w-0 truncate">{pedido.Telf_Cliente}</span>
            </a>
          )}
          <a
            href="tel:+51000000000"
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Phone className="h-4 w-4 flex-none" />
            Llamar al restaurante
          </a>
          <p className="pb-safe-3 text-center text-xs text-muted-foreground">
            ¿Algún problema con tu pedido? Llámanos y te ayudamos de inmediato.
          </p>
        </section>
      </main>
    </div>
  );
}

/** Distancia en línea recta (km) entre dos coordenadas — solo para mostrar. */
function distanciaHaversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function FilaDato({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 ${multiline ? "flex-col gap-0.5" : "items-start justify-between gap-4"}`}
    >
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={`min-w-0 break-words font-medium ${multiline ? "" : "text-right"}`}>
        {value}
      </dd>
    </div>
  );
}
