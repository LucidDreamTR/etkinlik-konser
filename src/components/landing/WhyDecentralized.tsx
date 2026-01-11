import Section from "./Section";

const reasons = [
  { title: "Gecikmeye dayanıklı", detail: "Çekilebilir bakiye modeli, başarısız transferleri beklemeye alır; kayıp ödeme riski azaltılır." },
  { title: "Denetlenebilir", detail: "Her ödeme dağıtımı çağrısı explorer’da izlenebilir; taraflar kendi payını doğrular." },
  { title: "Kimlik uyumlu", detail: "ENS kullanımı, karmaşık adresler yerine okunabilir isimler sunarak işlem hatalarını azaltır." },
];

export default function WhyDecentralized() {
  return (
    <Section title="Neden zincir üstü?" description="Merkezi aracıya bağlı kalmadan, herkesin aynı kayıt üzerinde uzlaşmasını sağlamak için.">
      <div className="grid gap-6 md:grid-cols-3">
        {reasons.map((item) => (
          <div key={item.title} className="rounded-2xl border border-[#1F1F1F] bg-[#111111] p-6">
            <div className="text-lg font-semibold text-white">{item.title}</div>
            <p className="mt-3 text-sm text-[#A3A3A3]">{item.detail}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
