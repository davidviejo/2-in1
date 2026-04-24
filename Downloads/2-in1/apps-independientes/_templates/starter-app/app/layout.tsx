import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "__APP_NAME__",
  description: "Starter independiente para 2-in-1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
