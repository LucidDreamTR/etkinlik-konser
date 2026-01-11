import Link from "next/link";

import Section from "./Section";

export default function WhitePaper() {
  return (
    <Section
      id="whitepaper"
      title="White Paper"
      description="Sistemin nasıl çalıştığını, ödeme dağıtım modelini ve güvenlik yaklaşımını açıklayan doküman."
      background="secondary"
    >
      <div className="flex flex-col gap-4 rounded-2xl border border-[#1F1F1F] bg-[#0A0A0A] p-6">
        <p className="text-sm text-[#A3A3A3]">
          Tek işlem ile çoklu paydaş ödemesi, çekilebilir bakiye modeli ve zincir üstü doğrulanabilirlik detaylı anlatılır.
        </p>
        <Link
          href="/whitepaper"
          className="inline-flex w-fit items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
        >
          White Paper’ı Oku
        </Link>
      </div>
    </Section>
  );
}
