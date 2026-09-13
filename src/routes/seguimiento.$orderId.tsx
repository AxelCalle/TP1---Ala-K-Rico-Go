import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, MapPin, PackageCheck, Truck, ChefHat, ClipboardList, ChevronLeft, Phone, Loader2 } from "lucide-react";
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
    <div className="grid min-h-screen place-items-center bg-background p-6 text-center">
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
  { key: "sin_asignar", label: "Pedido recibido",  icon: ClipboardList, desc: "Tu pedido fue registrado y está en cola." },
  { key: "asignado",    label: "En preparación",    icon: ChefHat,       desc: "Nuestro equipo está preparando tus alitas." },
  { key: "en_camino",  label: "En camino",          icon: Truck,         desc: "Tu repartidor está en camino." },
  { key: "entregado",  label: "Entregado",           icon: PackageCheck,  desc: "¡Pedido entregado! Buen provecho." },
] as const;

type StepKey = typeof STEPS[number]["key"];

const GREETINGS: Record<StepKey, (nombre: string) => string> = {
  sin_asignar: (n) => `Recibimos tu pedido, ${n}.`,
  asignado:    (n) => `Tus alitas están en preparación, ${n}.`,
  en_camino:   (n) => `¡Ya van en camino, ${n}!`,
  entregado:   (n) => `¡Que aproveche, ${n}!`,
};

const SUBTITLES: Record<StepKey, string> = {
  sin_asignar: "Estamos procesando tu orden. Te notificaremos cuando salga de cocina.",
  asignado:    "Un repartidor fue asignado. En breve estarán de camino.",
  en_camino:   "Tu repartidor está en ruta. Prepara un lugar para recibirlas.",
  entregado:   "Gracias por elegir Ala K' Rico GO. ¡Vuelve pronto!",
};

function PaginaSeguimiento() {
  const { orderId } = Route.useParams();

  // Acepta formato "AKA-1042" (desde la landing) o numérico directo
  const numericId = parseInt(orderId.replace(/^AKA-0*/i, ""), 10);

  const { data: pedido, isLoading, isError } = useQuery({
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
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (isError || !pedido) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6 text-center">
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

  const productos = (() => { try { return JSON.parse(pedido.Productos ?? "[]"); } catch { return []; } })();
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <LogoIcon size={28} />
            <span className="font-display text-base tracking-wide">GO</span>
          </Link>
          <Link
            to="/cliente"
            className="inline-flex items-center gap-1 rounded-sm text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Mis pedidos
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-6">

        {/* Encabezado de estado */}
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {woId}
              </p>
              <h1 className="mt-1 text-2xl font-semibold leading-tight sm:text-3xl">
                {GREETINGS[currentStep.key]?.(nombre) ?? `Hola, ${nombre}`}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {SUBTITLES[currentStep.key]}
              </p>
            </div>
            <span
              className={`hidden shrink-0 sm:grid h-14 w-14 place-items-center rounded-full ${
                estado === "entregado"
                  ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : estado === "en_camino"
                  ? "bg-accent/15 text-accent"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {(() => { const Icon = currentStep.icon; return <Icon className="h-7 w-7" />; })()}
            </span>
          </div>
        </div>

        {/* Stepper */}
        <div className="rounded-xl border border-border bg-card px-5 py-5 sm:px-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Estado del pedido
          </h2>
          <ol className="relative space-y-0">
            {STEPS.map((step, i) => {
              const done   = i < currentIndex;
              const active = i === currentIndex;
              const future = i > currentIndex;
              const isLast = i === STEPS.length - 1;
              const Icon   = step.icon;

              return (
                <li key={step.key} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span
                      className={`relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 transition-all ${
                        done
                          ? "border-primary bg-primary text-primary-foreground"
                          : active
                          ? "border-accent bg-accent text-accent-foreground"
                          : "border-border bg-background text-muted-foreground"
                      }`}
                    >
                      {done
                        ? <Check className="h-4 w-4" />
                        : <Icon className={`h-4 w-4 ${active ? "" : "opacity-50"}`} />}
                      {active && (
                        <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-20" />
                      )}
                    </span>
                    {!isLast && (
                      <div
                        className={`my-1 w-0.5 flex-1 min-h-[24px] transition-colors ${
                          done ? "bg-primary" : "bg-border"
                        }`}
                      />
                    )}
                  </div>
                  <div className={`pb-5 pt-1.5 ${isLast ? "pb-0" : ""}`}>
                    <p className={`text-sm font-semibold ${future ? "text-muted-foreground" : "text-foreground"}`}>
                      {step.label}
                    </p>
                    {active && (
                      <p className="mt-0.5 text-xs text-accent">{step.desc}</p>
                    )}
                    {done && (
                      <p className="mt-0.5 text-xs text-muted-foreground">Completado</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Grid: detalles + repartidor */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tu pedido
            </h2>
            <dl className="space-y-2.5 text-sm">
              {p0.alitas && <FilaDato label="Alitas" value={`${p0.alitas} piezas`} />}
              {p0.salsa  && <FilaDato label="Salsa"  value={p0.salsa} />}
              <FilaDato label="Dirección" value={pedido.Direccion_Destino} multiline />
              {p0.notas  && <FilaDato label="Notas"  value={p0.notas} />}
            </dl>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tu repartidor
            </h2>
            {nombreRepartidor && estado !== "sin_asignar" ? (
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent/15 text-base font-bold text-accent">
                  {nombreRepartidor.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold">{nombreRepartidor}</p>
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
              <div className="flex flex-col gap-2">
                <div className="h-12 w-12 rounded-full bg-muted" />
                <p className="text-sm text-muted-foreground">
                  {estado === "sin_asignar"
                    ? "Estamos asignando un repartidor a tu pedido."
                    : "Un repartidor está siendo asignado."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Mapa — Leaflet + OpenStreetMap, NUNCA Google Maps */}
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3">
            <MapPin className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium">Destino de entrega</span>
          </div>
          <MapaRuta
            origen={RESTAURANTE_DIRECCION}
            coordsOrigen={RESTAURANTE_COORDS}
            destino={pedido.Direccion_Destino}
            coordsDestino={coordsDestino}
            altura={320}
          />
        </div>

        {pedido.Telf_Cliente && (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm">
            <Phone className="h-4 w-4 text-accent" />
            <a href={`tel:${pedido.Telf_Cliente}`} className="text-accent hover:underline">
              {pedido.Telf_Cliente}
            </a>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          ¿Algún problema con tu pedido?{" "}
          <a href="tel:+51000000000" className="rounded-sm text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Llámanos
          </a>{" "}
          y te ayudamos de inmediato.
        </p>
      </main>
    </div>
  );
}

function FilaDato({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className={`flex ${multiline ? "flex-col gap-0.5" : "items-start justify-between gap-4"}`}>
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={`font-medium ${multiline ? "" : "text-right"}`}>{value}</dd>
    </div>
  );
}
