import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/auth";
import { listMaterials } from "@/lib/services/catalog.service";
import { createConsumable } from "@/lib/services/consumables.service";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label, Field } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default async function NewUnitConsumablePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.unitId) redirect("/forbidden");

  const allMaterials = await listMaterials(user);
  const materials = allMaterials.filter((m) => m.materialType === "INSUMO");

  async function createConsumableAction(formData: FormData) {
    "use server";
    const u = await getSessionUser();
    if (!u || !u.unitId) redirect("/login");

    const expirationStr = formData.get("expirationDate") as string | null;
    await createConsumable(u, {
      materialId: formData.get("materialId") as string,
      unitId: u.unitId,
      currentStock: parseFloat(formData.get("currentStock") as string),
      minimumStock: parseFloat((formData.get("minimumStock") as string) || "0"),
      unitOfMeasure: formData.get("unitOfMeasure") as string,
      batchNumber: (formData.get("batchNumber") as string) || null,
      expirationDate: expirationStr ? new Date(expirationStr) : null,
      entryDate: new Date(formData.get("entryDate") as string),
      location: (formData.get("location") as string) || null,
      observations: (formData.get("observations") as string) || null,
    });
    redirect("/unidad/insumos");
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nuevo insumo</h1>
        <Link href="/unidad/insumos" className="text-sm text-slate-600 hover:underline">
          Volver
        </Link>
      </div>

      <Card>
        <CardHeader><CardTitle>Información del insumo</CardTitle></CardHeader>
        <CardBody>
          <form action={createConsumableAction} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label htmlFor="materialId">Material *</Label>
                <Select id="materialId" name="materialId" required>
                  <option value="">Selecciona un material</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} - {m.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field>
                <Label htmlFor="unitOfMeasure">Unidad de medida *</Label>
                <Input
                  id="unitOfMeasure"
                  name="unitOfMeasure"
                  required
                  maxLength={20}
                  placeholder="Ej: L, kg, unidades"
                />
              </Field>

              <Field>
                <Label htmlFor="currentStock">Stock inicial *</Label>
                <Input
                  id="currentStock"
                  name="currentStock"
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  defaultValue="0"
                />
              </Field>

              <Field>
                <Label htmlFor="minimumStock">Stock mínimo</Label>
                <Input
                  id="minimumStock"
                  name="minimumStock"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue="0"
                />
              </Field>

              <Field>
                <Label htmlFor="entryDate">Fecha de ingreso *</Label>
                <Input
                  id="entryDate"
                  name="entryDate"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().split("T")[0]}
                />
              </Field>

              <Field>
                <Label htmlFor="expirationDate">Fecha de vencimiento</Label>
                <Input id="expirationDate" name="expirationDate" type="date" />
              </Field>

              <Field>
                <Label htmlFor="batchNumber">Número de lote</Label>
                <Input id="batchNumber" name="batchNumber" maxLength={50} />
              </Field>

              <Field>
                <Label htmlFor="location">Ubicación</Label>
                <Input id="location" name="location" maxLength={200} />
              </Field>
            </div>

            <Field>
              <Label htmlFor="observations">Observaciones</Label>
              <Textarea id="observations" name="observations" maxLength={2000} rows={3} />
            </Field>

            <div className="flex gap-2 justify-end">
              <Link
                href="/unidad/insumos"
                className="text-sm self-center text-slate-600 hover:underline"
              >
                Cancelar
              </Link>
              <Button type="submit">Crear insumo</Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
