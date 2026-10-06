import { Eye, EyeOff } from "lucide-react";

// h-11 = 44px: target táctil cómodo en móvil. El font-size 16px en <640px lo
// aplica styles.css (evita el zoom automático de iOS al enfocar).
export const inputCls =
  "h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring/30 transition focus:border-ring focus:ring-2 aria-[invalid=true]:border-destructive";

/** Mensaje de error de formulario — anunciado por lectores de pantalla. */
export function ErrorMsg({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <p
      id={id}
      role="alert"
      aria-live="assertive"
      className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {children}
    </p>
  );
}

/**
 * Botón mostrar/ocultar contraseña. Se posiciona dentro de un contenedor
 * `relative` junto a un input con `pr-11`. Ocupa toda la altura del input
 * (44×44) para que sea fácil de tocar y es accesible por teclado.
 */
export function TogglePass({
  ver,
  toggle,
  controls,
}: {
  ver: boolean;
  toggle: () => void;
  /** id del input que controla (opcional). */
  controls?: string;
}) {
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"}
      aria-pressed={ver}
      aria-controls={controls}
      className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-md text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {ver ? (
        <EyeOff className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Eye className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}
