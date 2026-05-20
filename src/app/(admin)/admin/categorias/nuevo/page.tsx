import { redirect } from "next/navigation";
import { getSessionUser } from "@/auth";
import { createCategory } from "@/lib/services/catalog.service";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label, Field } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

async function createCategoryAction(formData: FormData) {
  "use server";
  const user = await getSessionUser();
  if (!user) redirect("/login");

  await createCategory(user, {
    name: String(formData.get("name") ?? ""),
    description: (formData.get("description") as string) || null,
  });
  redirect("/admin/categorias");
}

export default function NewCategoryPage() {
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-4">Nueva categoría</h1>
      <Card>
        <CardHeader><CardTitle>Datos de la categoría</CardTitle></CardHeader>
        <CardBody>
          <form action={createCategoryAction}>
            <Field>
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" name="name" required maxLength={100} />
            </Field>
            <Field>
              <Label htmlFor="description">Descripción</Label>
              <Textarea id="description" name="description" maxLength={500} rows={4} />
            </Field>
            <div className="flex gap-2 justify-end">
              <a href="/admin/categorias" className="text-sm self-center text-slate-600 hover:underline">Cancelar</a>
              <Button type="submit">Crear</Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
