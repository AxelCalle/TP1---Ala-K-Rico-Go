/**
 * Página de inicio — Ala K' Rico GO
 *
 * Diseño basado en:
 *  • Teoría del color para comida rápida (naranja-rojo estimula apetito)
 *  • 10 heurísticas de usabilidad de Jakob Nielsen
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { PackageSearch, ClipboardList, Bike, ScanBarcode, ChevronRight } from "lucide-react";
import { LogoIcon } from "../components/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ala K' Rico GO — Alitas a domicilio" },
      {
        name: "description",
        content: "Pide tus alitas favoritas y sigue tu pedido en tiempo real.",
      },
    ],
  }),
  component: PaginaInicio,
});

/* Heurística #1: Visibilidad del estado del sistema —
   el ticker muestra que hay pedidos activos ahora mismo */
const TICKER_ITEMS = [
  "AKA-1042 · Buffalo · 12 min",
  "AKA-1043 · BBQ · En camino",
  "AKA-1041 · Miel y ajo · Entregado ✓",
  "AKA-1044 · Habanero · 8 min",
  "AKA-1045 · Teriyaki · En camino",
];

/* Heurística #6: Reconocimiento sobre recuerdo —
   pasos numerados + íconos explican el flujo sin que el usuario piense */
const PASOS = [
  {
    n: "01",
    icon: ClipboardList,
    titulo: "Admin registra",
    desc: "El administrador crea el pedido: nombre del cliente, dirección y salsa elegida.",
  },
  {
    n: "02",
    icon: Bike,
    titulo: "Repartidor entrega",
    desc: "El repartidor ve solo sus pedidos asignados y actualiza el estado en cada paso.",
  },
  {
    n: "03",
    icon: ScanBarcode,
    titulo: "Cliente rastrea",
    desc: "Con el código de tu recibo seguís el estado en tiempo real desde esta misma pantalla.",
  },
];

export function PaginaInicio() {
  const navigate = useNavigate();
  const [codigo, setCodigo] = useState("");
  /* Heurística #9: Ayuda al usuario a reconocer y recuperarse de errores */
  const [error, setError] = useState("");

  function rastrear(e: FormEvent) {
    e.preventDefault();
    const id = codigo.trim().toUpperCase();
    /* Heurística #5: Prevención de errores — valida antes de navegar */
    if (!id) {
      setError("Ingresá el código de tu pedido. Ejemplo: AKA-1042");
      return;
    }
    if (!/^AKA-\d+$/i.test(id)) {
      setError("El formato es AKA- seguido de números. Ejemplo: AKA-1042");
      return;
    }
    setError("");
    navigate({ to: "/seguimiento/$orderId", params: { orderId: id } });
  }

  return (
    // overflow-x-clip: red de seguridad contra scroll horizontal (no rompe el sticky del header)
    <div className="min-h-dvh overflow-x-clip" style={{ background: "var(--cream)" }}>
      {/* Salto al contenido — accesibilidad de teclado */}
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-sm focus:px-4 focus:py-2.5 focus:text-sm focus:font-bold"
        style={{ background: "var(--flame)", color: "var(--cream)" }}
      >
        Saltar al contenido
      </a>

      {/* ══════════════════════════════════════
          HEADER
          Heurística #4: Consistencia — mismo color de CTA en todo el sitio
          Heurística #3: Control y libertad — logo siempre lleva a inicio
         ══════════════════════════════════════ */}
      <header
        className="safe-top sticky top-0 z-50 border-b"
        style={{
          background: "var(--coal)",
          borderColor: "oklch(1 0 0 / 8%)",
        }}
      >
        {/* Un solo enlace de navegación → no hace falta menú hamburguesa */}
        <nav
          aria-label="Principal"
          className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-3"
        >
          {/* Marca — logo SVG con fondo transparente */}
          <Link
            to="/"
            aria-label="Ala K' Rico GO — inicio"
            className="group flex min-w-0 items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--flame-lt)]"
          >
            <span className="transition group-hover:brightness-110">
              <LogoIcon size={38} />
            </span>
            <span
              className="font-display text-xl"
              style={{ color: "var(--cream)", letterSpacing: "0.03em" }}
            >
              GO
            </span>
          </Link>

          {/* CTA secundario — Heurística #7: flexibilidad para usuarios del equipo */}
          <Link
            to="/login"
            aria-label="Ingresar al panel del equipo"
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-sm px-4 text-sm font-bold uppercase tracking-wide transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cream)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--coal)] active:brightness-95"
            style={{ background: "var(--flame)", color: "var(--cream)" }}
          >
            Panel
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </nav>
      </header>

      <main id="contenido" tabIndex={-1} className="outline-none">
        {/* ══════════════════════════════════════
          HERO
          Color teoría: fondo carbón cálido + CTA naranja-rojo
          Heurística #8: diseño estético minimalista — acción principal al frente
         ══════════════════════════════════════ */}
        <section
          className="relative overflow-hidden"
          style={{ background: "var(--gradient-hero)" }}
        >
          <div className="relative z-10 mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16 md:py-24 lg:py-28">
            {/* Eyebrow — Heurística #2: lenguaje del mundo real */}
            <p
              className="mb-4 text-xs font-bold uppercase tracking-[0.22em]"
              style={{ color: "var(--flame-lt)" }}
            >
              Alitas a domicilio · Lima, Perú
            </p>

            {/* Titular — impacto tipográfico, calor, urgencia */}
            {/* clamp: ~2.75rem a 320px → 7.5rem en desktop; break-words por si hay zoom alto */}
            <h1
              className="font-display leading-[0.88] break-words"
              style={{
                color: "var(--cream)",
                fontSize: "clamp(2.75rem, 9.5vw + 0.5rem, 7.5rem)",
              }}
            >
              CALIENTE
              <br />
              <span style={{ color: "var(--flame)" }}>&amp; RÁPIDO.</span>
            </h1>

            <p
              className="mt-5 max-w-sm text-base leading-relaxed sm:text-lg"
              style={{ color: "var(--smoke)" }}
            >
              Desde la parrilla hasta tu puerta. Usá el código de tu recibo para saber exactamente
              dónde está tu pedido.
            </p>

            {/* ──────────────────────────────────
              FORMULARIO DE RASTREO
              Heurística #1: visibilidad del estado
              Heurística #5: prevención de errores (placeholder + validación)
              Heurística #9: mensajes de error útiles
             ────────────────────────────────── */}
            <div className="mt-6 sm:mt-8 w-full max-w-md">
              <form onSubmit={rastrear} role="search" aria-label="Rastrear pedido" noValidate>
                <label htmlFor="codigo-pedido" className="sr-only">
                  Código de seguimiento del pedido
                </label>
                {/* < 400px: input y botón apilados (botón full-width); desde xs en fila */}
                <div
                  className="flex flex-col items-stretch overflow-hidden rounded-sm min-[400px]:flex-row"
                  style={{
                    border: `2px solid ${error ? "var(--destructive)" : "var(--flame)"}`,
                    boxShadow: error ? "none" : "var(--shadow-flame)",
                  }}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2 px-4">
                    <PackageSearch
                      className="h-4 w-4 shrink-0"
                      style={{ color: "var(--flame-lt)" }}
                      aria-hidden="true"
                    />
                    <input
                      id="codigo-pedido"
                      value={codigo}
                      onChange={(e) => {
                        setCodigo(e.target.value);
                        if (error) setError("");
                      }}
                      /* Heurística #5: el placeholder muestra el formato exacto esperado */
                      placeholder="Ej: AKA-1042"
                      maxLength={20}
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      enterKeyHint="search"
                      aria-invalid={!!error}
                      aria-describedby={error ? "codigo-error" : "codigo-ayuda"}
                      className="min-h-12 w-full min-w-0 py-3 text-sm outline-none"
                      style={{ background: "transparent", color: "var(--cream)" }}
                    />
                  </div>
                  <button
                    type="submit"
                    className="min-h-12 shrink-0 px-5 py-3 text-sm font-bold uppercase tracking-wide transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--cream)] active:brightness-95"
                    style={{ background: "var(--flame)", color: "var(--cream)" }}
                  >
                    Rastrear
                  </button>
                </div>

                {/* Heurística #9: mensaje de error concreto y accionable */}
                {error && (
                  <p
                    id="codigo-error"
                    className="mt-2 flex items-start gap-1.5 text-xs"
                    role="alert"
                    aria-live="assertive"
                    style={{ color: "var(--destructive)" }}
                  >
                    <span aria-hidden="true">↑</span>
                    {error}
                  </p>
                )}
              </form>

              {/* Heurística #10: ayuda contextual discreta */}
              {!error && (
                <p
                  id="codigo-ayuda"
                  className="mt-3 text-xs"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Tu código aparece en el recibo o mensaje de confirmación.
                </p>
              )}
            </div>
          </div>

          {/* Resplandor decorativo — refuerza el calor visual */}
          <div
            className="pointer-events-none absolute -bottom-40 right-0 h-[min(28rem,90vw)] w-[min(28rem,90vw)] rounded-full opacity-10 blur-3xl"
            style={{ background: "var(--flame)" }}
            aria-hidden="true"
          />
        </section>

        {/* ══════════════════════════════════════
          TICKER — Heurística #1: visibilidad del estado
          Muestra que el sistema está activo ahora mismo
         ══════════════════════════════════════ */}
        {/* overflow-hidden recorta la pista; w-max hace que translateX(-50%) mida el
          contenido real (loop sin saltos). Se pausa con prefers-reduced-motion. */}
        <div
          className="overflow-hidden border-y py-2.5"
          style={{ background: "var(--flame)", borderColor: "var(--flame-lt)" }}
          role="region"
          aria-label="Pedidos activos en vivo"
        >
          <div className="flex w-max whitespace-nowrap animate-[ticker_20s_linear_infinite] motion-reduce:animate-none">
            {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
              <span
                key={i}
                // La 2.ª copia solo existe para el loop visual: se oculta a lectores de pantalla
                aria-hidden={i >= TICKER_ITEMS.length || undefined}
                className="mx-6 flex shrink-0 items-center gap-2 text-xs font-bold uppercase tracking-wide"
                style={{ color: "var(--cream)" }}
              >
                <LogoIcon size={16} />
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════
          CÓMO FUNCIONA
          Heurística #6: reconocimiento sobre recuerdo
          Heurística #2: lenguaje del mundo real
         ══════════════════════════════════════ */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-20">
          {/* Encabezado de sección */}
          <div className="mb-8 sm:mb-10 md:flex md:items-end md:justify-between">
            <h2
              className="font-display leading-none"
              style={{
                color: "var(--coal)",
                fontSize: "clamp(2.2rem, 5vw, 4rem)",
              }}
            >
              CÓMO FUNCIONA
            </h2>
            <p
              className="mt-3 max-w-xs text-sm leading-relaxed md:mt-0 md:text-right"
              style={{ color: "var(--muted-foreground)" }}
            >
              Un sistema cerrado: admin gestiona, repartidor entrega, vos rastreás.
            </p>
          </div>

          {/* Pasos — Heurística #4: consistencia en el layout de cada paso */}
          {/* 1 columna en móvil → 3 desde md (con 3 pasos, 2 columnas dejaría uno huérfano) */}
          <div className="grid gap-px md:grid-cols-3" style={{ background: "var(--border)" }}>
            {PASOS.map((paso) => (
              <article
                key={paso.n}
                className="min-w-0 bg-background px-5 py-8 transition-colors hover:bg-card sm:px-8 sm:py-10"
              >
                {/* Número grande como contexto visual — no como texto funcional */}
                <span
                  className="block font-display text-7xl leading-none select-none sm:text-8xl"
                  style={{ color: "var(--flame)", opacity: 0.12 }}
                  aria-hidden="true"
                >
                  {paso.n}
                </span>

                {/* Ícono con fondo carbón — contraste fuerte, reconocible */}
                <div
                  className="mt-3 grid h-11 w-11 place-items-center rounded-sm"
                  style={{ background: "var(--coal)" }}
                >
                  <paso.icon
                    className="h-5 w-5"
                    style={{ color: "var(--flame)" }}
                    aria-hidden="true"
                  />
                </div>

                <h3 className="mt-4 font-display text-2xl" style={{ color: "var(--coal)" }}>
                  {paso.titulo.toUpperCase()}
                </h3>
                <p
                  className="mt-2 text-sm leading-relaxed"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {paso.desc}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════
          CTA FINAL — Heurística #7: flexibilidad y eficiencia de uso
          Los usuarios del equipo tienen acceso rápido desde cualquier parte
         ══════════════════════════════════════ */}
        <section className="py-10 sm:py-14" style={{ background: "var(--coal)" }}>
          <div className="mx-auto max-w-6xl px-4 sm:px-6 md:flex md:items-center md:justify-between">
            <div className="min-w-0">
              <h2
                className="font-display leading-none"
                style={{
                  color: "var(--cream)",
                  fontSize: "clamp(1.8rem, 4vw, 3rem)",
                }}
              >
                ¿SOS DEL EQUIPO?
              </h2>
              {/* Heurística #2: lenguaje del mundo real */}
              <p className="mt-2 text-sm" style={{ color: "var(--smoke)" }}>
                Administradores y repartidores ingresan aquí.
              </p>
            </div>

            {/* Full-width en móvil (target táctil amplio), ancho natural desde sm */}
            <Link
              to="/login"
              className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-sm px-6 py-3.5 text-sm font-bold uppercase tracking-wider transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cream)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--coal)] active:brightness-95 sm:inline-flex sm:w-auto md:mt-0 md:shrink-0"
              style={{ background: "var(--flame)", color: "var(--cream)" }}
            >
              Ingresar al panel
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="safe-bottom border-t" style={{ borderColor: "var(--border)" }}>
        <div
          className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-5 text-xs sm:px-6"
          style={{ color: "var(--muted-foreground)" }}
        >
          <span>© {new Date().getFullYear()} Ala K&apos; Rico GO</span>
          <span className="flex items-center gap-1.5">
            <LogoIcon size={18} />
            Hecho con sabor.
          </span>
        </div>
      </footer>
    </div>
  );
}
