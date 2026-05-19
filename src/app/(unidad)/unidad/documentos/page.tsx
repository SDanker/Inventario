import { TodoPlaceholder } from "@/components/todo-placeholder";
export default function Page() {
  return (
    <TodoPlaceholder
      title="Documentos PDF"
      description="Carga y descarga de PDFs por activo/mantención. El servicio valida los magic bytes del PDF y el tamaño máximo configurable por env."
      follow="src/lib/services/documents.service.ts"
    />
  );
}
