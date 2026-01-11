import Section from "./Section";

export default function EnsIdentity() {
  return (
    <Section
      id="ens"
      title="ENS ile kimlik"
      description={`Paydaşlar, ENS etiketleriyle tanımlanır; sistem bu etiketleri otomatik olarak doğru adreslere eşler. Akıllı sözleşme ödemeyi doğru alıcıya yönlendirir.`}
      background="secondary"
    >
      <div className="rounded-2xl border border-[#1F1F1F] bg-[#0A0A0A] p-6 text-sm text-[#A3A3A3]">
        <div className="flex items-center justify-between">
          <span className="text-white">Örnek:</span>
          <span className="rounded-full bg-[#111111] px-3 py-1 text-xs text-[#E5E7EB]">ens lookup</span>
        </div>
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span>artist.eth</span>
            <span className="text-[#E5E7EB]">7000 oran</span>
          </div>
          <div className="flex items-center justify-between">
            <span>venue.eth</span>
            <span className="text-[#E5E7EB]">2000 oran</span>
          </div>
          <div className="flex items-center justify-between">
            <span>platform.eth</span>
            <span className="text-[#E5E7EB]">1000 oran</span>
          </div>
        </div>
      </div>
    </Section>
  );
}
