import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { Loader2 } from "lucide-react";
import { LogoIcon } from "../components/Logo";
import { store } from "@/lib/store";
import { api, ErrorApi, ErrorRed } from "@/lib/api";
import { inputCls, ErrorMsg, TogglePass } from "@/components/FormBits";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Iniciar sesión — Ala K' Rico GO" },
      {
        name: "description",
        content: "Accede a Ala K' Rico GO para gestionar o entregar pedidos.",
      },
    ],
  }),
  component: LoginPage,
});

// ─── Página ───────────────────────────────────────────────────────────────────

function LoginPage() {
  const [modo, setModo] = useState<"login" | "registro">("login");

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      {/* Panel lateral decorativo */}
      <div className="login-panel relative hidden overflow-hidden flex-col justify-between p-10 text-white md:flex">
        {/* Watermark diagonal */}
        <div className="login-watermark" aria-hidden="true">
          ALITAS
        </div>

        {/* Brasas flotantes */}
        {[
          { l: "12%", b: "8%", s: "5px", dur: "3.0s", delay: "0s" },
          { l: "22%", b: "6%", s: "3px", dur: "3.8s", delay: "0.6s" },
          { l: "35%", b: "10%", s: "6px", dur: "2.8s", delay: "1.1s" },
          { l: "48%", b: "5%", s: "4px", dur: "4.0s", delay: "0.3s" },
          { l: "60%", b: "9%", s: "3px", dur: "3.3s", delay: "1.5s" },
          { l: "72%", b: "7%", s: "5px", dur: "2.6s", delay: "0.8s" },
          { l: "83%", b: "4%", s: "4px", dur: "3.6s", delay: "0.2s" },
          { l: "28%", b: "15%", s: "3px", dur: "4.2s", delay: "1.8s" },
          { l: "55%", b: "13%", s: "4px", dur: "3.1s", delay: "2.2s" },
        ].map((e, i) => (
          <span
            key={i}
            className="ember absolute"
            aria-hidden="true"
            style={{
              left: e.l,
              bottom: e.b,
              width: e.s,
              height: e.s,
              ["--dur" as string]: e.dur,
              ["--delay" as string]: e.delay,
            }}
          />
        ))}

        {/* Logo — top */}
        <Link to="/" className="relative z-10 flex items-center gap-2.5">
          <LogoIcon size={38} />
          <span
            className="font-display text-2xl"
            style={{ color: "var(--amber)", letterSpacing: "0.08em" }}
          >
            GO
          </span>
        </Link>

        {/* Headline editorial — bottom */}
        <div className="relative z-10 space-y-4">
          <p
            className="text-xs font-bold uppercase tracking-[0.25em]"
            style={{ color: "var(--amber)" }}
          >
            Delivery de alitas ·
          </p>

          <h2 className="text-5xl font-bold leading-[1.05] tracking-tight text-white">
            {modo === "login" ? (
              <>
                Caliente.
                <br />
                <span style={{ color: "var(--flame-lt)" }}>En tu puerta.</span>
              </>
            ) : (
              <>
                Únete
                <br />
                <span style={{ color: "var(--flame-lt)" }}>al sabor.</span>
              </>
            )}
          </h2>

          <p className="max-w-88 text-sm leading-relaxed text-white/55">
            {modo === "login"
              ? "La ruta más rápida desde la parrilla hasta tu casa."
              : "Crea tu cuenta y rastrea tus alitas en tiempo real."}
          </p>
        </div>

        {/* Footer */}
        <p className="relative z-10 text-xs text-white/30"></p>
      </div>

      {/* Panel del formulario */}
      <div className="flex flex-col items-center justify-center gap-5 bg-background p-6">
        {/* Branding — solo visible en mobile (el panel decorativo lo oculta en md+) */}
        <Link to="/" className="flex items-center gap-2 md:hidden">
          <LogoIcon size={28} />
          <span className="font-display text-lg tracking-wide">Ala K' Rico GO</span>
        </Link>
        {modo === "login" ? (
          <FormLogin onCambiarModo={() => setModo("registro")} />
        ) : (
          <FormRegistro onCambiarModo={() => setModo("login")} />
        )}
      </div>
    </div>
  );
}

// ─── Formulario Iniciar Sesión ────────────────────────────────────────────────

function FormLogin({ onCambiarModo }: { onCambiarModo: () => void }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verPass, setVerPass] = useState(false);
  const [error, setError] = useState("");
  const [bloqueado, setBloqueado] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBloqueado(false);

    if (!email.includes("@") || password.length < 4) {
      setError("Ingresa un correo válido y una contraseña de 4 o más caracteres.");
      return;
    }

    // ── 1. Verificar bloqueo frontal antes de intentar ────────────────────
    const lockedUntil = store.getBloqueo(email.trim());
    if (lockedUntil) {
      setBloqueado(true);
      const min = Math.ceil((lockedUntil - Date.now()) / 60_000);
      setError(
        `Cuenta bloqueada por demasiados intentos fallidos. ` +
          `Intenta de nuevo en ${min} minuto${min === 1 ? "" : "s"}.`,
      );
      return;
    }

    setCargando(true);

    try {
      // ── 2. Intentar autenticación con el backend real ─────────────────
      const respuesta = await api.login(email.trim(), password);

      // Éxito: guardar token y sincronizar sesión en el store local
      api.guardarToken(respuesta.token);
      store.setApiSession(respuesta.usuario);

      navigate({
        to:
          respuesta.usuario.role === "driver"
            ? "/driver"
            : respuesta.usuario.role === "customer"
              ? "/cliente"
              : "/admin",
      });
    } catch (err) {
      if (err instanceof ErrorApi && err.status === 401) {
        // ── Credenciales incorrectas — registrar intento fallido frontal ─
        store.registrarFallo(email.trim());
        const restantes = store.remainingAttempts(email.trim());
        const nuevoBloqueo = store.getBloqueo(email.trim());
        if (nuevoBloqueo) {
          setBloqueado(true);
          const min = Math.ceil((nuevoBloqueo - Date.now()) / 60_000);
          setError(
            `Cuenta bloqueada por demasiados intentos fallidos. ` +
              `Intenta de nuevo en ${min} minuto${min === 1 ? "" : "s"}.`,
          );
        } else if (restantes <= 2 && restantes > 0) {
          setError(
            `Correo o contraseña incorrectos. ` +
              `Te quedan ${restantes} intento${restantes === 1 ? "" : "s"} antes de que la cuenta se bloquee 15 min.`,
          );
        } else {
          setError("Correo o contraseña incorrectos.");
        }
      } else if (err instanceof ErrorRed) {
        // ── Sin conexión al servidor ───────────────────────────────────────
        // Admin y repartidores requieren backend — sus credenciales están
        // hasheadas en la base de datos y no pueden verificarse offline.
        setError("Sin conexión con el servidor. Verificá tu conexión e intentá de nuevo.");
      } else {
        // ── Error inesperado del servidor ──────────────────────────────────
        setError("Error del servidor. Intenta de nuevo en un momento.");
      }
    } finally {
      setCargando(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm space-y-5 rounded-xl border border-border bg-card p-8 shadow-(--shadow-elegant)"
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bienvenido</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Usa tu correo y contraseña para entrar.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          Correo electrónico
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          maxLength={120}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
          placeholder="tu@correo.com"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-sm font-medium">
            Contraseña
          </label>
          <Link
            to="/forgot-password"
            className="text-xs text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <div className="relative">
          <input
            id="password"
            type={verPass ? "text" : "password"}
            autoComplete="current-password"
            required
            maxLength={120}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputCls} pr-10`}
            placeholder="••••••••"
          />
          <TogglePass ver={verPass} toggle={() => setVerPass((v) => !v)} />
        </div>
      </div>

      {error && (
        <div
          className={`rounded-md px-3 py-2 text-sm ${
            bloqueado
              ? "bg-orange-500/10 text-orange-700 dark:text-orange-400"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {bloqueado && <span className="mr-1.5">🔒</span>}
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={bloqueado || cargando}
        className={`${btnPrimary} inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {cargando && <Loader2 className="h-4 w-4 animate-spin" />}
        {cargando ? "Verificando…" : "Iniciar sesión"}
      </button>

      <Divider label="¿Nuevo aquí?" />

      <button type="button" onClick={onCambiarModo} className={btnSecondary}>
        Crear cuenta
      </button>

      <p className="text-center text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          ← Volver al inicio
        </Link>
      </p>
    </form>
  );
}

// ─── Formulario Crear Cuenta (solo clientes) ─────────────────────────────────

function FormRegistro({ onCambiarModo }: { onCambiarModo: () => void }) {
  const navigate = useNavigate();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [verPass, setVerPass] = useState(false);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (nombre.trim().length < 2) {
      setError("Ingresa tu nombre completo.");
      return;
    }
    if (!email.includes("@")) {
      setError("Ingresa un correo electrónico válido.");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setCargando(true);

    try {
      // ── 1. Intentar registro en el backend real ───────────────────────
      await api.registrar({
        nombre: nombre.trim(),
        email: email.trim(),
        password,
        telefono: phone.trim() || undefined,
        idRole: 3, // siempre cliente
      });

      // Registro ok → auto-login en la API
      const respuesta = await api.login(email.trim(), password);
      api.guardarToken(respuesta.token);
      store.setApiSession(respuesta.usuario);
      navigate({ to: "/cliente" });
    } catch (err) {
      if (err instanceof ErrorApi && err.status === 409) {
        setError("Ya existe una cuenta con ese correo.");
      } else if (err instanceof ErrorRed) {
        // ── Sin conexión: modo local (mock store) ─────────────────────
        const resultado = store.registerCustomer(nombre.trim(), email.trim(), password, phone);
        if (resultado === "email_taken") {
          setError("Ya existe una cuenta con ese correo.");
          return;
        }
        // Auto-login local
        api.limpiarToken();
        const loginResult = store.login(email.trim(), password);
        if (loginResult.status === "ok") navigate({ to: "/cliente" });
      } else {
        setError("Error del servidor. Intenta de nuevo en un momento.");
      }
    } finally {
      setCargando(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-8 shadow-(--shadow-elegant)"
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Crear cuenta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Regístrate para hacer pedidos y rastrear tus alitas.
        </p>
      </div>

      {/* Nombre */}
      <div className="space-y-1.5">
        <label htmlFor="reg-nombre" className="text-sm font-medium">
          Nombre completo <Req />
        </label>
        <input
          id="reg-nombre"
          type="text"
          autoComplete="name"
          required
          maxLength={80}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className={inputCls}
          placeholder="Juan Pérez"
        />
      </div>

      {/* Correo */}
      <div className="space-y-1.5">
        <label htmlFor="reg-email" className="text-sm font-medium">
          Correo electrónico <Req />
        </label>
        <input
          id="reg-email"
          type="email"
          autoComplete="email"
          required
          maxLength={120}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
          placeholder="tu@correo.com"
        />
      </div>

      {/* Teléfono */}
      <div className="space-y-1.5">
        <label htmlFor="reg-phone" className="text-sm font-medium">
          Teléfono <span className="text-xs text-muted-foreground">(opcional)</span>
        </label>
        <input
          id="reg-phone"
          type="tel"
          autoComplete="tel"
          maxLength={20}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={inputCls}
          placeholder="+51 999 999 999"
        />
      </div>

      {/* Contraseña */}
      <div className="space-y-1.5">
        <label htmlFor="reg-password" className="text-sm font-medium">
          Contraseña <Req />
        </label>
        <div className="relative">
          <input
            id="reg-password"
            type={verPass ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={6}
            maxLength={120}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputCls} pr-10`}
            placeholder="Mínimo 6 caracteres"
          />
          <TogglePass ver={verPass} toggle={() => setVerPass((v) => !v)} />
        </div>
      </div>

      {/* Confirmar contraseña */}
      <div className="space-y-1.5">
        <label htmlFor="reg-confirmar" className="text-sm font-medium">
          Confirmar contraseña <Req />
        </label>
        <input
          id="reg-confirmar"
          type={verPass ? "text" : "password"}
          autoComplete="new-password"
          required
          maxLength={120}
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
          className={`${inputCls} ${confirmar && password !== confirmar ? "border-destructive" : ""}`}
          placeholder="Repite tu contraseña"
        />
        {confirmar && password !== confirmar && (
          <p className="text-xs text-destructive">Las contraseñas no coinciden.</p>
        )}
      </div>

      {error && <ErrorMsg>{error}</ErrorMsg>}

      <button
        type="submit"
        disabled={cargando}
        className={`${btnAccent} inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {cargando && <Loader2 className="h-4 w-4 animate-spin" />}
        {cargando ? "Creando cuenta…" : "Crear cuenta"}
      </button>

      <Divider label="¿Ya tienes cuenta?" />

      <button type="button" onClick={onCambiarModo} className={btnSecondary}>
        Iniciar sesión
      </button>

      <p className="text-center text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          ← Volver al inicio
        </Link>
      </p>
    </form>
  );
}

// ─── Helpers visuales ────────────────────────────────────────────────────────

const btnPrimary =
  "w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90";
const btnAccent =
  "w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:brightness-105";
const btnSecondary =
  "w-full rounded-md border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-secondary";

function Req() {
  return <span className="text-destructive">*</span>;
}

function Divider({ label }: { label: string }) {
  return (
    <div className="relative flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
