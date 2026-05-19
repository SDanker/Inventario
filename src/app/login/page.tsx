import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Field } from "@/components/ui/label";

async function loginAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  try {
    await signIn("credentials", { email, password, redirectTo: "/" });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/login?error=${encodeURIComponent("credenciales_invalidas")}`);
    }
    throw error;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="inline-block rounded-md bg-brand-600 text-white font-bold text-lg px-3 py-1">SIIB</div>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Sistema de Inventario</h1>
          <p className="text-sm text-slate-600">Departamento de Bomberos</p>
        </div>

        <form action={loginAction} className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          {error ? (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm px-3 py-2">
              Credenciales inválidas. Intente nuevamente.
            </div>
          ) : null}

          <Field>
            <Label htmlFor="email">Correo</Label>
            <Input id="email" name="email" type="email" autoComplete="username" required />
          </Field>

          <Field>
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </Field>

          <Button type="submit" className="w-full" size="lg">
            Ingresar
          </Button>

          <p className="mt-4 text-xs text-slate-500 text-center">
            Usuarios demo: admin / encargado1 / operativo1 @bomberos.local
          </p>
        </form>
      </div>
    </main>
  );
}
