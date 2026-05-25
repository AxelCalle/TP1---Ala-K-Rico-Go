import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Drumstick, MapPin, PackageCheck, Truck, ChefHat, ClipboardList } from "lucide-react";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/seguimiento/$orderId")({
  head: ({ params }) => ({
    meta: [{ title: `Seguimiento ${params.orderId} — Ala K' Rico GO` }],
  }),
  component: TrackingPage,
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center bg-background p-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Pedido no encontrado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Verifica el código de seguimiento e inténtalo de nuevo.
        </p>
        <Link to="/" className="mt-4 inline-block text-accent-foreground underline">
          Volver al inicio
        </Link>
      </div>
    </div>
  ),
});

const STEPS = [
  { key: "unassigned", label: "Pedido recibido", icon: ClipboardList },
  { key: "assigned", label: "En preparación", icon: ChefHat },
  { key: "in_transit", label: "En camino", icon: Truck },
  { key: "delivered", label: "Entregado", icon: PackageCheck },
] as const;

function TrackingPage() {
  const { orderId } = Route.useParams();
  const order = useStore((s) => s.orders.find((o) => o.id === orderId));
  const drivers = useStore((s) => s.drivers);

  if (!order) throw notFound();

  const driver = drivers.find((d) => d.id === order.driverId);
  const currentIndex = STEPS.findIndex((s) => s.key === order.status);
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(order.address)}&output=embed`;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-accent text-accent-foreground">
              <Drumstick className="h-5 w-5" />
            </span>
            <span className="text-lg font-semibold tracking-tight">Ala K' Rico GO</span>
          </Link>
          <span className="font-mono text-xs text-muted-foreground">{order.id}</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
        <div>
          <p className="text-sm text-muted-foreground">Seguimiento del pedido</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Hola {order.customer.split(" ")[0]}, tus alitas van en camino
          </h1>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <ol className="space-y-5">
            {STEPS.map((step, i) => {
              const done = i <= currentIndex;
              const active = i === currentIndex;
              const Icon = step.icon;
              return (
                <li key={step.key} className="flex items-start gap-4">
                  <span
                    className={`grid h-10 w-10 flex-none place-items-center rounded-full transition ${
                      done
                        ? active
                          ? "bg-accent text-accent-foreground shadow-[var(--shadow-amber)]"
                          : "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="pt-1.5">
                    <div className={`text-sm font-semibold ${done ? "text-foreground" : "text-muted-foreground"}`}>
                      {step.label}
                    </div>
                    {active && (
                      <div className="mt-0.5 text-xs text-accent-foreground/80">
                        Estado actual
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold">Tu pedido</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Alitas" value={`${order.wings} pzas`} />
              <Row label="Salsa" value={order.sauce} />
              <Row label="Dirección" value={order.address} />
              {order.notes && <Row label="Notas" value={order.notes} />}
            </dl>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold">Tu repartidor</h3>
            {driver ? (
              <div className="mt-3 flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-accent/15 text-base font-semibold text-accent-foreground">
                  {driver.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </span>
                <div>
                  <div className="font-medium">{driver.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Se le asignará tu pedido apenas salga de cocina.
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Aún estamos asignando un repartidor a tu pedido.
              </p>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3 text-sm font-medium">
            <MapPin className="h-4 w-4 text-accent" /> Destino de entrega
          </div>
          <div className="relative h-[360px] w-full bg-muted">
            <iframe
              title={`Mapa a ${order.address}`}
              src={mapSrc}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="absolute inset-0 h-full w-full border-0"
              allowFullScreen
            />
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          ¿Algún problema? Llámanos y con gusto te ayudamos.
        </p>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
