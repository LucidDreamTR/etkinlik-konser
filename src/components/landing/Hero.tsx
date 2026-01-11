import Link from "next/link";

import Section from "./Section";

export default function Hero() {
  return (
    <Section>
      <div className="flex flex-col gap-6">
        <h1 className="text-4xl md:text-5xl leading-tight text-white">
          Etkinlik & Konser ödemeleri için zincir üstü dağıtım
        </h1>

        <div className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold text-white">Sanat severler için yeni bir deneyim</h2>
          <p className="max-w-3xl text-lg text-[#A3A3A3]">
            Bir konser ya da etkinlik bileti satın almak çoğu zaman basit bir işlemdir.
          </p>
          <p className="max-w-3xl text-lg text-[#A3A3A3]">
            Ancak bu platformda bilet satın almak, aynı zamanda bilinçli bir tercihtir.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <p className="max-w-3xl text-lg text-[#A3A3A3]">
            Tek bir işlem ile tüm paydaşların payını dağıtın.
          </p>
          <p className="max-w-3xl text-lg text-[#A3A3A3]">
            Şeffaf, izlenebilir ve ENS destekli kimliklerle adil ve güvenli gelir paylaşımı.
          </p>
          <p className="max-w-3xl text-lg text-[#A3A3A3]">
            NFT biletlerle: sahiplik kanıtı, sahte bilet riskine karşı koruma ve koleksiyon değeri.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="#how-it-works"
            className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            Nasıl çalışır?
          </Link>
          <Link
            href="/events"
            className="inline-flex items-center justify-center rounded-full border border-[#1F1F1F] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Örnek etkinlikler
          </Link>
        </div>
      </div>
    </Section>
  );
}
