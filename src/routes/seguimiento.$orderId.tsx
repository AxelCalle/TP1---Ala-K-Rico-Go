import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { Check, MapPin, PackageCheck, Truck, ChefHat, ClipboardList, ChevronLeft, Phone } from "lucide-react";
import { LogoIcon } from "../components/Logo";
import { store, useStore } from "@/lib/store";

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
  const session = useStore((s) => s.session);
  const order = useStore((s) =>
    s.orders.find(
      (o) => o.id === orderId &&
        (session?.role === "admin" || o.customerId === session?.customerId),
    ),
  );
  const drivers = useStore((s) => s.drivers);

  if (!order) {
    if (typeof window !== "undefined") throw notFound();
    return null;
  }

  const driver = drivers.find((d) => d.id === order.driverId);
  const currentIndex = STEPS.findIndex((s) => s.key === order.status);
  const currentStep = STEPS[currentIndex] ?? STEPS[0];
  const nombre = order.customer.split(" ")[0];
  const urlMapa = `https://www.google.com/maps?q=${encodeURIComponent(order.address)}&output=embed`;

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
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

        {/* ── Encabezado de estado ─────────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {order.id}
              </p>
              <h1 className="mt-1 text-2xl font-semibold leading-tight sm:text-3xl">
                {GREETINGS[currentStep.key as StepKey]?.(nombre) ?? `Hola, ${nombre}`}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {SUBTITLES[currentStep.key as StepKey]}
              </p>
            </div>
            {/* Ícono de estado grande */}
            <span
              className={`hidden shrink-0 sm:grid h-14 w-14 place-items-center rounded-full ${
                order.status === "entregado"
                  ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : order.status === "en_camino"
                  ? "bg-accent/15 text-accent"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {(() => { const Icon = currentStep.icon; return <Icon className="h-7 w-7" />; })()}
            </span>
          </div>
        </div>

        {/* ── Stepper ─────────────────────────────────────────────────────── */}
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
                  {/* Línea + círculo */}
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

                  {/* Texto */}
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

        {/* ── Grid: detalles + repartidor ─────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2">

          {/* Detalles del pedido */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tu pedido
            </h2>
            <dl className="space-y-2.5 text-sm">
              <FilaDato label="Alitas" value={`${order.wings} piezas`} />
              <FilaDato label="Salsa"  value={order.sauce} />
              <FilaDato label="Dirección" value={order.address} multiline />
              {order.notes && <FilaDato label="Notas" value={order.notes} />}
            </dl>
          </div>

          {/* Repartidor */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tu repartidor
            </h2>
            {driver && order.status !== "sin_asignar" ? (
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent/15 text-base font-bold text-accent">
                  {driver.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold">{driver.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {order.status === "en_camino"
                      ? "En camino a tu dirección"
                      : order.status === "entregado"
                      ? "Pedido entregado"
                      : "Listo para salir de cocina"}
                  </p>
                  {driver.phone && (
                    <a
                      href={`tel:${driver.phone}`}
                      className="mt-1.5 inline-flex items-center gap-1 rounded-sm text-xs text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Phone className="h-3 w-3" /> {driver.phone}
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="h-12 w-12 rounded-full bg-muted" />
                <p className="text-sm text-muted-foreground">
                  {order.status === "sin_asignar"
                    ? "Estamos asignando un repartidor a tu pedido."
                    : "Un repartidor está siendo asignado."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Mapa ────────────────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3">
            <MapPin className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium">Destino de entrega</span>
          </div>
          <div className="relative h-[300px] w-full bg-muted sm:h-[360px]">
            <iframe
              title={`Mapa a ${order.address}`}
              src={urlMapa}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              sandbox="allow-scripts allow-same-origin"
              className="absolute inset-0 h-full w-full border-0"
            />
          </div>
        </div>

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
