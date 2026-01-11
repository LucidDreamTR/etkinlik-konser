import Link from "next/link";

export default function DemoEventPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <div className="mb-8">
          <Link href="/events" className="text-sm text-white/60 hover:text-white">
            ← Etkinlikler
          </Link>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 space-y-4">
          <h1 className="text-3xl font-semibold">Demo Etkinlik</h1>
          <p className="text-white/70">
            Bu sayfa ödeme tetiklemez. Dağıtım planı akışını görmek için detay sayfasına geçebilirsiniz.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/events/rock-gecesi"
              className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
            >
              Detay sayfasına git
            </Link>
            <span className="text-sm text-white/60">Ödemeler dev/test modunda; bu sayfada aktif değil.</span>
          </div>
        </div>
      </div>
    </main>
  );
}
