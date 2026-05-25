import { redirect } from "next/navigation";
import { getSessionUser } from "@/auth";
import { Sidebar, type NavItem } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { prisma } from "@/lib/db";

const navItems: NavItem[] = [
  { href: "/unidad", label: "Dashboard" },
  { href: "/unidad/activos", label: "Activos" },
  { href: "/unidad/insumos", label: "Insumos" },
  { href: "/unidad/revisiones", label: "Revisiones" },
  { href: "/unidad/movimientos", label: "Movimientos" },
  { href: "/unidad/mantenciones", label: "Mantenciones" },
  { href: "/unidad/traslados", label: "Traslados" },
  { href: "/unidad/documentos", label: "Documentos" },
  { href: "/unidad/alertas", label: "Alertas" },
  { href: "/unidad/reportes", label: "Reportes" },
];

export default async function UnitLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "OPERATIONAL") redirect("/op");
  if (user.role === "COMANDANCIA_ADMIN") redirect("/admin");
  if (user.role !== "UNIT_MANAGER") redirect("/forbidden");
  if (!user.unitId) redirect("/forbidden");

  const unit = await prisma.unit.findUnique({ where: { id: user.unitId } });

  return (
    <div className="min-h-screen flex">
      <Sidebar title={unit?.name ?? "Unidad"} items={navItems} />
      <div className="flex-1 flex flex-col">
        <Topbar userName={user.name} userRole="Encargado de Unidad" unitName={unit?.name ?? null} />
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
