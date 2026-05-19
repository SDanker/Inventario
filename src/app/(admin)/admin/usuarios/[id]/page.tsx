"use server";

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/auth";
import { updateUser, deactivateUser } from "@/lib/services/users.service";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Label } from "@/components/ui/label";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

async function updateUserAction(formData: FormData) {
  "use server";
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const userId = formData.get("userId") as string;
  const name = formData.get("name") as string;
  const role = formData.get("role") as UserRole;
  const unitId = formData.get("unitId") as string || null;

  await updateUser(user, userId, {
    name: name || undefined,
    role: role || undefined,
    unitId: unitId || undefined,
  }, null);
}

async function deactivateUserAction(formData: FormData) {
  "use server";
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const userId = formData.get("userId") as string;
  await deactivateUser(user, userId, null);
  redirect("/admin/usuarios");
}

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionUser = (await getSessionUser())!;

  const userToEdit = await prisma.user.findUnique({
    where: { id },
    include: { unit: { select: { id: true, name: true, code: true } } },
  });

  if (!userToEdit) notFound();

  const units = await prisma.unit.findMany({
    where: { active: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  const roleLabels: Record<UserRole, string> = {
    COMANDANCIA_ADMIN: "Administrador",
    UNIT_MANAGER: "Encargado de Unidad",
    OPERATIONAL: "Operario",
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{userToEdit.name}</h1>
          <p className="text-sm text-slate-500">Correo: {userToEdit.email}</p>
        </div>
        <Link href="/admin/usuarios">
          <Button variant="secondary">Volver</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información del Usuario</CardTitle>
        </CardHeader>
        <CardBody>
          <form action={updateUserAction} className="space-y-4">
            <input type="hidden" name="userId" value={id} />
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  defaultValue={userToEdit.name}
                  maxLength={120}
                  required
                />
              </Field>
              <Field>
                <Label htmlFor="email">Correo (no editable)</Label>
                <Input
                  id="email"
                  type="email"
                  defaultValue={userToEdit.email}
                  disabled
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label htmlFor="role">Rol</Label>
                <Select id="role" name="role" defaultValue={userToEdit.role} required>
                  <option value="COMANDANCIA_ADMIN">Administrador</option>
                  <option value="UNIT_MANAGER">Encargado de Unidad</option>
                  <option value="OPERATIONAL">Operario</option>
                </Select>
              </Field>
              <Field>
                <Label htmlFor="unitId">Unidad</Label>
                <Select id="unitId" name="unitId" defaultValue={userToEdit.unitId || ""}>
                  <option value="">No asignado</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name} ({unit.code})
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field>
              <Label>Estado</Label>
              <div className="pt-2">
                <Badge tone={userToEdit.active ? "success" : "neutral"}>
                  {userToEdit.active ? "Activo" : "Inactivo"}
                </Badge>
              </div>
            </Field>

            <Button type="submit">Guardar Cambios</Button>
          </form>
        </CardBody>
      </Card>

      {userToEdit.active && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Zona de Baja</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-slate-600 mb-4">
              Una vez desactivado, el usuario no podrá acceder al sistema.
            </p>
            <form action={deactivateUserAction}>
              <input type="hidden" name="userId" value={id} />
              <Button type="submit" variant="danger">
                Desactivar Usuario
              </Button>
            </form>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
