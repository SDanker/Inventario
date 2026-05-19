import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/auth";
import { getUnit, updateUnit, deactivateUnit } from "@/lib/services/units.service";
import { UnitType } from "@prisma/client";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Label, Field } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default async function EditUnitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await getSessionUser())!;
  const unit = await getUnit(user, id);
  if (!unit) notFound();

  async function updateAction(formData: FormData) {
    "use server";
    const u = (await getSessionUser())!;
    await updateUnit(u, id, {
      code: String(formData.get("code") ?? ""),
      name: String(formData.get("name") ?? ""),
      unitType: formData.get("unitType") as UnitType,
      address: (formData.get("address") as string) || null,
      city: (formData.get("city") as string) || null,
      active: formData.get("active") === "on",
    });
    redirect("/admin/unidades");
  }

  async function deactivateAction() {
    "use server";
    const u = (await getSessionUser())!;
    await deactivateUnit(u, id);
    redirect("/admin/unidades");
  }

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">Editar unidad</h1>
      <Card>
        <CardHeader><CardTitle>{unit.name}</CardTitle></CardHeader>
        <CardBody>
          <form action={updateAction}>
            <Field>
              <Label htmlFor="code">Código</Label>
              <Input id="code" name="code" defaultValue={unit.code} required />
            </Field>
            <Field>
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" name="name" defaultValue={unit.name} required />
            </Field>
            <Field>
              <Label htmlFor="unitType">Tipo</Label>
              <Select id="unitType" name="unitType" defaultValue={unit.unitType}>
                <option value="CUARTEL">Cuartel</option>
                <option value="CAMPO_ENTRENAMIENTO">Campo de entrenamiento</option>
                <option value="BODEGA">Bodega</option>
                <option value="COMANDANCIA">Comandancia</option>
              </Select>
            </Field>
            <Field>
              <Label htmlFor="address">Dirección</Label>
              <Input id="address" name="address" defaultValue={unit.address ?? ""} />
            </Field>
            <Field>
              <Label htmlFor="city">Comuna</Label>
              <Input id="city" name="city" defaultValue={unit.city ?? ""} />
            </Field>
            <Field>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" name="active" defaultChecked={unit.active} />
                Activa
              </label>
            </Field>
            <div className="flex gap-2 justify-end">
              <a href="/admin/unidades" className="text-sm self-center text-slate-600 hover:underline">Cancelar</a>
              <Button type="submit">Guardar</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {unit.active ? (
        <Card>
          <CardHeader><CardTitle>Zona de desactivación</CardTitle></CardHeader>
          <CardBody>
            <form action={deactivateAction}>
              <p className="text-sm text-slate-600 mb-3">
                La unidad dejará de estar disponible para nuevos inventarios. Los registros históricos se conservan.
              </p>
              <Button type="submit" variant="danger">Desactivar unidad</Button>
            </form>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
