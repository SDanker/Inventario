import { redirect } from "next/navigation";
import { getSessionUser } from "@/auth";
import { getCategory, updateCategory, deactivateCategory } from "@/lib/services/catalog.service";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label, Field } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

async function updateCategoryAction(formData: FormData) {
  "use server";
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const id = String(formData.get("id") ?? "");
  await updateCategory(user, id, {
    name: String(formData.get("name") ?? ""),
    description: (formData.get("description") as string) || null,
    active: formData.get("active") === "on",
  });
  redirect("/admin/categorias");
}

async function deactivateCategoryAction(formData: FormData) {
  "use server";
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const id = String(formData.get("id") ?? "");
  await deactivateCategory(user, id);
  redirect("/admin/categorias");
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditCategoryPage(props: Props) {
  const params = await props.params;
  const user = (await getSessionUser())!;
  const category = await getCategory(user, params.id);

  if (!category) {
    redirect("/admin/categorias");
  }

  return (
    <div className="max-w-xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Editar categoría</h1>
        {!category.active && <Badge tone="neutral">Inactiva</Badge>}
      </div>

      <Card>
        <CardHeader><CardTitle>Datos de la categoría</CardTitle></CardHeader>
        <CardBody>
          <form action={updateCategoryAction}>
            <input type="hidden" name="id" value={category.id} />
            <Field>
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" name="name" required maxLength={100} defaultValue={category.name} />
            </Field>
            <Field>
              <Label htmlFor="description">Descripción</Label>
              <Textarea id="description" name="description" maxLength={500} rows={4} defaultValue={category.description || ""} />
            </Field>
            <Field className="flex items-center gap-2">
              <input type="checkbox" id="active" name="active" defaultChecked={category.active} className="rounded" />
              <Label htmlFor="active" className="mb-0">Activa</Label>
            </Field>
            <div className="flex gap-2 justify-end">
              <a href="/admin/categorias" className="text-sm self-center text-slate-600 hover:underline">Cancelar</a>
              <Button type="submit">Guardar</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {category.active && (
        <Card className="mt-6 border-red-200 bg-red-50">
          <CardHeader><CardTitle className="text-red-900">Zona de peligro</CardTitle></CardHeader>
          <CardBody>
            <p className="text-sm text-red-800 mb-4">
              Desactiva esta categoría si ya no la usas. No podrá ser usada para nuevos materiales, pero los existentes permanecerán intactos.
            </p>
            <form action={deactivateCategoryAction}>
              <input type="hidden" name="id" value={category.id} />
              <Button type="submit" variant="danger">
                Desactivar categoría
              </Button>
            </form>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
