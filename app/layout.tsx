import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BimbingAI Akademik | Universitas Bani Saleh",
  description: "Monitoring Skripsi, KTI, KIA, arsip bimbingan, dan AI Academic Review dalam satu sistem aman.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
