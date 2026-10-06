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
  const [paso, setPaso] = useState<Paso>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [verPass, setVerPass] = useState(false);
  const [error, setError] = useState("");

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
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
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
    // min-h-dvh: en móvil la tarjeta ocupa el ancho completo
    // (menos 16px de gutter) y en sm+ queda centrada con ancho máximo.
    <main className="flex min-h-dvh flex-col items-center justify-start bg-background px-4 py-6 sm:justify-center sm:p-6">
      <div className="w-full max-w-sm min-w-0 space-y-5 sm:space-y-6">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center justify-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LogoIcon size={32} />
          <span className="font-display text-xl tracking-wide">Ala K' Rico GO</span>
        </Link>

        {/* Indicador de pasos — orienta al usuario (paso 3 = confirmación final) */}
        {paso !== "exito" && (
          <ol className="flex items-center justify-center gap-2 text-xs" aria-label="Progreso">
            {(["email", "nueva-clave"] as const).map((p, i) => {
              const activo = paso === p;
              const hecho = paso === "nueva-clave" && p === "email";
              return (
                <li
                  key={p}
                  aria-current={activo ? "step" : undefined}
                  className={`flex items-center gap-1.5 ${activo ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                >
                  <span
                    className={`grid h-6 w-6 place-items-center rounded-full text-[0.7rem] ${
                      activo || hecho
                        ? "bg-accent text-accent-foreground"
                        : "border border-border bg-card"
                    }`}
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  {p === "email" ? "Correo" : "Nueva contraseña"}
                  {i === 0 && <span className="mx-1 h-px w-6 bg-border" aria-hidden="true" />}
                </li>
              );
            })}
          </ol>
        )}

        {/* ── Paso 1: Correo ─────────────────────────────────────────────────── */}
        {paso === "email" && (
          <form
            onSubmit={handleEmailSubmit}
            aria-labelledby="fp-titulo-1"
            className="space-y-5 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-elegant)] sm:p-8"
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-accent/15 text-accent">
                <KeyRound className="h-6 w-6" aria-hidden="true" />
              </span>
              <h1 id="fp-titulo-1" className="text-xl font-semibold text-balance">
                ¿Olvidaste tu contraseña?
              </h1>
              <p className="text-sm text-muted-foreground">
                Ingresa tu correo y te ayudaremos a recuperar el acceso.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="fp-email" className="text-sm font-medium">
                Correo electrónico
              </label>
              <input
                id="fp-email"
                type="email"
                inputMode="email"
                required
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="next"
                aria-invalid={!!error}
                aria-describedby={error ? "fp-error" : undefined}
                maxLength={120}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                placeholder="tu@correo.com"
              />
            </div>

            {error && <ErrorMsg id="fp-error">{error}</ErrorMsg>}

            <button type="submit" className={btnAccent}>
              Continuar
            </button>

            <p className="text-center text-sm text-muted-foreground">
              <Link
                to="/login"
                className="inline-block rounded-sm py-1 text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span aria-hidden="true">← </span>Volver al inicio de sesión
              </Link>
            </p>
          </form>
        )}

        {/* ── Paso 2: Nueva contraseña ───────────────────────────────────────── */}
        {paso === "nueva-clave" && (
          <form
            onSubmit={handlePasswordSubmit}
            aria-labelledby="fp-titulo-2"
            className="space-y-5 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-elegant)] sm:p-8"
          >
            <div className="flex min-w-0 flex-col items-center gap-2 text-center">
              <h1 id="fp-titulo-2" className="text-xl font-semibold">
                Nueva contraseña
              </h1>
              {/* break-all: correos largos no desbordan la tarjeta a 320px */}
              <p className="max-w-full text-sm text-muted-foreground">
                Cuenta: <span className="font-medium break-all text-foreground">{email}</span>
              </p>
            </div>

            {/* Nota de prototipo */}
            <div className="rounded-md bg-muted px-3 py-2.5 text-xs text-muted-foreground">
              <strong>Nota (prototipo):</strong> En producción se enviaría un enlace al correo. Para
              el demo puedes ingresar tu nueva contraseña directamente.
            </div>

            <div className="space-y-1.5">
              <label htmlFor="fp-pass" className="text-sm font-medium">
                Nueva contraseña
              </label>
              <div className="relative">
                <input
                  id="fp-pass"
                  type={verPass ? "text" : "password"}
                  required
                  minLength={8}
                  maxLength={100}
                  autoComplete="new-password"
                  enterKeyHint="next"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-describedby={error ? "fp-error-2" : undefined}
                  className={`${inputCls} pr-11`}
                  placeholder="Mínimo 8 caracteres"
                />
                <TogglePass ver={verPass} toggle={() => setVerPass((v) => !v)} controls="fp-pass" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="fp-confirmar" className="text-sm font-medium">
                Confirmar contraseña
              </label>
              <input
                id="fp-confirmar"
                type={verPass ? "text" : "password"}
                required
                maxLength={100}
                autoComplete="new-password"
                enterKeyHint="done"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                aria-invalid={!!confirmar && password !== confirmar}
                aria-describedby={
                  confirmar && password !== confirmar ? "fp-confirmar-msg" : undefined
                }
                className={inputCls}
                placeholder="Repite tu contraseña"
              />
              {confirmar && password !== confirmar && (
                <p id="fp-confirmar-msg" className="text-xs text-destructive">
                  Las contraseñas no coinciden.
                </p>
              )}
            </div>

            {error && <ErrorMsg id="fp-error-2">{error}</ErrorMsg>}

            <button type="submit" className={btnAccent}>
              Cambiar contraseña
            </button>
          </form>
        )}

        {/* ── Paso 3: Éxito ─────────────────────────────────────────────────── */}
        {paso === "exito" && (
          <div
            role="status"
            className="space-y-5 rounded-xl border border-border bg-card p-5 text-center shadow-[var(--shadow-elegant)] sm:p-8"
          >
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-600">
              <MailCheck className="h-7 w-7" aria-hidden="true" />
            </span>
            <h1 className="text-xl font-semibold">¡Contraseña actualizada!</h1>
            <p className="text-sm text-muted-foreground">
              Tu contraseña ha sido cambiada correctamente. Ya puedes iniciar sesión.
            </p>
            <Link
              to="/login"
              className="flex min-h-11 w-full items-center justify-center rounded-md bg-accent px-4 py-2.5 text-center text-sm font-semibold text-accent-foreground transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Ir al inicio de sesión
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const btnAccent =
  "min-h-11 w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
