import { Eye, EyeOff } from "lucide-react";

export const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none ring-ring/30 transition focus:border-ring focus:ring-2";

export function ErrorMsg({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{children}</p>
  );
}

export function TogglePass({ ver, toggle }: { ver: boolean; toggle: () => void }) {
  return (
    <button
      type="button" onClick={toggle} tabIndex={-1}
      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
    >
      {ver ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );
}
