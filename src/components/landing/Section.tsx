type SectionProps = {
  id?: string;
  title?: string;
  eyebrow?: string;
  description?: string;
  children?: React.ReactNode;
  background?: "primary" | "secondary";
};

export default function Section({
  id,
  title,
  eyebrow,
  description,
  children,
  background = "primary",
}: SectionProps) {
  const bgClass = background === "secondary" ? "bg-[#111111]" : "bg-[#0A0A0A]";

  return (
    <section id={id} className={`${bgClass} border-b border-[#1F1F1F] py-24`}>
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-6 md:px-8">
        {eyebrow ? <div className="text-sm font-semibold uppercase tracking-[0.08em] text-[#E5E7EB]">{eyebrow}</div> : null}
        {title ? <h2 className="text-3xl md:text-4xl leading-tight text-white">{title}</h2> : null}
        {description ? <p className="max-w-3xl text-lg text-[#A3A3A3]">{description}</p> : null}
        {children}
      </div>
    </section>
  );
}
