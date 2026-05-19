import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-6xl font-bold text-slate-300">403</div>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">Sin permisos</h1>
        <p className="mt-1 text-sm text-slate-600">
          Tu cuenta no tiene permiso para acceder a esta página.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-brand-600 hover:underline">
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
