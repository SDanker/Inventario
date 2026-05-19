import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "warning" | "danger" | "success";
}) {
  const tones = {
    default: "border-slate-200",
    warning: "border-amber-300 bg-amber-50",
    danger: "border-red-300 bg-red-50",
    success: "border-green-300 bg-green-50",
  };
  return (
    <div className={cn("rounded-lg border p-4 bg-white", tones[tone])}>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}
