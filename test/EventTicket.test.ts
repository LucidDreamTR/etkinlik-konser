import { expect } from "chai";
import hre from "hardhat";

describe("EventTicket Kusursuzluk Testi", function () {
  async function deployContractFixture() {
    const [owner, otherAccount, buyer] = await hre.ethers.getSigners();
    const EventTicket = await hre.ethers.getContractFactory("EventTicket");
    const ticket = await EventTicket.deploy("EventTicket", "EVT", owner.address);
    const minterRole = await ticket.MINTER_ROLE();
    await ticket.grantRole(minterRole, owner.address);
    return { ticket, owner, otherAccount, buyer };
  }

  it("Bilet Basımı (Mint) Başarılı Olmalı", async function () {
    const { ticket, buyer } = await deployContractFixture();
    const paymentId = hre.ethers.id("payment_123");

    await ticket["safeMint(address,string,uint256,bytes32,bytes32,address,uint8)"](
      buyer.address,
      "https://ipfs.io/metadata.json",
      1,
      paymentId,
      hre.ethers.id("rules-v1"),
      buyer.address,
      2
    );
    expect(await ticket.ownerOf(0)).to.equal(buyer.address);
    const meta = await ticket.tickets(0);
    expect(meta.eventId).to.equal(1n);
    expect(meta.claimed).to.equal(false);
    expect(meta.eventState).to.equal(1n); // ACTIVE
  });

  it("Mükerrer Ödeme (Double-Mint) Engellenmeli", async function () {
    const { ticket, buyer } = await deployContractFixture();
    const paymentId = hre.ethers.id("payment_123");

    await ticket["safeMint(address,string,uint256,bytes32)"](buyer.address, "https://ipfs.io/metadata.json", 1, paymentId);
    await expect(
      ticket["safeMint(address,string,uint256,bytes32)"](buyer.address, "https://ipfs.io/metadata.json", 1, paymentId)
    ).to.be.revertedWith("EventTicket: Payment ID has already been used");
  });

  it("Bilet Transferi Sorunsuz Çalışmalı", async function () {
    const { ticket, buyer, otherAccount } = await deployContractFixture();
    const paymentId = hre.ethers.id("payment_456");

    await ticket["safeMint(address,string,uint256,bytes32)"](buyer.address, "https://ipfs.io/metadata.json", 1, paymentId);
    await ticket.connect(buyer).transferFrom(buyer.address, otherAccount.address, 0);

    expect(await ticket.ownerOf(0)).to.equal(otherAccount.address);
  });

  it("Claim sonrası EventState CHECKIN olmalı", async function () {
    const { ticket, buyer } = await deployContractFixture();
    const paymentId = hre.ethers.id("payment_claim");

    await ticket["safeMint(address,string,uint256,bytes32)"](buyer.address, "https://ipfs.io/metadata.json", 1, paymentId);
    await ticket.connect(buyer).claim(0);

    const meta = await ticket.tickets(0);
    expect(meta.claimed).to.equal(true);
    expect(meta.eventState).to.equal(2n); // CHECKIN
  });

  it("Event CLOSED olduğunda mint/claim/transfer kilitlenmeli", async function () {
    const { ticket, owner, buyer, otherAccount } = await deployContractFixture();
    const eventId = 77;
    const paymentId = hre.ethers.id("payment_closed");

    await ticket["safeMint(address,string,uint256,bytes32)"](buyer.address, "https://ipfs.io/metadata.json", eventId, paymentId);
    await ticket.connect(owner).setEventState(eventId, 3); // CLOSED

    await expect(
      ticket["safeMint(address,string,uint256,bytes32)"](
        buyer.address,
        "https://ipfs.io/metadata-2.json",
        eventId,
        hre.ethers.id("payment_closed_2")
      )
    ).to.be.revertedWith("EventTicket: Event is closed");

    await expect(ticket.connect(buyer).claim(0)).to.be.revertedWith("EventTicket: Event is closed");
    await expect(
      ticket.connect(buyer).transferFrom(buyer.address, otherAccount.address, 0)
    ).to.be.revertedWith("EventTicket: Event is closed");
  });
});
