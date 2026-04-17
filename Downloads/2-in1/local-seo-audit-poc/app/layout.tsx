import "./globals.css";
import { ReactNode } from "react";

export const metadata = {
  title: "Local SEO Audit PoC",
  description: "Herramienta independiente de auditoría puntual de SEO local asistida por IA"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
