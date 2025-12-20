import EventHero from "@/components/EventHero";
import EventInfo from "@/components/EventInfo";
import EventMeta from "@/components/EventMeta";

export default function EventPage() {
  return (
    <main className="min-h-screen bg-black">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-1/2 top-[-220px] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute right-[-180px] top-[120px] h-[520px] w-[520px] rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-[-260px] left-[-200px] h-[620px] w-[620px] rounded-full bg-white/5 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.06] mix-blend-overlay [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:16px_16px]" />
      </div>

      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="divide-y divide-white/10 rounded-3xl">
          <div className="py-10 lg:py-12">
            <EventHero
              title="Rock Gecesi"
              dateLabel="12 Nisan 2025 · Cumartesi"
              cityLabel="İstanbul"
              ctaLabel="Yakında"
            />
          </div>

          <div className="py-10 lg:py-12">
            <EventInfo
              description="Rock Gecesi, yüksek enerjili canlı performanslarla geceyi dev bir sahne deneyimine dönüştürür. Kapasite sınırlı."
              venueName="Blind İstanbul"
              venueAddress="Asmalımescit, Beyoğlu"
              doorsOpenLabel="20:00"
              startTimeLabel="21:00"
            />
          </div>

          <div className="py-10 lg:py-12">
            <EventMeta
              organizerName="konser.eth"
              organizerHandle="@konser.eth"
              status="upcoming"
              tags={["Rock", "Live", "Beyoğlu"]}
            />
          </div>
        </div>
        <footer className="mt-10 border-t border-white/10 pt-8 text-xs text-white/50">
  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
    <span>etkinlik.eth · konser.eth</span>
    <span>TL ödeme · ENS doğrulama · Web3 altyapı</span>
  </div>
</footer>
      </div>
    </main>
  );
}
