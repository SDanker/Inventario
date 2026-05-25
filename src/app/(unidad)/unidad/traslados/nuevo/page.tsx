import { redirect } from "next/navigation";
import { getSessionUser } from "@/auth";
import { requestTransfer } from "@/lib/services/transfers.service";
import { listUnits } from "@/lib/services/units.service";
import { listMaterials } from "@/lib/services/catalog.service";
import { prisma } from "@/lib/db";
import { NewTransferForm } from "@/components/forms/new-transfer-form";

export default async function NewUnitTransferPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.unitId) redirect("/forbidden");

  const units = await listUnits(user);
  const materials = await listMaterials(user);

  const assets = await prisma.asset.findMany({
    where: { unitId: user.unitId },
    include: { material: true },
    orderBy: { internalCode: "asc" },
  });

  async function createTransferAction(formData: FormData) {
    "use server";
    const u = await getSessionUser();
    if (!u) redirect("/login");

    const destinationUnitId = formData.get("destinationUnitId") as string;
    const reason = formData.get("reason") as string;

    const itemsJson = formData.get("items_json") as string;
    const items = itemsJson ? JSON.parse(itemsJson) : [];

    await requestTransfer(u, {
      destinationUnitId,
      reason: reason || null,
      items,
    });

    redirect("/unidad/traslados");
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Nuevo traslado</h1>
      <NewTransferForm
        action={createTransferAction}
        units={units}
        materials={materials}
        assets={assets}
        userRole={user.role}
        userUnitId={user.unitId}
        cancelHref="/unidad/traslados"
      />
    </div>
  );
}
