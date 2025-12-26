import type { EventRecord } from "@/lib/events";

export const events: EventRecord[] = [
  {
    slug: "rock-gecesi",
    title: "Rock Gecesi",
    date: "12 Nisan 2025",
    location: "İstanbul",
    description: "Gecenin headliner’ları ve sürpriz konuklarla premium rock deneyimi.",
    ticketPriceWei: "100000000000000000", // 0.1 ETH
    payouts: [
      { role: "artist", label: "Headliner", recipient: "konser.eth", shareBps: 7000 },
      { role: "organizer", label: "Organizasyon", recipient: "0x69B358ff6fCB231751302a3c07378410fCC8E575", shareBps: 1500 },
      { role: "venue", label: "Mekan", recipient: "0x5180db8F5c931aaE63c74266b211F580155ecac8", shareBps: 1000 },
      { role: "platform", label: "Platform", recipient: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", shareBps: 500 },
    ],
  },
  {
    slug: "elektronik-gece",
    title: "Elektronik Gece",
    date: "3 Mayıs 2025",
    location: "Ankara",
    description: "Analog synth’ler, deep bass ve görsel şovla elektronik gece.",
    ticketPriceWei: "150000000000000000", // 0.15 ETH
    payouts: [
      { role: "artist", label: "DJ Set", recipient: "0x5FbDB2315678afecb367f032d93F642f64180aa3", shareBps: 6500 },
      { role: "organizer", recipient: "0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2", shareBps: 2000 },
      { role: "venue", recipient: "0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db", shareBps: 1000 },
      { role: "platform", recipient: "0x78731D3Ca6b7E34aC0F824c42a7cC18A495cabaB", shareBps: 500 },
    ],
  },
];
