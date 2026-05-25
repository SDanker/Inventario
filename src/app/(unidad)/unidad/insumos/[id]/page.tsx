import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/auth";
import { prisma } from "@/lib/db";
import { recordConsumption } from "@/lib/services/consumables.service";
import { ForbiddenError } from "@/lib/auth/permissions";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Label } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";

export default async function UnitConsumableDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = (await getSessionUser())!;

  const consumable = await prisma.consumableInventory.findUnique({
    where: { id },
    include: {
      material: { include: { category: true } },
      unit: true,
    },
  });
  if (!consumable) notFound();
  if (user.role !== "COMANDANCIA_ADMIN" && consumable.unitId !== user.unitId) {
    throw new ForbiddenError("Insumo de otra unidad");
  }

  async function consumeAction(formData: FormData) {
    "use server";
    const u = (await getSessionUser())!;
    const quantity = parseFloat(formData.get("quantity") as string);
    const reason = (formData.get("reason") as string) || "Consumo";
    await recordConsumption(u, id, quantity, reason);
    redirect(`/unidad/insumos/${id}`);
  }

  const tone =
    consumable.status === "DISPONIBLE"
      ? "success"
      : consumable.status === "VENCIDO" || consumable.status === "AGOTADO"
        ? "danger"
        : "warning";

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{consumable.material.name}</h1>
        <div className="flex items-center gap-2">
          <Badge tone={tone}>{consumable.status}</Badge>
          <Link href="/unidad/insumos" className="text-sm text-slate-600 hover:underline">
            Volver
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Información del insumo</CardTitle></CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-600">Material</p>
              <p className="font-medium">{consumable.material.name}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Categoría</p>
              <p className="font-medium">{consumable.material.category?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Stock actual</p>
              <p className="font-mono font-medium">
                {consumable.currentStock.toString()} {consumable.unitOfMeasure}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Stock mínimo</p>
              <p className="font-mono">
                {consumable.minimumStock.toString()} {consumable.unitOfMeasure}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Lote</p>
              <p className="font-mono">{consumable.batchNumber ?? "—"}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Vencimiento</p>
              <p className="font-medium">{formatDate(consumable.expirationDate)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Fecha de ingreso</p>
              <p className="font-medium">{formatDate(consumable.entryDate)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Ubicación</p>
              <p className="font-medium">{consumable.location || "—"}</p>
            </div>
            {consumable.observations && (
              <div className="col-span-2">
                <p className="text-sm text-slate-600">Observaciones</p>
                <p className="font-medium">{consumable.observations}</p>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {consumable.currentStock.greaterThan(0) && (
        <Card>
          <CardHeader><CardTitle>Registrar consumo / baja</CardTitle></CardHeader>
          <CardBody>
            <form action={consumeAction} className="space-y-4">
              <p className="text-sm text-slate-600">
                Registra una salida de stock. Útil para descontar consumo,
                pérdidas o dar de baja insumos vencidos.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <Label htmlFor="quantity">
                    Cantidad ({consumable.unitOfMeasure}) *
                  </Label>
                  <Input
                    id="quantity"
                    name="quantity"
                    type="number"
                    required
                    min="0.01"
                    max={consumable.currentStock.toString()}
                    step="0.01"
                  />
                </Field>
                <Field>
                  <Label htmlFor="reason">Motivo *</Label>
                  <Input
                    id="reason"
                    name="reason"
                    required
                    maxLength={500}
                    placeholder="Ej: Uso operativo, baja por vencimiento"
                  />
                </Field>
              </div>
              <Field>
                <Label htmlFor="notes">Observaciones</Label>
                <Textarea id="notes" name="notes" maxLength={500} rows={2} />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" variant="danger">
                  Registrar salida
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
