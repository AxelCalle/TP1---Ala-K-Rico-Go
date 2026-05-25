import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Drumstick, Eye, EyeOff, Loader2, ShieldCheck, Truck, User } from "lucide-react";
import { store } from "@/lib/store";
import { api, ErrorApi, ErrorRed } from "@/lib/api";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Iniciar sesión — Ala K' Rico GO" },
      { name: "description", content: "Accede a Ala K' Rico GO para gestionar o entregar pedidos." },
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
            {modo === "login"
              ? <> Despacha alitas <span className="text-accent">por la ruta más rápida.</span></>
              : <> Únete a <span className="text-accent">Ala K' Rico GO</span> hoy.</>}
          </h2>
          <p className="max-w-sm text-sm text-white/70">
            {modo === "login"
              ? "Inicia sesión para registrar pedidos, entregar o consultar tus pedidos."
              : "Crea tu cuenta como cliente o repartidor y empieza hoy mismo."}
          </p>
        </div>
        {/* Roles disponibles */}
        <div className="space-y-2 text-sm text-white/60">
          <div className="flex items-center gap-2"><User className="h-4 w-4" /> Cliente — historial y seguimiento</div>
          <div className="flex items-center gap-2"><Truck className="h-4 w-4" /> Repartidor — portal de rutas</div>
          <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Administrador — tablero de pedidos</div>
        </div>
      </div>

      {/* Panel del formulario */}
      <div className="flex items-center justify-center bg-background p-6">
        {modo === "login"
          ? <FormLogin onCambiarModo={() => setModo("registro")} />
          : <FormRegistro onCambiarModo={() => setModo("login")} />}
      </div>
    </div>
  );
}

// ─── Formulario Iniciar Sesión ────────────────────────────────────────────────

function FormLogin({ onCambiarModo }: { onCambiarModo: () => void }) {
  const navigate = useNavigate();
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [verPass, setVerPass]     = useState(false);
  const [error, setError]         = useState("");
  const [bloqueado, setBloqueado] = useState(false);
  const [cargando, setCargando]   = useState(false);

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
        to: respuesta.usuario.role === "driver"
          ? "/driver"
          : respuesta.usuario.role === "customer"
          ? "/cliente"
          : "/admin",
      });

    } catch (err) {
      if (err instanceof ErrorApi && err.status === 401) {
        // ── Credenciales incorrectas — registrar intento fallido frontal ─
        store.registrarFallo(email.trim());
        const restantes  = store.remainingAttempts(email.trim());
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
        // ── Sin conexión: modo local (mock store) ─────────────────────────
        const resultado = store.login(email.trim(), password);

        if (resultado.status === "locked") {
          setBloqueado(true);
          const min = Math.ceil((resultado.lockedUntil - Date.now()) / 60_000);
          setError(
            `Cuenta bloqueada por demasiados intentos fallidos. ` +
            `Intenta de nuevo en ${min} minuto${min === 1 ? "" : "s"}.`,
          );
        } else if (resultado.status === "invalid") {
          const restantes = store.remainingAttempts(email.trim());
          if (restantes <= 2 && restantes > 0) {
            setError(
              `Correo o contraseña incorrectos. ` +
              `Te quedan ${restantes} intento${restantes === 1 ? "" : "s"} antes de que la cuenta se bloquee 15 min.`,
            );
          } else {
            setError("Correo o contraseña incorrectos.");
          }
        } else {
          // Mock login ok — limpiamos token API por si había uno viejo
          api.limpiarToken();
          navigate({
            to: resultado.role === "driver"
              ? "/driver"
              : resultado.role === "customer"
              ? "/cliente"
              : "/admin",
          });
        }

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
      className="w-full max-w-sm space-y-5 rounded-xl border border-border bg-card p-8 shadow-[var(--shadow-elegant)]"
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bienvenido</h1>
        <p className="mt-1 text-sm text-muted-foreground">Usa tu correo y contraseña para entrar.</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">Correo electrónico</label>
        <input
          id="email" type="email" autoComplete="email" required maxLength={120}
          value={email} onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
          placeholder="tu@correo.com"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-sm font-medium">Contraseña</label>
          <Link
            to="/forgot-password"
            className="text-xs text-accent-foreground hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <div className="relative">
          <input
            id="password" type={verPass ? "text" : "password"}
            autoComplete="current-password" required maxLength={120}
            value={password} onChange={(e) => setPassword(e.target.value)}
            className={`${inputCls} pr-10`}
            placeholder="••••••••"
          />
          <TogglePass ver={verPass} toggle={() => setVerPass((v) => !v)} />
        </div>
      </div>

      {error && (
        <div className={`rounded-md px-3 py-2 text-sm ${
          bloqueado
            ? "bg-orange-500/10 text-orange-700 dark:text-orange-400"
            : "bg-destructive/10 text-destructive"
        }`}>
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
        <Link to="/" className="hover:text-foreground">← Volver al inicio</Link>
      </p>
    </form>
  );
}

// ─── Formulario Crear Cuenta ──────────────────────────────────────────────────

type Rol = "customer" | "driver";

function FormRegistro({ onCambiarModo }: { onCambiarModo: () => void }) {
  const navigate = useNavigate();
  const [rol, setRol]             = useState<Rol>("customer");
  const [nombre, setNombre]       = useState("");
  const [email, setEmail]         = useState("");
  const [phone, setPhone]         = useState("");
  const [password, setPassword]   = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [verPass, setVerPass]     = useState(false);
  const [error, setError]         = useState("");
  const [cargando, setCargando]   = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (nombre.trim().length < 2) { setError("Ingresa tu nombre completo."); return; }
    if (!email.includes("@"))     { setError("Ingresa un correo electrónico válido."); return; }
    if (password.length < 6)      { setError("La contraseña debe tener al menos 6 caracteres."); return; }
    if (password !== confirmar)   { setError("Las contraseñas no coinciden."); return; }

    setCargando(true);

    try {
      // ── 1. Intentar registro en el backend real ───────────────────────
      await api.registrar({
        nombre:   nombre.trim(),
        email:    email.trim(),
        password,
        telefono: phone.trim() || undefined,
        idRole:   rol === "driver" ? 2 : 3,
      });

      // Registro ok → auto-login en la API
      const respuesta = await api.login(email.trim(), password);
      api.guardarToken(respuesta.token);
      store.setApiSession(respuesta.usuario);
      navigate({ to: rol === "driver" ? "/driver" : "/cliente" });

    } catch (err) {
      if (err instanceof ErrorApi && err.status === 409) {
        setError("Ya existe una cuenta con ese correo.");
      } else if (err instanceof ErrorRed) {
        // ── Sin conexión: modo local (mock store) ─────────────────────
        let resultado: "ok" | "email_taken";
        if (rol === "driver") {
          resultado = store.registerDriver(nombre, email.trim(), password);
        } else {
          resultado = store.registerCustomer(nombre, email.trim(), password, phone);
        }

        if (resultado === "email_taken") {
          setError("Ya existe una cuenta con ese correo.");
          return;
        }

        // Auto-login local
        api.limpiarToken();
        const loginResult = store.login(email.trim(), password);
        const destino = rol === "driver" ? "/driver" : "/cliente";
        if (loginResult.status === "ok") navigate({ to: destino });
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
      className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-8 shadow-[var(--shadow-elegant)]"
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Crear cuenta</h1>
        <p className="mt-1 text-sm text-muted-foreground">Completa tus datos para registrarte.</p>
      </div>

      {/* Selector de rol */}
      <div className="grid grid-cols-2 gap-2">
        <RolBtn
          activo={rol === "customer"}
          onClick={() => setRol("customer")}
          icon={<User className="h-4 w-4" />}
          label="Cliente"
        />
        <RolBtn
          activo={rol === "driver"}
          onClick={() => setRol("driver")}
          icon={<Truck className="h-4 w-4" />}
          label="Repartidor"
        />
      </div>

      {/* Nombre */}
      <div className="space-y-1.5">
        <label htmlFor="reg-nombre" className="text-sm font-medium">
          Nombre completo <Req />
        </label>
        <input
          id="reg-nombre" type="text" autoComplete="name" required maxLength={80}
          value={nombre} onChange={(e) => setNombre(e.target.value)}
          className={inputCls} placeholder="Juan Pérez"
        />
      </div>

      {/* Correo */}
      <div className="space-y-1.5">
        <label htmlFor="reg-email" className="text-sm font-medium">
          Correo electrónico <Req />
        </label>
        <input
          id="reg-email" type="email" autoComplete="email" required maxLength={120}
          value={email} onChange={(e) => setEmail(e.target.value)}
          className={inputCls} placeholder="tu@correo.com"
        />
      </div>

      {/* Teléfono (solo clientes) */}
      {rol === "customer" && (
        <div className="space-y-1.5">
          <label htmlFor="reg-phone" className="text-sm font-medium">
            Teléfono <span className="text-xs text-muted-foreground">(opcional)</span>
          </label>
          <input
            id="reg-phone" type="tel" autoComplete="tel" maxLength={20}
            value={phone} onChange={(e) => setPhone(e.target.value)}
            className={inputCls} placeholder="+51 999 999 999"
          />
        </div>
      )}

      {/* Contraseña */}
      <div className="space-y-1.5">
        <label htmlFor="reg-password" className="text-sm font-medium">Contraseña <Req /></label>
        <div className="relative">
          <input
            id="reg-password" type={verPass ? "text" : "password"}
            autoComplete="new-password" required minLength={6} maxLength={120}
            value={password} onChange={(e) => setPassword(e.target.value)}
            className={`${inputCls} pr-10`} placeholder="Mínimo 6 caracteres"
          />
          <TogglePass ver={verPass} toggle={() => setVerPass((v) => !v)} />
        </div>
      </div>

      {/* Confirmar */}
      <div className="space-y-1.5">
        <label htmlFor="reg-confirmar" className="text-sm font-medium">Confirmar contraseña <Req /></label>
        <input
          id="reg-confirmar" type={verPass ? "text" : "password"}
          autoComplete="new-password" required maxLength={120}
          value={confirmar} onChange={(e) => setConfirmar(e.target.value)}
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
        {cargando ? "Registrando…" : rol === "driver" ? "Registrarme como repartidor" : "Crear cuenta"}
      </button>

      <Divider label="¿Ya tienes cuenta?" />

      <button type="button" onClick={onCambiarModo} className={btnSecondary}>
        Iniciar sesión
      </button>

      <p className="text-center text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">← Volver al inicio</Link>
      </p>
    </form>
  );
}

// ─── Helpers visuales ────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none ring-ring/30 transition focus:border-ring focus:ring-2";
const btnPrimary =
  "w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90";
const btnAccent =
  "w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:brightness-105";
const btnSecondary =
  "w-full rounded-md border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-secondary";

function Req() {
  return <span className="text-destructive">*</span>;
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{children}</p>
  );
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

function TogglePass({ ver, toggle }: { ver: boolean; toggle: () => void }) {
  return (
    <button
      type="button" onClick={toggle} tabIndex={-1}
      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
    >
      {ver ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );
}

function RolBtn({
  activo, onClick, icon, label,
}: { activo: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-semibold transition ${
        activo
          ? "border-accent bg-accent/10 text-accent-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-secondary"
      }`}
    >
      {icon} {label}
    </button>
  );
}
