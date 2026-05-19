"use server";

import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/auth";
import { listCategories, createMaterial, addMaterialImage, addMaterialSerialNumber, assignMaterialToUnit, generateMaterialCode } from "@/lib/services/catalog.service";
import { getStorage } from "@/lib/storage";
import { prisma } from "@/lib/db";
import { MaterialType } from "@prisma/client";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Label } from "@/components/ui/label";
import { Input, Textarea, Select } from "@/components/ui/input";

async function createMaterialAction(formData: FormData) {
  "use server";
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const name = formData.get("name") as string;
  const brand = formData.get("brand") as string;
  const model = formData.get("model") as string | null;
  const partNumber = formData.get("partNumber") as string | null;
  const categoryId = formData.get("categoryId") as string;
  const materialType = formData.get("materialType") as MaterialType;
  const description = formData.get("description") as string;
  const imageFile = formData.get("image") as File | null;
  const serialNumber = formData.get("serialNumber") as string | null;
  const assignUnitId = formData.get("assignUnitId") as string | null;
  const assignQuantity = formData.get("assignQuantity") as string | null;

  const created = await createMaterial(user, { name, brand, model: model || null, partNumber: partNumber || null, categoryId, materialType, description: description || null });

  // Agregar imagen si se proporciona
  if (imageFile && imageFile.size > 0) {
    try {
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      const storage = getStorage();
      const saved = await storage.save({
        buffer,
        originalName: imageFile.name,
        mimeType: imageFile.type,
      });
      await addMaterialImage(user, {
        materialId: created.id,
        fileUrl: `/storage/uploads/${saved.path}`,
        order: 0,
      });
    } catch (err) {
      console.error("Error al guardar imagen:", err);
    }
  }

  // Agregar número de serie si se proporciona
  if (serialNumber && serialNumber.trim()) {
    try {
      await addMaterialSerialNumber(user, {
        materialId: created.id,
        serialNumber: serialNumber.trim(),
      });
    } catch (err) {
      console.error("Error al guardar número de serie:", err);
    }
  }

  // Asignar a unidad con cantidad si se proporciona
  if (assignUnitId && assignQuantity) {
    try {
      const quantity = parseInt(assignQuantity, 10);
      if (quantity > 0) {
        await assignMaterialToUnit(user, {
          materialId: created.id,
          unitId: assignUnitId,
          quantity,
        });
      }
    } catch (err) {
      console.error("Error al asignar a unidad:", err);
    }
  }

  redirect(`/admin/materiales/${created.id}`);
}

export default async function NewMaterialPage() {
  const user = (await getSessionUser())!;
  const categories = await listCategories(user);

  // Obtener unidades (admin ve todas, encargado solo ve su unidad)
  const isAdmin = user.role === "COMANDANCIA_ADMIN";
  const isUnitManager = user.role === "UNIT_MANAGER";
  const isOperational = user.role === "OPERATIONAL";

  const units = await prisma.unit.findMany({
    where: isAdmin ? { active: true } : { id: user.unitId || "", active: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  // OPERATIONAL no puede crear materiales
  if (isOperational) {
    return (
      <div className="space-y-4 max-w-xl">
        <div>
          <h1 className="text-2xl font-bold">Crear Material</h1>
        </div>
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">
          <p>No tienes permiso para crear materiales. Solo administradores y encargados de unidad pueden crear.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Crear Material</h1>
        <p className="text-sm text-slate-500">Registra un nuevo material en el catálogo</p>
      </div>

      <form action={createMaterialAction} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Información Básica</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <Field>
              <Label htmlFor="name">Nombre *</Label>
              <Input id="name" name="name" type="text" maxLength={200} placeholder="Ej: Manguera de 2.5 pulgadas" required />
            </Field>

            <Field>
              <Label htmlFor="brand">Marca *</Label>
              <Input id="brand" name="brand" type="text" maxLength={100} placeholder="Ej: Draeger, Scott, Rosenbauer" required />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label htmlFor="model">Modelo</Label>
                <Input id="model" name="model" type="text" maxLength={100} placeholder="Ej: FR-3200" />
              </Field>

              <Field>
                <Label htmlFor="partNumber">Número de Parte</Label>
                <Input id="partNumber" name="partNumber" type="text" maxLength={50} placeholder="Ej: ART-123456" />
              </Field>
            </div>

            <Field>
              <Label htmlFor="categoryId">Categoría *</Label>
              <Select id="categoryId" name="categoryId" required>
                <option value="">Selecciona una categoría</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </Select>
            </Field>

            <Field>
              <Label htmlFor="materialType">Tipo de Material *</Label>
              <Select id="materialType" name="materialType" required>
                <option value="">Selecciona un tipo</option>
                <option value="MATERIAL_MAYOR">Material Mayor</option>
                <option value="MATERIAL_MENOR">Material Menor</option>
                <option value="EPP">EPP</option>
                <option value="EQUIPO_OPERATIVO">Equipo Operativo</option>
                <option value="INSUMO">Insumo</option>
              </Select>
              <p className="text-xs text-slate-500 mt-1">El código se generará automáticamente según la categoría y tipo</p>
            </Field>

            <Field>
              <Label htmlFor="description">Descripción</Label>
              <Textarea id="description" name="description" maxLength={1000} placeholder="Descripción adicional del material..." />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Datos Adicionales (Opcionales)</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <Field>
              <Label htmlFor="image">Imagen del Material</Label>
              <Input id="image" name="image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
              <p className="text-xs text-slate-500 mt-1">Formatos: JPEG, PNG, WebP, GIF (máx 5MB)</p>
            </Field>

            <Field>
              <Label htmlFor="serialNumber">Número de Serie</Label>
              <Input id="serialNumber" name="serialNumber" type="text" maxLength={100} placeholder="Ej: SN123456789" />
              <p className="text-xs text-slate-500 mt-1">Primer número de serie del material (opcional)</p>
            </Field>
          </CardBody>
        </Card>

        {units.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Asignación a Unidad (Opcional)</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              {isUnitManager ? (
                <>
                  <Field>
                    <Label htmlFor="assignUnitId">Tu Unidad</Label>
                    <Input
                      type="text"
                      defaultValue={units[0]?.name || ""}
                      disabled
                    />
                    <p className="text-xs text-slate-500 mt-1">Como encargado, solo puedes asignar a tu unidad</p>
                  </Field>
                  <input type="hidden" name="assignUnitId" value={units[0]?.id || ""} />
                </>
              ) : (
                <Field>
                  <Label htmlFor="assignUnitId">Unidad</Label>
                  <Select id="assignUnitId" name="assignUnitId">
                    <option value="">No asignar ahora</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>{unit.name} ({unit.code})</option>
                    ))}
                  </Select>
                  <p className="text-xs text-slate-500 mt-1">Si asignas a una unidad, debes especificar una cantidad</p>
                </Field>
              )}

              <Field>
                <Label htmlFor="assignQuantity">Cantidad</Label>
                <Input id="assignQuantity" name="assignQuantity" type="number" min="0" placeholder="0" />
                <p className="text-xs text-slate-500 mt-1">Cantidad inicial del material en la unidad asignada</p>
              </Field>
            </CardBody>
          </Card>
        )}

        <div className="flex gap-2">
          <Link href="/admin/materiales">
            <Button type="button" variant="secondary">Cancelar</Button>
          </Link>
          <Button type="submit">Crear Material</Button>
        </div>
      </form>
    </div>
  );
}
