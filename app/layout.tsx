import type { Metadata } from "next";
import "./globals.css";
import { getMetadataBase } from "@/lib/site";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "etkinlik.eth – Etkinlik & Konser ödemeleri için zincir üstü dağıtım",
  description: "Tek bir işlem ile paydaşlara paylarını ulaştıran, zincir üstü şeffaf akıllı sözleşme altyapısı.",
  metadataBase: getMetadataBase(),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
