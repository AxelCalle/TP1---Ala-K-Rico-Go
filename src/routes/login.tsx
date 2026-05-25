import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Drumstick } from "lucide-react";
import { store } from "@/lib/store";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Iniciar sesión — Ala K' Rico GO" },
      { name: "description", content: "Accede a Ala K' Rico GO para gestionar o entregar pedidos." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.includes("@") || password.length < 4) {
      setError("Ingresa un correo válido y una contraseña de 4 o más caracteres.");
      return;
    }
    store.login(email.trim(), password);
    const role = email.toLowerCase().includes("driver") || email.toLowerCase().includes("repartidor")
      ? "driver"
      : "admin";
    navigate({ to: role === "driver" ? "/driver" : "/admin" });
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div
        className="relative hidden flex-col justify-between p-10 text-white md:flex"
        style={{ background: "var(--gradient-hero)" }}
      >
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-accent text-accent-foreground">
            <Drumstick className="h-5 w-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Ala K' Rico GO</span>
        </Link>
        <div className="space-y-3">
          <h2 className="text-3xl font-semibold leading-tight">
            Despacha alitas <span className="text-accent">por la ruta más rápida.</span>
          </h2>
          <p className="max-w-sm text-sm text-white/70">
            Inicia sesión para registrar pedidos o atender tu ruta como repartidor.
          </p>
        </div>
        <p className="text-xs text-white/50">
          Tip: incluye "repartidor" en tu correo para entrar al portal de repartidor.
        </p>
      </div>

      <div className="flex items-center justify-center bg-background p-6">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm space-y-5 rounded-xl border border-border bg-card p-8 shadow-[var(--shadow-elegant)]"
        >
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Bienvenido</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Usa tu correo y contraseña para entrar.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Correo
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              maxLength={120}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none ring-ring/30 transition focus:border-ring focus:ring-2"
              placeholder="tu@alakricogo.com"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={120}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none ring-ring/30 transition focus:border-ring focus:ring-2"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Entrar
          </button>

          <p className="text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">
              ← Volver al inicio
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
