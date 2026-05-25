"use client";

import { useFormStatus } from "react-dom";

type Props = {
  label?: string;
};

export function FormProgress({ label = "Procesando..." }: Props) {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <div className="space-y-2" role="status" aria-live="polite">
      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>{label}</span>
        <span className="text-xs text-slate-500">No cierres esta pestaña</span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="indeterminate-bar rounded-full" />
      </div>
    </div>
  );
}
