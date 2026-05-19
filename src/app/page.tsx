import { redirect } from "next/navigation";
import { getSessionUser } from "@/auth";

export default async function RootPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "COMANDANCIA_ADMIN") redirect("/admin");
  if (user.role === "UNIT_MANAGER") redirect("/unidad");
  redirect("/op");
}
