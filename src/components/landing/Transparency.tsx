import Section from "./Section";

const points = [
  "Dağıtım planları akıllı sözleşmede saklı; sonradan değiştirmek için yetkili yönetici onayı ve zincir üstü işlem gerekir.",
  "Her ödeme, işlem talimatı içindeki işlem numarası ile izlenir ve explorer üzerinden doğrulanır.",
  "Başarısız olan ödemeler çekilebilir bakiye olarak saklanır; diğer ödemeler otomatik olarak dağıtılır.",
  "Dağıtım oranlarının toplamı %100 değilse ödeme süreci başlatılmaz.",
];

export default function Transparency() {
  return (
    <Section
      id="transparency"
      title="Şeffaflık"
      description="Kontrat mantığı kamuya açık; her dağıtım, zincir üstü kayıtla desteklenir. Gri kutu yok, arka kapı yok."
      background="secondary"
    >
      <div className="grid gap-4 md:grid-cols-2">
        {points.map((point) => (
          <div key={point} className="rounded-2xl border border-[#1F1F1F] bg-[#0A0A0A] p-5">
            <p className="text-sm text-[#A3A3A3]">{point}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
