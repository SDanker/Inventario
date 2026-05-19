import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIIB — Inventario de Bomberos",
  description: "Sistema Integral de Inventario de Bomberos",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
