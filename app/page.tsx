import PreMainnetBanner from "@/src/components/landing/PreMainnetBanner";
import Hero from "@/src/components/landing/Hero";
import HowItWorks from "@/src/components/landing/HowItWorks";
import Transparency from "@/src/components/landing/Transparency";
import WhyDecentralized from "@/src/components/landing/WhyDecentralized";
import NftTickets from "@/src/components/landing/NftTickets";
import EnsIdentity from "@/src/components/landing/EnsIdentity";
import Demo from "@/src/components/landing/Demo";
import WhitePaper from "@/src/components/landing/WhitePaper";
import Footer from "@/src/components/landing/Footer";

export default function Home() {
  return (
    <div className="bg-[#0A0A0A]">
      <PreMainnetBanner />
      <Hero />
      <HowItWorks />
      <Transparency />
      <WhyDecentralized />
      <NftTickets />
      <EnsIdentity />
      <Demo />
      <WhitePaper />
      <Footer />
    </div>
  );
}
