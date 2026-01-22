import { expect } from "chai";
import hre from "hardhat";

describe("EventTicket Kusursuzluk Testi", function () {
  async function deployContractFixture() {
    const [owner, otherAccount, buyer] = await hre.ethers.getSigners();
    const EventTicket = await hre.ethers.getContractFactory("EventTicket");
    // Kontratı "Elite Events", "ELT" sembolüyle kuruyoruz
    const ticket = await EventTicket.deploy();
    return { ticket, owner, otherAccount, buyer };
  }

  it("Bilet Basımı (Mint) Başarılı Olmalı", async function () {
    const { ticket, buyer } = await deployContractFixture();
    const paymentId = hre.ethers.id("payment_123");
    
    await ticket.safeMint(buyer.address, "https://ipfs.io/metadata.json", paymentId);
    expect(await ticket.ownerOf(0)).to.equal(buyer.address);
  });

  it("Mükerrer Ödeme (Double-Mint) Engellenmeli", async function () {
    const { ticket, buyer } = await deployContractFixture();
    const paymentId = hre.ethers.id("payment_123");
    
    await ticket.safeMint(buyer.address, "https://ipfs.io/metadata.json", paymentId);
    await expect(
      ticket.safeMint(buyer.address, "https://ipfs.io/metadata.json", paymentId)
    ).to.be.revertedWith("Payment already used");
  });

  it("Bilet Transferi Sorunsuz Çalışmalı", async function () {
    const { ticket, buyer, otherAccount } = await deployContractFixture();
    const paymentId = hre.ethers.id("payment_456");
    
    await ticket.safeMint(buyer.address, "https://ipfs.io/metadata.json", paymentId);
    await ticket.connect(buyer).transferFrom(buyer.address, otherAccount.address, 0);
    
    expect(await ticket.ownerOf(0)).to.equal(otherAccount.address);
  });
});