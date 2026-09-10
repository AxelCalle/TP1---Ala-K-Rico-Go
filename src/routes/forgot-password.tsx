import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { KeyRound, MailCheck } from "lucide-react";
import { inputCls, ErrorMsg, TogglePass } from "@/components/FormBits";
import { LogoIcon } from "../components/Logo";
import { api } from "@/lib/api";


export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [{ title: "Recuperar contraseña — Ala K' Rico GO" }],
  }),
  component: ForgotPasswordPage,
});

type Paso = "email" | "nueva-clave" | "exito";

function ForgotPasswordPage() {
  const [paso, setPaso]       = useState<Paso>("email");
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [verPass, setVerPass] = useState(false);
  const [error, setError]     = useState("");

  // ── Paso 1: verificar correo ───────────────────────────────────────────────
  function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.includes("@")) {
      setError("Ingresa un correo electrónico válido.");
      return;
    }
    setPaso("nueva-clave");
  }

  // ── Paso 2: establecer nueva contraseña ────────────────────────────────────
  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    try {
      await api.resetPassword(email.trim(), password);
      setPaso("exito");
    } catch {
      setError("Ocurrió un error. Intenta nuevamente.");
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <LogoIcon size={32} />
          <span className="font-display text-xl tracking-wide">Ala K' Rico GO</span>
        </Link>

        {/* ── Paso 1: Correo ─────────────────────────────────────────────────── */}
        {paso === "email" && (
          <form
            onSubmit={handleEmailSubmit}
            className="space-y-5 rounded-xl border border-border bg-card p-8 shadow-[var(--shadow-elegant)]"
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-accent/15 text-accent">
                <KeyRound className="h-6 w-6" />
              </span>
              <h1 className="text-xl font-semibold">¿Olvidaste tu contraseña?</h1>
              <p className="text-sm text-muted-foreground">
                Ingresa tu correo y te ayudaremos a recuperar el acceso.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="fp-email" className="text-sm font-medium">
                Correo electrónico
              </label>
              <input
                id="fp-email" type="email" required autoComplete="email" maxLength={120}
                value={email} onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                placeholder="tu@correo.com"
              />
            </div>

            {error && <ErrorMsg>{error}</ErrorMsg>}

            <button type="submit" className={btnAccent}>
              Continuar
            </button>

            <p className="text-center text-sm text-muted-foreground">
              <Link to="/login" className="rounded-sm text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                ← Volver al inicio de sesión
              </Link>
            </p>
          </form>
        )}

        {/* ── Paso 2: Nueva contraseña ───────────────────────────────────────── */}
        {paso === "nueva-clave" && (
          <form
            onSubmit={handlePasswordSubmit}
            className="space-y-5 rounded-xl border border-border bg-card p-8 shadow-[var(--shadow-elegant)]"
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="text-xl font-semibold">Nueva contraseña</h1>
              <p className="text-sm text-muted-foreground">
                Cuenta:{" "}
                <span className="font-medium text-foreground">{email}</span>
              </p>
            </div>

            {/* Nota de prototipo */}
            <div className="rounded-md bg-muted px-3 py-2.5 text-xs text-muted-foreground">
              <strong>Nota (prototipo):</strong> En producción se enviaría un enlace al correo.
              Para el demo puedes ingresar tu nueva contraseña directamente.
            </div>

            <div className="space-y-1.5">
              <label htmlFor="fp-pass" className="text-sm font-medium">
                Nueva contraseña
              </label>
              <div className="relative">
                <input
                  id="fp-pass" type={verPass ? "text" : "password"}
                  required minLength={6} maxLength={120}
                  autoComplete="new-password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className={`${inputCls} pr-10`}
                  placeholder="Mínimo 6 caracteres"
                />
                <TogglePass ver={verPass} toggle={() => setVerPass((v) => !v)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="fp-confirmar" className="text-sm font-medium">
                Confirmar contraseña
              </label>
              <input
                id="fp-confirmar" type={verPass ? "text" : "password"}
                required maxLength={120} autoComplete="new-password"
                value={confirmar} onChange={(e) => setConfirmar(e.target.value)}
                className={`${inputCls} ${confirmar && password !== confirmar ? "border-destructive" : ""}`}
                placeholder="Repite tu contraseña"
              />
              {confirmar && password !== confirmar && (
                <p className="text-xs text-destructive">Las contraseñas no coinciden.</p>
              )}
            </div>

            {error && <ErrorMsg>{error}</ErrorMsg>}

            <button type="submit" className={btnAccent}>
              Cambiar contraseña
            </button>
          </form>
        )}

        {/* ── Paso 3: Éxito ─────────────────────────────────────────────────── */}
        {paso === "exito" && (
          <div className="space-y-5 rounded-xl border border-border bg-card p-8 text-center shadow-[var(--shadow-elegant)]">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-600">
              <MailCheck className="h-7 w-7" />
            </span>
            <h1 className="text-xl font-semibold">¡Contraseña actualizada!</h1>
            <p className="text-sm text-muted-foreground">
              Tu contraseña ha sido cambiada correctamente. Ya puedes iniciar sesión.
            </p>
            <Link
              to="/login"
              className="inline-block w-full rounded-md bg-accent px-4 py-2.5 text-center text-sm font-semibold text-accent-foreground transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Ir al inicio de sesión
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const btnAccent =
  "w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
