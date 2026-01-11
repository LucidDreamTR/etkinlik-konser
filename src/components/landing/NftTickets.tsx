import Section from "./Section";

export default function NftTickets() {
  return (
    <Section background="secondary">
      <div className="flex flex-col gap-4">
        <h2 className="text-3xl font-semibold text-white">NFT biletler</h2>
        <div className="space-y-2 text-lg text-[#A3A3A3]">
          <p>Her bilet, cüzdanında saklanan dijital bir bilete dönüşebilir.</p>
          <p>Sahiplik doğrulanabilir.</p>
          <p>Sahte bilet riski azalır.</p>
          <p>Hatıra ve koleksiyon değeri taşır.</p>
        </div>
        <div className="pt-2">
          <a
            href="/whitepaper"
            className="inline-flex items-center justify-center rounded-full border border-[#1F1F1F] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            White Paper
          </a>
        </div>
      </div>
    </Section>
  );
}
