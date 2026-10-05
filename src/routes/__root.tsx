import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router";
import { Drumstick, Home, RefreshCw } from "lucide-react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 text-center">
      <div className="flex flex-col items-center gap-6 max-w-sm">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-accent-foreground">
            <Drumstick className="h-5 w-5" />
          </span>
          <span className="font-display text-xl tracking-wide">Ala K' Rico GO</span>
        </div>
        <div>
          <p className="font-display text-[9rem] leading-none tracking-tight text-accent">404</p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">Página no encontrada</h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Esta página no existe o fue movida. Verifica el enlace o regresa al inicio.
          </p>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Home className="h-4 w-4" />
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  if (import.meta.env.DEV) console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 text-center">
      <div className="flex flex-col items-center gap-6 max-w-sm">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-accent-foreground">
            <Drumstick className="h-5 w-5" />
          </span>
          <span className="font-display text-xl tracking-wide">Ala K' Rico GO</span>
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Algo salió mal</h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            No pudimos cargar esta página. Puedes intentarlo de nuevo o regresar al inicio.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RefreshCw className="h-4 w-4" />
            Intentar de nuevo
          </button>
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Home className="h-4 w-4" />
            Ir al inicio
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
