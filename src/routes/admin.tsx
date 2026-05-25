import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Drumstick, Plus, LogOut, Truck, Copy, Check } from "lucide-react";
import { store, useStore, SAUCES, type Sauce } from "@/lib/store";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Administrador — Ala K' Rico GO" }],
  }),
  component: AdminPage,
});

const STATUS_ES: Record<string, string> = {
  unassigned: "Sin asignar",
  assigned: "Asignado",
  in_transit: "En camino",
  delivered: "Entregado",
};

function AdminPage() {
  const navigate = useNavigate();
  const session = useStore((s) => s.session);
  const orders = useStore((s) => s.orders);
  const drivers = useStore((s) => s.drivers);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  function logout() {
    store.logout();
    navigate({ to: "/" });
  }

  function copyTracking(id: string) {
    const url = `${window.location.origin}/seguimiento/${id}`;
    navigator.clipboard?.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-accent text-accent-foreground">
              <Drumstick className="h-5 w-5" />
            </span>
            <span className="text-lg font-semibold tracking-tight">Ala K' Rico GO</span>
            <span className="ml-2 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
              Admin
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {session?.email ?? "invitado"}
            </span>
            <Link
              to="/driver"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium transition hover:bg-secondary"
            >
              <Truck className="h-4 w-4" /> Vista repartidor
            </Link>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              <LogOut className="h-4 w-4" /> Salir
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Tablero de pedidos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Registra un nuevo pedido y asígnalo a un repartidor.
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground shadow-[var(--shadow-amber)] transition hover:brightness-105"
          >
            <Plus className="h-4 w-4" /> Nuevo pedido
          </button>
        </div>

        <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr className="text-left">
                <Th>Pedido</Th>
                <Th>Cliente</Th>
                <Th>Dirección</Th>
                <Th>Alitas</Th>
                <Th>Salsa</Th>
                <Th>Estado</Th>
                <Th>Repartidor</Th>
                <Th>Seguimiento</Th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-border">
                  <Td className="font-mono text-xs">{o.id}</Td>
                  <Td>
                    <div className="font-medium">{o.customer}</div>
                    <div className="text-xs text-muted-foreground">{o.phone}</div>
                  </Td>
                  <Td className="max-w-xs text-muted-foreground">{o.address}</Td>
                  <Td>{o.wings}</Td>
                  <Td>
                    <span className="rounded-md bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent-foreground">
                      {o.sauce}
                    </span>
                  </Td>
                  <Td>
                    <StatusPill status={o.status} />
                  </Td>
                  <Td>
                    <select
                      value={o.driverId ?? ""}
                      onChange={(e) => {
                        if (e.target.value) store.assignOrder(o.id, e.target.value);
                      }}
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    >
                      <option value="">Sin asignar</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </Td>
                  <Td>
                    <button
                      onClick={() => copyTracking(o.id)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition hover:bg-secondary"
                    >
                      {copied === o.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" /> Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" /> Copiar enlace
                        </>
                      )}
                    </button>
                  </Td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    Aún no hay pedidos — registra el primero.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {open && <PlaceOrderDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    unassigned: "bg-muted text-muted-foreground",
    assigned: "bg-accent/20 text-accent-foreground",
    in_transit: "bg-primary text-primary-foreground",
    delivered: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  };
  return (
    <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${map[status] ?? ""}`}>
      {STATUS_ES[status] ?? status}
    </span>
  );
}

function PlaceOrderDialog({ onClose }: { onClose: () => void }) {
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [wings, setWings] = useState(12);
  const [sauce, setSauce] = useState<Sauce>("Buffalo");
  const [notes, setNotes] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!customer.trim() || !address.trim() || wings < 1) return;
    store.addOrder({
      customer: customer.trim().slice(0, 100),
      phone: phone.trim().slice(0, 40),
      address: address.trim().slice(0, 200),
      wings: Math.min(200, Math.max(1, wings)),
      sauce,
      notes: notes.trim().slice(0, 200) || undefined,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-elegant)]"
      >
        <h2 className="text-xl font-semibold">Nuevo pedido de alitas</h2>
        <p className="mt-1 text-sm text-muted-foreground">Completa los datos del cliente y la salsa.</p>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <Field label="Nombre del cliente">
            <input required maxLength={100} value={customer} onChange={(e) => setCustomer(e.target.value)} className={input} />
          </Field>
          <Field label="Teléfono">
            <input maxLength={40} value={phone} onChange={(e) => setPhone(e.target.value)} className={input} placeholder="+52 55 5555 0000" />
          </Field>
          <Field label="Dirección de entrega" full>
            <input required maxLength={200} value={address} onChange={(e) => setAddress(e.target.value)} className={input} placeholder="Calle 123, Colonia, Ciudad" />
          </Field>
          <Field label="Cantidad de alitas">
            <input
              required
              type="number"
              min={1}
              max={200}
              value={wings}
              onChange={(e) => setWings(parseInt(e.target.value || "0", 10))}
              className={input}
            />
          </Field>
          <Field label="Salsa">
            <select value={sauce} onChange={(e) => setSauce(e.target.value as Sauce)} className={input}>
              {SAUCES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Notas" full>
            <input maxLength={200} value={notes} onChange={(e) => setNotes(e.target.value)} className={input} placeholder="Tocar dos veces, ranch extra…" />
          </Field>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium transition hover:bg-secondary"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:brightness-105"
          >
            Registrar pedido
          </button>
        </div>
      </form>
    </div>
  );
}

const input =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring/30 transition focus:border-ring focus:ring-2";

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`space-y-1.5 ${full ? "col-span-2" : ""}`}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
