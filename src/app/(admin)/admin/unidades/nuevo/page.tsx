import { redirect } from "next/navigation";
import { getSessionUser } from "@/auth";
import { createUnit } from "@/lib/services/units.service";
import { UnitType } from "@prisma/client";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Label, Field } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

async function createUnitAction(formData: FormData) {
  "use server";
  const user = await getSessionUser();
  if (!user) redirect("/login");

  await createUnit(user, {
    code: String(formData.get("code") ?? ""),
    name: String(formData.get("name") ?? ""),
    unitType: formData.get("unitType") as UnitType,
    address: (formData.get("address") as string) || null,
    city: (formData.get("city") as string) || null,
  });
  redirect("/admin/unidades");
}

export default function NewUnitPage() {
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-4">Nueva unidad</h1>
      <Card>
        <CardHeader><CardTitle>Datos de la unidad</CardTitle></CardHeader>
        <CardBody>
          <form action={createUnitAction}>
            <Field>
              <Label htmlFor="code">Código</Label>
              <Input id="code" name="code" required maxLength={20} />
            </Field>
            <Field>
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" name="name" required maxLength={120} />
            </Field>
            <Field>
              <Label htmlFor="unitType">Tipo</Label>
              <Select id="unitType" name="unitType" required defaultValue="CUARTEL">
                <option value="CUARTEL">Cuartel</option>
                <option value="CAMPO_ENTRENAMIENTO">Campo de entrenamiento</option>
                <option value="BODEGA">Bodega</option>
                <option value="COMANDANCIA">Comandancia</option>
              </Select>
            </Field>
            <Field>
              <Label htmlFor="address">Dirección</Label>
              <Input id="address" name="address" maxLength={200} />
            </Field>
            <Field>
              <Label htmlFor="city">Comuna</Label>
              <Input id="city" name="city" maxLength={100} />
            </Field>
            <div className="flex gap-2 justify-end">
              <a href="/admin/unidades" className="text-sm self-center text-slate-600 hover:underline">Cancelar</a>
              <Button type="submit">Crear</Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
