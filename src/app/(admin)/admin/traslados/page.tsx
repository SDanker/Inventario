import { TodoPlaceholder } from "@/components/todo-placeholder";

export default function TransfersAdminPage() {
  return (
    <TodoPlaceholder
      title="Traslados (Comandancia)"
      description="Listado y aprobación de traslados entre unidades. El servicio está completo en src/lib/services/transfers.service.ts (incluye la máquina de estados y las transacciones de inventario)."
      follow="src/app/(admin)/admin/unidades/page.tsx"
    />
  );
}
