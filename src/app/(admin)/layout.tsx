import { redirect } from "next/navigation";
import { getSessionUser } from "@/auth";
import { Sidebar, type NavItem } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

const navItems: NavItem[] = [
  { href: "/admin", label: "Dashboard Principal" },
  { href: "/admin/dashboard/inventario", label: "Dashboard Inventario" },
  { href: "/admin/unidades", label: "Unidades" },
  { href: "/admin/usuarios", label: "Usuarios" },
  { href: "/admin/categorias", label: "Categorías" },
  { href: "/admin/materiales", label: "Materiales" },
  { href: "/admin/inventario", label: "Gestión Inventario" },
  { href: "/admin/traslados", label: "Traslados" },
  { href: "/admin/alertas", label: "Alertas" },
  { href: "/admin/reportes", label: "Reportes" },
  { href: "/admin/auditoria", label: "Auditoría" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "COMANDANCIA_ADMIN") redirect("/forbidden");

  return (
    <div className="min-h-screen flex">
      <Sidebar title="Comandancia" items={navItems} />
      <div className="flex-1 flex flex-col">
        <Topbar userName={user.name} userRole="Administrador Comandancia" />
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
