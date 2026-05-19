import * as React from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("block text-sm font-medium text-slate-700 mb-1", className)} {...props} />;
}

export function Field({ children }: { children: React.ReactNode }) {
  return <div className="mb-4">{children}</div>;
}
