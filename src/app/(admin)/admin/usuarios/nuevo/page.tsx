"use server";

import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/auth";
import { createUser } from "@/lib/services/users.service";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Label } from "@/components/ui/label";
import { Input, Select } from "@/components/ui/input";

async function createUserAction(formData: FormData) {
  "use server";
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const role = formData.get("role") as UserRole;
  const unitId = formData.get("unitId") as string || null;

  const created = await createUser(user, { name, email, password, role, unitId: unitId || null });
  redirect(`/admin/usuarios/${created.id}`);
}

export default async function NewUserPage() {
  const user = (await getSessionUser())!;
  const units = await prisma.unit.findMany({
    where: { active: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-4 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold">Crear Usuario</h1>
        <p className="text-sm text-slate-500">Registra un nuevo usuario en el sistema</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información del Usuario</CardTitle>
        </CardHeader>
        <CardBody>
          <form action={createUserAction} className="space-y-4">
            <Field>
              <Label htmlFor="name">Nombre *</Label>
              <Input id="name" name="name" type="text" maxLength={120} placeholder="Juan Pérez" required />
            </Field>

            <Field>
              <Label htmlFor="email">Correo Electrónico *</Label>
              <Input id="email" name="email" type="email" placeholder="juan@ejemplo.com" required />
            </Field>

            <Field>
              <Label htmlFor="password">Contraseña *</Label>
              <Input
                id="password"
                name="password"
                type="password"
                minLength={10}
                maxLength={100}
                placeholder="Mínimo 10 caracteres"
                required
              />
            </Field>

            <Field>
              <Label htmlFor="role">Rol *</Label>
              <Select id="role" name="role" required>
                <option value="">Selecciona un rol</option>
                <option value="COMANDANCIA_ADMIN">Administrador</option>
                <option value="UNIT_MANAGER">Encargado de Unidad</option>
                <option value="OPERATIONAL">Operario</option>
              </Select>
            </Field>

            <Field>
              <Label htmlFor="unitId">Unidad</Label>
              <Select id="unitId" name="unitId">
                <option value="">No asignar a unidad (solo para Admin)</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name} ({unit.code})
                  </option>
                ))}
              </Select>
              <p className="text-xs text-slate-500 mt-1">
                Obligatorio si el rol es "Encargado de Unidad" u "Operario"
              </p>
            </Field>

            <div className="flex gap-2 pt-4">
              <Link href="/admin/usuarios">
                <Button type="button" variant="secondary">
                  Cancelar
                </Button>
              </Link>
              <Button type="submit">Crear Usuario</Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
