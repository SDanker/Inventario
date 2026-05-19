import { signOut } from "@/auth";
import { Button } from "./ui/button";

export function Topbar({ userName, userRole, unitName }: { userName: string; userRole: string; unitName?: string | null }) {
  return (
    <header className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-4">
      <div className="text-sm text-slate-600">
        {unitName ? <span className="font-medium text-slate-900">{unitName}</span> : null}
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="text-sm font-medium text-slate-900">{userName}</div>
          <div className="text-xs text-slate-500">{userRole}</div>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <Button variant="ghost" size="sm" type="submit">
            Salir
          </Button>
        </form>
      </div>
    </header>
  );
}
