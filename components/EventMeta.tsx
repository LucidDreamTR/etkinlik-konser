// components/EventMeta.tsx
type EventMetaProps = {
  organizerName: string;
  organizerHandle?: string; // örn: "@konser.eth"
  tags?: string[];
  status?: "upcoming" | "live" | "ended" | "soldout";
};

function StatusPill({ status }: { status: NonNullable<EventMetaProps["status"]> }) {
  const map = {
    upcoming: { label: "Yakında", cls: "border-white/10 bg-white/10 text-white/70" },
    live: { label: "Canlı", cls: "border-white/15 bg-white/15 text-white" },
    soldout: { label: "Tükendi", cls: "border-white/10 bg-white/5 text-white/60" },
  } as const;

  const s = map[status];

  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium backdrop-blur",
        s.cls,
      ].join(" ")}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
      {s.label}
    </span>
  );
}

export default function EventMeta({
  organizerName,
  organizerHandle,
  tags = [],
  status = "upcoming",
}: EventMetaProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-medium tracking-wide text-white/50">
            Organizatör
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <div className="text-base font-semibold text-white">
              {organizerName}
            </div>
            {organizerHandle ? (
              <div className="text-sm text-white/60">{organizerHandle}</div>
            ) : null}
          </div>
        </div>

        <StatusPill status={status} />
      </div>

      {tags.length ? (
        <div className="mt-6 flex flex-wrap gap-2">
          {tags.map((t) => (
            <span
              key={t}
              className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/60"
            >
              {t}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
