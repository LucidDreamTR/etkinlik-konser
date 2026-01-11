export default function PreMainnetBanner() {
  return (
    <div className="bg-[#111111] border-b border-[#1F1F1F]">
      <div className="mx-auto flex max-w-[1280px] items-center justify-center gap-3 px-6 py-4 md:px-8">
        <div className="h-2 w-2 rounded-full bg-[#E5E7EB]" aria-hidden />
        <p className="text-sm text-[#A3A3A3]">Platform şu anda test aşamasındadır. Mainnet lansmanı yakında.</p>
      </div>
    </div>
  );
}
