import Section from "./Section";

const steps = [
  {
    title: "Dağıtım planı oluştur",
    description: "Paydaşlar, ENS etiketleriyle tanımlanır; sistem bu etiketleri otomatik olarak doğru adreslere eşler. Dağıtım oranlarının toplamı %100 olacak şekilde kilitlenir.",
  },
  {
    title: "Tek işlem gönder",
    description: "Bilet bedelini MetaMask ile gönderirken dağıtım kimliği ve işlem numarasını işlem talimatı içinde ilet; işlem zincir üstü kaydedilir.",
  },
  {
    title: "Otomatik dağıtım",
    description: "Başarısız olan ödemeler çekilebilir bakiye olarak saklanır; diğer ödemeler otomatik olarak dağıtılır.",
  },
];

export default function HowItWorks() {
  return (
    <Section
      id="how-it-works"
      title="Nasıl çalışır?"
      description="Sabitlenen dağıtım şeması sayesinde dağıtım kuralı tek kaynaktan okunur."
    >
      <div className="grid gap-6 md:grid-cols-3">
        {steps.map((step) => (
          <div key={step.title} className="rounded-2xl border border-[#1F1F1F] bg-[#111111] p-6">
            <div className="text-sm text-[#6B6B6B]">Adım</div>
            <div className="mt-2 text-xl font-semibold text-white">{step.title}</div>
            <p className="mt-3 text-sm text-[#A3A3A3]">{step.description}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
