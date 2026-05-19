import { TodoPlaceholder } from "@/components/todo-placeholder";
export default function Page() {
  return (
    <TodoPlaceholder
      title="Movimientos"
      description="Registro de ingresos, consumos, ajustes y bajas. El servicio `recordConsumption()` ya hace descuento atómico con lock optimista y genera alerta de stock bajo automáticamente."
      follow="src/lib/services/consumables.service.ts"
    />
  );
}
