import { TodoPlaceholder } from "@/components/todo-placeholder";
export default function Page() {
  return (
    <TodoPlaceholder
      title="Traslados"
      description="Solicitar / preparar / despachar / recibir traslados. La máquina de estados completa está en src/lib/services/transfers.service.ts y opera dentro de una transacción que sólo muta inventario al confirmar la recepción."
      follow="src/app/(admin)/admin/unidades/[id]/page.tsx"
    />
  );
}
