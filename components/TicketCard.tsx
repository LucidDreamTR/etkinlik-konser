// components/TicketCard.tsx
type TicketCardProps = {
  priceTryLabel: string; // örn: "₺850"
  supplyLabel?: string; // örn: "120 bilet"
  saleStatus?: "soon" | "on" | "soldout";
};

function Pill({ text }: { text: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/60">
      {text}
    </span>
  );
}

export default function TicketCard({
  priceTryLabel,
  supplyLabel = "Sınırlı kapasite",
  saleStatus = "soon",
}: TicketCardProps) {
  const statusMap = {
    soon: { title: "Satış Yakında", desc: "Bilet satışı açıldığında bildirim al." },
    on: { title: "Satışta", desc: "TL ile ödeme + zincir doğrulama." },
    soldout: { title: "Tükendi", desc: "Yeni batch olursa haberdar ol." },
  } as const;
  const accent =
    saleStatus === "on"
      ? "bg-white/12"
      : saleStatus === "soldout"
      ? "bg-white/6"
      : "bg-white/10";

  const ctaLabel =
    saleStatus === "on" ? "Bilet Al" : saleStatus === "soldout" ? "Bekleme Listesi" : "Bildirim Al";
  const s = statusMap[saleStatus ?? "soon"];

  return (
    <aside className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium tracking-wide text-white/50">
            Bilet
          </div>
          <div className="mt-2 text-xl font-semibold tracking-tight text-white">
            {priceTryLabel}
          </div>
          <div className="mt-2 text-sm text-white/60">{supplyLabel}</div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <Pill text="TL ödeme" />
          <Pill text="ENS" />
        </div>
      </div>

      <div className={`mt-6 rounded-2xl border border-white/10 ${accent} p-4`}>
        <div className="text-sm font-semibold text-white">{s.title}</div>
        <div className="mt-1 text-sm leading-relaxed text-white/60">
          {s.desc}
        </div>
      </div>

      <button
        type="button"
        className="mt-6 inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-medium text-white/80 transition hover:bg-white/15 active:translate-y-[1px]"
      >
        {ctaLabel}
      </button>
      <div className="mt-3 flex items-center justify-between text-[11px] text-white/45">
        <span>Güvenli ödeme</span>
        <span>ENS doğrulama</span>
        <span>Fiat → Web3</span>
      </div>
      <div className="mt-4 text-xs leading-relaxed text-white/45">
        Ödeme akışı ve zincir doğrulama bir sonraki sprint’te bağlanacak.
      </div>
    </aside>
  );
}
