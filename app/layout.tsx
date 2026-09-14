import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bimbingan Andaz | Universitas Bani Saleh",
  description: "Pengajuan judul, konsultasi, progres, dokumen, jadwal, dan arsip bimbingan dalam satu sistem aman.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
