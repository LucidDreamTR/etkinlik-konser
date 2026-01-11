import Link from "next/link";

import Section from "./Section";

export default function Footer() {
  return (
    <Section id="footer" background="secondary">
      <div className="flex flex-col gap-4 text-sm text-[#A3A3A3] md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-1 text-[#A3A3A3]">
          <span>etkinlik.eth</span>
          <span>konser.eth</span>
        </div>
        <div className="flex flex-col gap-1 text-[#A3A3A3]">
          <a href="https://ethereum.org" className="transition-opacity hover:opacity-80" target="_blank" rel="noreferrer">
            ethereum.org
          </a>
          <a href="https://ens.domains" className="transition-opacity hover:opacity-80" target="_blank" rel="noreferrer">
            ens.domains
          </a>
        </div>
      </div>
    </Section>
  );
}
