import { Card, CardBody } from "./ui/card";

/**
 * Placeholder visual para módulos pendientes del MVP.
 * Replicar el patrón de Unidades para completarlos.
 */
export function TodoPlaceholder({ title, description, follow }: { title: string; description?: string; follow?: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      <Card>
        <CardBody>
          <div className="text-sm text-slate-600 space-y-2">
            <p>{description ?? "Pantalla pendiente de implementación."}</p>
            {follow ? <p className="text-slate-500">Replicar el patrón de: <code className="bg-slate-100 px-1 py-0.5 rounded">{follow}</code></p> : null}
            <p>El servicio backend ya está disponible en <code className="bg-slate-100 px-1 py-0.5 rounded">src/lib/services/</code>.</p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
