import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Drumstick, MapPin, PackageSearch, ShieldCheck, Truck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ala K' Rico GO — Alitas a domicilio" },
      {
        name: "description",
        content:
          "Pide tus alitas favoritas y sigue tu pedido en tiempo real. Panel para administradores y repartidores.",
      },
      { property: "og:title", content: "Ala K' Rico GO — Alitas a domicilio" },
      {
        property: "og:description",
        content:
          "Pide tus alitas favoritas y sigue tu pedido en tiempo real.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  function track(e: FormEvent) {
    e.preventDefault();
    const id = code.trim().toUpperCase();
    if (!id) return;
    navigate({ to: "/seguimiento/$orderId", params: { orderId: id } });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-accent text-accent-foreground">
            <Drumstick className="h-5 w-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Ala K' Rico GO</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Iniciar sesión
          </Link>
        </nav>
      </header>

      <section
        className="relative overflow-hidden border-b border-border"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 text-white md:grid-cols-2 md:py-28">
          <div className="flex flex-col justify-center">
            <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-wider text-white/80">
              <Drumstick className="h-3.5 w-3.5 text-accent" />
              Alitas calientes, entregas rápidas
            </span>
            <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
              Alitas crujientes, <span className="text-accent">a tu puerta.</span>
            </h1>
            <p className="mt-5 max-w-md text-base text-white/75 md:text-lg">
              Hacemos la ruta más rápida desde nuestra cocina hasta ti. Sigue tu
              pedido con tu código de seguimiento.
            </p>

            <form
              onSubmit={track}
              className="mt-8 flex flex-wrap items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] p-2 backdrop-blur"
            >
              <div className="flex flex-1 items-center gap-2 px-3">
                <PackageSearch className="h-4 w-4 text-accent" />
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Ej: WO-1042"
                  maxLength={20}
                  className="w-full bg-transparent py-2 text-sm text-white placeholder:text-white/40 outline-none"
                />
              </div>
              <button
                type="submit"
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:brightness-105"
              >
                Seguir pedido
              </button>
            </form>
          </div>

          <div className="relative">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[var(--shadow-elegant)] backdrop-blur">
              <div className="flex items-center justify-between text-xs text-white/60">
                <span>Despacho en vivo</span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                  3 repartidores activos
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {[
                  { id: "WO-1042", sauce: "Buffalo", driver: "Marcos R.", eta: "12 min" },
                  { id: "WO-1043", sauce: "BBQ", driver: "Sin asignar", eta: "—" },
                  { id: "WO-1041", sauce: "Miel y ajo", driver: "Aaliyah C.", eta: "Entregado" },
                ].map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm"
                  >
                    <div>
                      <div className="font-mono text-xs text-white/60">{r.id}</div>
                      <div className="font-medium">Alitas {r.sauce}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-white/60">{r.driver}</div>
                      <div className="text-sm font-semibold text-accent">{r.eta}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              title: "Pedidos desde admin",
              body: "El administrador registra cada pedido con cliente, dirección y salsa.",
            },
            {
              icon: Truck,
              title: "Asignación al repartidor",
              body: "Cada repartidor solo ve los pedidos asignados a su cuenta.",
            },
            {
              icon: MapPin,
              title: "Seguimiento del cliente",
              body: "El cliente sigue su pedido con un código y ve la ruta en el mapa.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-border bg-card p-6 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-elegant)]"
            >
              <span className="grid h-10 w-10 place-items-center rounded-md bg-accent/15 text-accent">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} Ala K' Rico GO</span>
          <span>Hecho con sabor.</span>
        </div>
      </footer>
    </div>
  );
}
