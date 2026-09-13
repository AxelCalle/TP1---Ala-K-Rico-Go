/**
 * Página de inicio — Ala K' Rico GO
 *
 * Diseño basado en:
 *  • Teoría del color para comida rápida (naranja-rojo estimula apetito)
 *  • 10 heurísticas de usabilidad de Jakob Nielsen
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  PackageSearch,
  ClipboardList,
  Bike,
  ScanBarcode,
  ChevronRight,
} from "lucide-react";
import { LogoIcon } from "../components/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ala K' Rico GO — Alitas a domicilio" },
      {
        name: "description",
        content:
          "Pide tus alitas favoritas y sigue tu pedido en tiempo real.",
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
    <div className="min-h-screen" style={{ background: "var(--cream)" }}>

      {/* ══════════════════════════════════════
          HEADER
          Heurística #4: Consistencia — mismo color de CTA en todo el sitio
          Heurística #3: Control y libertad — logo siempre lleva a inicio
         ══════════════════════════════════════ */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{
          background: "var(--coal)",
          borderColor: "oklch(1 0 0 / 8%)",
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-3">
          {/* Marca — logo SVG con fondo transparente */}
          <Link to="/" className="flex items-center gap-3 group">
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
            className="inline-flex items-center gap-1.5 rounded-sm px-3 py-2 text-sm font-bold uppercase tracking-wide transition hover:brightness-110 active:brightness-95"
            style={{ background: "var(--flame)", color: "var(--cream)" }}
          >
            Panel
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* ══════════════════════════════════════
          HERO
          Color teoría: fondo carbón cálido + CTA naranja-rojo
          Heurística #8: diseño estético minimalista — acción principal al frente
         ══════════════════════════════════════ */}
      <section
        className="relative overflow-hidden"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-16 md:py-24 lg:py-28">

          {/* Eyebrow — Heurística #2: lenguaje del mundo real */}
          <p
            className="mb-4 text-xs font-bold uppercase tracking-[0.22em]"
            style={{ color: "var(--flame-lt)" }}
          >
            Alitas a domicilio · Lima, Perú
          </p>

          {/* Titular — impacto tipográfico, calor, urgencia */}
          <h1
            className="font-display leading-[0.88]"
            style={{
              color: "var(--cream)",
              fontSize: "clamp(3.2rem, 9.5vw, 7.5rem)",
            }}
          >
            CALIENTE
            <br />
            <span style={{ color: "var(--flame)" }}>&amp; RÁPIDO.</span>
          </h1>

          <p
            className="mt-5 max-w-sm text-base leading-relaxed"
            style={{ color: "var(--smoke)" }}
          >
            Desde la parrilla hasta tu puerta. Usá el código de tu recibo para
            saber exactamente dónde está tu pedido.
          </p>

          {/* ──────────────────────────────────
              FORMULARIO DE RASTREO
              Heurística #1: visibilidad del estado
              Heurística #5: prevención de errores (placeholder + validación)
              Heurística #9: mensajes de error útiles
             ────────────────────────────────── */}
          <div className="mt-6 sm:mt-8 w-full max-w-md">
            <form onSubmit={rastrear}>
              <div
                className="flex items-stretch overflow-hidden rounded-sm"
                style={{
                  border: `2px solid ${error ? "var(--destructive)" : "var(--flame)"}`,
                  boxShadow: error ? "none" : "var(--shadow-flame)",
                }}
              >
                <div className="flex flex-1 items-center gap-2 px-4">
                  <PackageSearch
                    className="h-4 w-4 shrink-0"
                    style={{ color: "var(--flame-lt)" }}
                  />
                  <input
                    value={codigo}
                    onChange={(e) => {
                      setCodigo(e.target.value);
                      if (error) setError("");
                    }}
                    /* Heurística #5: el placeholder muestra el formato exacto esperado */
                    placeholder="Ej: AKA-1042"
                    maxLength={20}
                    aria-label="Código de seguimiento del pedido"
                    className="w-full py-3.5 text-sm outline-none"
                    style={{ background: "transparent", color: "var(--cream)" }}
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-3.5 text-sm font-bold uppercase tracking-wide transition hover:brightness-110 active:brightness-95"
                  style={{ background: "var(--flame)", color: "var(--cream)" }}
                >
                  Rastrear
                </button>
              </div>

              {/* Heurística #9: mensaje de error concreto y accionable */}
              {error && (
                <p
                  className="mt-2 flex items-center gap-1.5 text-xs"
                  role="alert"
                  style={{ color: "var(--destructive)" }}
                >
                  <span>↑</span>
                  {error}
                </p>
              )}
            </form>

            {/* Heurística #10: ayuda contextual discreta */}
            {!error && (
              <p className="mt-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
                Tu código aparece en el recibo o mensaje de confirmación.
              </p>
            )}
          </div>
        </div>

        {/* Resplandor decorativo — refuerza el calor visual */}
        <div
          className="pointer-events-none absolute -bottom-40 right-0 h-[28rem] w-[28rem] rounded-full opacity-10 blur-3xl"
          style={{ background: "var(--flame)" }}
          aria-hidden="true"
        />
      </section>

      {/* ══════════════════════════════════════
          TICKER — Heurística #1: visibilidad del estado
          Muestra que el sistema está activo ahora mismo
         ══════════════════════════════════════ */}
      <div
        className="overflow-hidden border-y py-2.5"
        style={{ background: "var(--flame)", borderColor: "var(--flame-lt)" }}
        aria-label="Pedidos activos en vivo"
      >
        <div
          className="flex whitespace-nowrap"
          style={{ animation: "ticker 20s linear infinite" }}
        >
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span
              key={i}
              className="mx-6 flex items-center gap-2 text-xs font-bold uppercase tracking-wide"
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
        <div className="grid gap-px md:grid-cols-3" style={{ background: "var(--border)" }}>
          {PASOS.map((paso) => (
            <article
              key={paso.n}
              className="bg-background px-5 py-8 sm:px-8 sm:py-10 transition-colors hover:bg-card"
            >
              {/* Número grande como contexto visual — no como texto funcional */}
              <span
                className="font-display text-8xl leading-none select-none"
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

              <h3
                className="mt-4 font-display text-2xl"
                style={{ color: "var(--coal)" }}
              >
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
      <section
        className="py-10 sm:py-14"
        style={{ background: "var(--coal)" }}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 md:flex md:items-center md:justify-between">
          <div>
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

          <Link
            to="/login"
            className="mt-6 inline-flex items-center gap-2 rounded-sm px-6 py-3.5 text-sm font-bold uppercase tracking-wider transition hover:brightness-110 active:brightness-95 md:mt-0"
            style={{ background: "var(--flame)", color: "var(--cream)" }}
          >
            Ingresar al panel
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer
        className="border-t"
        style={{ borderColor: "var(--border)" }}
      >
        <div
          className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-5 text-xs"
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
