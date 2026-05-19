/**
 * Ejecuta el escaneo de alertas desde CLI.
 *   npm run alerts:scan
 *
 * Programar en Windows Task Scheduler (diario, 06:00):
 *   schtasks /Create /SC DAILY /ST 06:00 /TN "SIIB-AlertsScan" /TR "cmd /c cd /d D:\\claude\\Inventario && npm run alerts:scan"
 */
import { scanAlerts } from "../src/lib/services/alerts.service";

async function main() {
  console.log("→ Escaneando alertas…");
  const result = await scanAlerts();
  console.log(`✓ Listo. ${result.created} alertas creadas.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
