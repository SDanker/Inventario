import { redirect } from "next/navigation";
import { getSessionUser } from "@/auth";
import { prisma } from "@/lib/db";
import { Topbar } from "@/components/topbar";

export default async function OpLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "COMANDANCIA_ADMIN") redirect("/admin");
  if (user.role === "UNIT_MANAGER") redirect("/unidad");
  if (user.role !== "OPERATIONAL") redirect("/forbidden");
  if (!user.unitId) redirect("/forbidden");

  const unit = await prisma.unit.findUnique({ where: { id: user.unitId } });
  return (
    <div className="min-h-screen flex flex-col">
      <Topbar userName={user.name} userRole="Operativo" unitName={unit?.name} />
      <main className="flex-1 p-6 overflow-y-auto">{children}</main>
    </div>
  );
}
