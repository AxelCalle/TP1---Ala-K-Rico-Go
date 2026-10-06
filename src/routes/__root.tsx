import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, useRouter } from "@tanstack/react-router";
import { Drumstick, Home, RefreshCw } from "lucide-react";

function NotFoundComponent() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10 text-center sm:py-12">
      <div className="flex w-full max-w-sm min-w-0 flex-col items-center gap-6">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-accent-foreground">
            <Drumstick className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="font-display text-xl tracking-wide">Ala K' Rico GO</span>
        </div>
        <div>
          {/* 7xl a 320px → 9rem desde sm: el número no desborda en pantallas chicas */}
          <p
            className="font-display text-7xl leading-none tracking-tight text-accent sm:text-[9rem]"
            aria-hidden="true"
          >
            404
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">
            <span className="sr-only">Error 404: </span>Página no encontrada
          </h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Esta página no existe o fue movida. Verifica el enlace o regresa al inicio.
          </p>
        </div>
        <Link
          to="/"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Home className="h-4 w-4" aria-hidden="true" />
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  if (import.meta.env.DEV) console.error(error);
  const router = useRouter();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10 text-center sm:py-12">
      <div className="flex w-full max-w-sm min-w-0 flex-col items-center gap-6">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-accent-foreground">
            <Drumstick className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="font-display text-xl tracking-wide">Ala K' Rico GO</span>
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Algo salió mal</h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            No pudimos cargar esta página. Puedes intentarlo de nuevo o regresar al inicio.
          </p>
        </div>
        <div className="flex w-full flex-col justify-center gap-2 min-[360px]:w-auto min-[360px]:flex-row min-[360px]:flex-wrap">
          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Intentar de nuevo
          </button>
          <a
            href="/"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            Ir al inicio
          </a>
        </div>
      </div>
    </main>
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
