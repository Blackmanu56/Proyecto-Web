import { Toaster } from "sonner";

/**
 * Toast provider styled with Chopper design tokens.
 * Import in layout.tsx or use inline <ChopperToaster /> where needed.
 */
export function ChopperToaster() {
  return (
    <Toaster
      theme="dark"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "bg-panel border border-border text-text shadow-[var(--shadow-lg)] rounded-[var(--radius-lg)]",
          title: "text-text font-semibold",
          description: "text-text-muted",
          actionButton:
            "bg-brand text-white hover:bg-brand-hover rounded-[var(--radius-md)] px-3 py-1.5 text-sm font-medium",
          cancelButton:
            "bg-card text-text-muted border border-border hover:bg-border rounded-[var(--radius-md)] px-3 py-1.5 text-sm font-medium",
          success:
            "border-success/20 bg-panel",
          error:
            "border-danger/20 bg-panel",
          warning:
            "border-warning/20 bg-panel",
          info:
            "border-info/20 bg-panel",
        },
      }}
    />
  );
}
