import { redirect } from "next/navigation";
import Link from "next/link";
import { AssetStatus } from "@prisma/client";
import { getSessionUser } from "@/auth";
import { listMaterials } from "@/lib/services/catalog.service";
import { createAsset } from "@/lib/services/assets.service";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label, Field } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

function formErrorParam(error: unknown) {
  const message = error instanceof Error ? error.message : "No se pudo crear el activo.";
  return encodeURIComponent(message.slice(0, 500));
}

export default async function NewUnitAssetPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.unitId) redirect("/forbidden");
  const query = await searchParams;
  const error = query?.error;

  const allMaterials = await listMaterials(user);
  const materials = allMaterials.filter((m) => m.materialType !== "INSUMO");

  async function createAssetAction(formData: FormData) {
    "use server";
    const u = await getSessionUser();
    if (!u || !u.unitId) redirect("/login");

    const yearStr = formData.get("year") as string | null;
    try {
      await createAsset(u, {
        materialId: formData.get("materialId") as string,
        unitId: u.unitId,
        internalCode: formData.get("internalCode") as string,
        serialNumber: (formData.get("serialNumber") as string) || null,
        brand: (formData.get("brand") as string) || null,
        model: (formData.get("model") as string) || null,
        licensePlate: (formData.get("licensePlate") as string) || null,
        year: yearStr ? parseInt(yearStr, 10) : null,
        specificLocation: (formData.get("specificLocation") as string) || null,
        responsibleName: (formData.get("responsibleName") as string) || null,
        entryDate: new Date(formData.get("entryDate") as string),
        observations: (formData.get("observations") as string) || null,
        status: AssetStatus.OPERATIVO,
      });
    } catch (err) {
      redirect(`/unidad/activos/nuevo?error=${formErrorParam(err)}`);
    }
    redirect("/unidad/activos");
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nuevo activo</h1>
        <Link href="/unidad/activos" className="text-sm text-slate-600 hover:underline">
          Volver
        </Link>
      </div>

      <Card>
        <CardHeader><CardTitle>Información del activo</CardTitle></CardHeader>
        <CardBody>
          {error ? (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          <form action={createAssetAction} className="space-y-4">
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
                <Label htmlFor="internalCode">Código interno *</Label>
                <Input
                  id="internalCode"
                  name="internalCode"
                  required
                  maxLength={50}
                  placeholder="Ej: ACT-001"
                />
              </Field>

              <Field>
                <Label htmlFor="serialNumber">Número de serie</Label>
                <Input id="serialNumber" name="serialNumber" maxLength={120} />
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
                <Label htmlFor="brand">Marca</Label>
                <Input id="brand" name="brand" maxLength={100} />
              </Field>

              <Field>
                <Label htmlFor="model">Modelo</Label>
                <Input id="model" name="model" maxLength={100} />
              </Field>

              <Field>
                <Label htmlFor="licensePlate">Patente</Label>
                <Input id="licensePlate" name="licensePlate" maxLength={20} />
              </Field>

              <Field>
                <Label htmlFor="year">Año</Label>
                <Input id="year" name="year" type="number" min="1900" max="2100" />
              </Field>

              <Field>
                <Label htmlFor="specificLocation">Ubicación específica</Label>
                <Input id="specificLocation" name="specificLocation" maxLength={200} />
              </Field>

              <Field>
                <Label htmlFor="responsibleName">Responsable</Label>
                <Input id="responsibleName" name="responsibleName" maxLength={120} />
              </Field>
            </div>

            <Field>
              <Label htmlFor="observations">Observaciones</Label>
              <Textarea id="observations" name="observations" maxLength={2000} rows={3} />
            </Field>

            <div className="flex gap-2 justify-end">
              <Link
                href="/unidad/activos"
                className="text-sm self-center text-slate-600 hover:underline"
              >
                Cancelar
              </Link>
              <Button type="submit">Crear activo</Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
