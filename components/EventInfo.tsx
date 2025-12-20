import TicketCard from "@/components/TicketCard";
// components/EventInfo.tsx
type EventInfoProps = {
  description: string;
  venueName: string;
  venueAddress?: string;
  startTimeLabel: string; // örn: "21:00"
  doorsOpenLabel?: string; // örn: "20:00"
};

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <div className="text-xs font-medium tracking-wide text-white/50">
        {label}
      </div>
      <div className="mt-2 text-sm leading-relaxed text-white/80">{value}</div>
    </div>
  );
}

export default function EventInfo({
  description,
  venueName,
  venueAddress,
  startTimeLabel,
  doorsOpenLabel,
}: EventInfoProps) {
  return (
    <section className="grid gap-4 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur sm:p-8">
          <h2 className="text-lg font-semibold tracking-tight text-white">
            Etkinlik Hakkında
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/70">
            {description}
          </p>
        </div>
      </div>
      
<div className="grid gap-4 lg:col-span-5">
  <TicketCard priceTryLabel="₺850" supplyLabel="120 bilet" saleStatus="soon" />

  <InfoItem label="Mekan" value={venueName} />
  {venueAddress ? <InfoItem label="Adres" value={venueAddress} /> : null}
  <div className="grid grid-cols-2 gap-4">
    <InfoItem label="Kapı Açılışı" value={doorsOpenLabel ?? "—"} />
    <InfoItem label="Başlangıç" value={startTimeLabel} />
  </div>
</div>
    </section>
  );
}
