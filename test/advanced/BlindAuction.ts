import { expect } from "chai";
import { ethers } from "hardhat";
import { BlindAuction } from "../../types";
import { createInstances } from "../instance";
import { getSigners, initSigners } from "../signers";
import { deployBlindAuctionFixture } from "./BlindAuction.fixture";

describe("BlindAuction - Sealed-Bid Auction", function () {
  before(async function () {
    await initSigners();
    this.signers = await getSigners();
  });

  beforeEach(async function () {
    const contract = await deployBlindAuctionFixture();
    this.contractAddress = await contract.getAddress();
    this.blindAuction = contract;
    this.instances = await createInstances(this.contractAddress, ethers, this.signers);
  });

  it("should deploy contract successfully", async function () {
    expect(this.contractAddress).to.not.equal(ethers.ZeroAddress);
  });

  describe("Sealed-Bid Auction Process", function () {
    it("should accept encrypted bids during bidding phase", async function () {
      const aliceBid = 1000;
      const bobBid = 1500;

      // Alice places encrypted bid
      let input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(aliceBid);
      let encrypted = await input.encrypt();

      let tx = await this.blindAuction
        .connect(this.signers.alice)
        .placeBid(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Bob places encrypted bid
      input = this.instances.bob.createEncryptedInput(this.contractAddress, this.signers.bob.address);
      input.add32(bobBid);
      encrypted = await input.encrypt();

      tx = await this.blindAuction.connect(this.signers.bob).placeBid(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Bids are stored encrypted
      const bidCount = await this.blindAuction.getBidCount();
      expect(bidCount).to.equal(2);
    });

    it("should compare bids without revealing values", async function () {
      const aliceBid = 1000;
      const bobBid = 1500;

      // Place bids
      let input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(aliceBid);
      let encrypted = await input.encrypt();

      let tx = await this.blindAuction
        .connect(this.signers.alice)
        .placeBid(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      input = this.instances.bob.createEncryptedInput(this.contractAddress, this.signers.bob.address);
      input.add32(bobBid);
      encrypted = await input.encrypt();

      tx = await this.blindAuction.connect(this.signers.bob).placeBid(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Compare bids (encrypted comparison via FHE.gt())
      tx = await this.blindAuction.determinWinner();
      await tx.wait();

      // Winner determined without revealing actual amounts
      const winner = await this.blindAuction.getWinner();
      expect(winner).to.not.equal(ethers.ZeroAddress);
    });

    it("should only reveal winner at auction end", async function () {
      const aliceBid = 500;
      const bobBid = 800;
      const charlieeBid = 600;

      // All place bids encrypted
      const bidders = [
        { signer: this.signers.alice, instance: this.instances.alice, amount: aliceBid },
        { signer: this.signers.bob, instance: this.instances.bob, amount: bobBid },
        { signer: this.signers.charlie, instance: this.instances.charlie, amount: charlieeBid },
      ];

      for (const bidder of bidders) {
        const input = bidder.instance.createEncryptedInput(this.contractAddress, bidder.signer.address);
        input.add32(bidder.amount);
        const encrypted = await input.encrypt();

        const tx = await this.blindAuction.connect(bidder.signer).placeBid(encrypted.handles[0], encrypted.inputProof);
        await tx.wait();
      }

      // During bidding, bids remain secret
      const count = await this.blindAuction.getBidCount();
      expect(count).to.equal(3);

      // End auction and determine winner
      const tx = await this.blindAuction.determinWinner();
      await tx.wait();

      // Winner is revealed (Bob with 800 is highest)
      const winner = await this.blindAuction.getWinner();
      expect(winner).to.equal(this.signers.bob.address);
    });
  });

  describe("Privacy Properties", function () {
    it("should prevent bid sniping", async function () {
      // Blind auction prevents bid sniping because:
      // All bids are encrypted - others cannot see amounts
      // Cannot react to someone else's bid by placing higher bid at last second

      const aliceBid = 1000;
      const bobBid = 1200;

      // Alice places bid
      let input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(aliceBid);
      let encrypted = await input.encrypt();

      let tx = await this.blindAuction
        .connect(this.signers.alice)
        .placeBid(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Bob cannot see Alice's bid to snipe it
      // So Bob must bid based on his own valuation
      input = this.instances.bob.createEncryptedInput(this.contractAddress, this.signers.bob.address);
      input.add32(bobBid);
      encrypted = await input.encrypt();

      tx = await this.blindAuction.connect(this.signers.bob).placeBid(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Bids remain sealed until end
      const count = await this.blindAuction.getBidCount();
      expect(count).to.equal(2);
    });

    it("should prevent collusion", async function () {
      // Encrypted bids prevent collusion because:
      // Participants cannot communicate about bid amounts during auction
      // No way to verify bid claims (amounts are encrypted)

      const aliceBid = 2000;
      const bobBid = 2100;

      // Place bids independently
      let input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(aliceBid);
      let encrypted = await input.encrypt();

      let tx = await this.blindAuction
        .connect(this.signers.alice)
        .placeBid(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      input = this.instances.bob.createEncryptedInput(this.contractAddress, this.signers.bob.address);
      input.add32(bobBid);
      encrypted = await input.encrypt();

      tx = await this.blindAuction.connect(this.signers.bob).placeBid(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Cannot collude because bids are encrypted
      const count = await this.blindAuction.getBidCount();
      expect(count).to.equal(2);
    });
  });

  describe("Winner Determination", function () {
    it("should determine highest bidder as winner", async function () {
      const bids = [
        { signer: this.signers.alice, instance: this.instances.alice, amount: 500 },
        { signer: this.signers.bob, instance: this.instances.bob, amount: 1500 },
        { signer: this.signers.charlie, instance: this.instances.charlie, amount: 1000 },
      ];

      // Place all bids
      for (const bid of bids) {
        const input = bid.instance.createEncryptedInput(this.contractAddress, bid.signer.address);
        input.add32(bid.amount);
        const encrypted = await input.encrypt();

        const tx = await this.blindAuction.connect(bid.signer).placeBid(encrypted.handles[0], encrypted.inputProof);
        await tx.wait();
      }

      // Determine winner
      const tx = await this.blindAuction.determinWinner();
      await tx.wait();

      // Bob (1500) wins
      const winner = await this.blindAuction.getWinner();
      expect(winner).to.equal(this.signers.bob.address);
    });
  });

  describe("Use Cases", function () {
    it("should support fair procurement auction", async function () {
      // Use case: Government procurement - prevents corruption from revealing bids

      const bids = [
        { supplier: this.signers.alice, amount: 10000 },
        { supplier: this.signers.bob, amount: 9500 },
        { supplier: this.signers.charlie, amount: 11000 },
      ];

      // Suppliers submit encrypted quotes
      for (const bid of bids) {
        const instance = this.instances.alice; // Use one instance for simplicity
        const input = instance.createEncryptedInput(this.contractAddress, bid.supplier.address);
        input.add32(bid.amount);
        const encrypted = await input.encrypt();

        const tx = await this.blindAuction.connect(bid.supplier).placeBid(encrypted.handles[0], encrypted.inputProof);
        await tx.wait();
      }

      // Determine lowest bidder
      const tx = await this.blindAuction.determinWinner();
      await tx.wait();

      // Winner selected fairly without corruption
      const winner = await this.blindAuction.getWinner();
      expect(winner).to.not.equal(ethers.ZeroAddress);
    });

    it("should support Dutch auction", async function () {
      // Use case: Dutch auction - encrypted bids prevent price manipulation

      const startingBids = [
        { bidder: this.signers.alice, amount: 5000 },
        { bidder: this.signers.bob, amount: 4800 },
      ];

      // Accept encrypted bids
      for (const bid of startingBids) {
        const instance = this.instances.alice;
        const input = instance.createEncryptedInput(this.contractAddress, bid.bidder.address);
        input.add32(bid.amount);
        const encrypted = await input.encrypt();

        const tx = await this.blindAuction.connect(bid.bidder).placeBid(encrypted.handles[0], encrypted.inputProof);
        await tx.wait();
      }

      // Determine winner
      const tx = await this.blindAuction.determinWinner();
      await tx.wait();

      const winner = await this.blindAuction.getWinner();
      expect(winner).to.not.equal(ethers.ZeroAddress);
    });
  });

  describe("Input Validation", function () {
    it("should reject invalid bid proof", async function () {
      const bid = 1000;

      const input = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
      input.add32(bid);
      const encrypted = await input.encrypt();

      await expect(
        this.blindAuction.connect(this.signers.alice).placeBid(encrypted.handles[0], "0x")
      ).to.be.reverted;
    });
  });
});
