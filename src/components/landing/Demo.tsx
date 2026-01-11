import Link from "next/link";

import Section from "./Section";

export default function Demo() {
  return (
    <Section
      id="demo"
      title="Demo"
      description="Şu anda test ağında. Örnek etkinlikler üzerinden dağıtım planı, işlem talimatı ve explorer çıktısını inceleyebilirsiniz."
    >
      <div className="rounded-2xl border border-[#1F1F1F] bg-[#111111] p-6">
        <div className="flex flex-col gap-4 text-sm text-[#A3A3A3]">
          <div className="flex items-center justify-between">
            <span className="text-white">Ödeme akışı</span>
            <span className="rounded-full border border-[#1F1F1F] px-3 py-1 text-xs text-[#E5E7EB]">Dev / Test</span>
          </div>
          <p>Tek işlemle dağıtım, çekilebilir bakiyeler ve Sepolia/Holesky üzerinde explorer bağlantıları.</p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/events/demo"
              className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
            >
              Demo sayfası
            </Link>
            <span className="inline-flex items-center rounded-full border border-[#1F1F1F] px-4 py-2 text-xs text-[#A3A3A3]">
              NEXT_PUBLIC_TX_ENABLED=false ise ödeme butonu pasif
            </span>
          </div>
        </div>
      </div>
    </Section>
  );
}
