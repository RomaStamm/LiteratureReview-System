import { expect } from "chai";
import { ethers } from "hardhat";
import { PublicDecryptMultipleValues } from "../../types";
import { createInstances } from "../instance";
import { getSigners, initSigners } from "../signers";
import { deployPublicDecryptMultipleValuesFixture } from "./PublicDecryptMultipleValues.fixture";

describe("PublicDecryptMultipleValues - Public Decryption for Multiple Values", function () {
  before(async function () {
    await initSigners();
    this.signers = await getSigners();
  });

  beforeEach(async function () {
    const contract = await deployPublicDecryptMultipleValuesFixture();
    this.contractAddress = await contract.getAddress();
    this.publicDecryptMultiple = contract;
    this.instances = await createInstances(this.contractAddress, ethers, this.signers);
  });

  it("should deploy contract successfully", async function () {
    expect(this.contractAddress).to.not.equal(ethers.ZeroAddress);
  });

  describe("Public Decryption of Multiple Values", function () {
    it("should decrypt multiple values publicly", async function () {
      const scores = { first: 100, second: 85, third: 70 };

      // Store encrypted scores
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(scores.first);
      input.add32(scores.second);
      input.add32(scores.third);
      const encrypted = await input.encrypt();

      let tx = await this.publicDecryptMultiple
        .connect(this.signers.alice)
        .setScores(encrypted.handles[0], encrypted.handles[1], encrypted.handles[2], encrypted.inputProof);
      await tx.wait();

      // Request public decryption
      tx = await this.publicDecryptMultiple.connect(this.signers.alice).revealScores();
      await tx.wait();

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Anyone can see all scores
      const revealed = await this.publicDecryptMultiple.getRevealedScores();
      expect(revealed.first).to.equal(BigInt(scores.first));
      expect(revealed.second).to.equal(BigInt(scores.second));
      expect(revealed.third).to.equal(BigInt(scores.third));
    });

    it("should support leaderboard revelation", async function () {
      // Use case: Reveal top 3 scores publicly

      const leaderboard = { first: 1000, second: 950, third: 900 };

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(leaderboard.first);
      input.add32(leaderboard.second);
      input.add32(leaderboard.third);
      const encrypted = await input.encrypt();

      let tx = await this.publicDecryptMultiple
        .connect(this.signers.alice)
        .setScores(encrypted.handles[0], encrypted.handles[1], encrypted.handles[2], encrypted.inputProof);
      await tx.wait();

      // Reveal leaderboard
      tx = await this.publicDecryptMultiple.connect(this.signers.alice).revealScores();
      await tx.wait();

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Public sees rankings
      const revealed = await this.publicDecryptMultiple.getRevealedScores();
      expect(revealed.first).to.equal(BigInt(leaderboard.first));
      expect(revealed.second).to.equal(BigInt(leaderboard.second));
      expect(revealed.third).to.equal(BigInt(leaderboard.third));
    });

    it("should support election results revelation", async function () {
      // Use case: Reveal election results

      const results = { candidate1: 5000, candidate2: 4500, candidate3: 3200 };

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(results.candidate1);
      input.add32(results.candidate2);
      input.add32(results.candidate3);
      const encrypted = await input.encrypt();

      let tx = await this.publicDecryptMultiple
        .connect(this.signers.alice)
        .setScores(encrypted.handles[0], encrypted.handles[1], encrypted.handles[2], encrypted.inputProof);
      await tx.wait();

      // Announce results
      tx = await this.publicDecryptMultiple.connect(this.signers.alice).revealScores();
      await tx.wait();

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Public sees results
      const revealed = await this.publicDecryptMultiple.getRevealedScores();
      expect(revealed.first).to.equal(BigInt(results.candidate1));
      expect(revealed.second).to.equal(BigInt(results.candidate2));
      expect(revealed.third).to.equal(BigInt(results.candidate3));
    });
  });

  describe("Selective Revelation", function () {
    it("should reveal multiple values permanently", async function () {
      const scores = { first: 95, second: 87, third: 76 };

      // Store scores
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(scores.first);
      input.add32(scores.second);
      input.add32(scores.third);
      const encrypted = await input.encrypt();

      let tx = await this.publicDecryptMultiple
        .connect(this.signers.alice)
        .setScores(encrypted.handles[0], encrypted.handles[1], encrypted.handles[2], encrypted.inputProof);
      await tx.wait();

      // Public revelation
      tx = await this.publicDecryptMultiple.connect(this.signers.alice).revealScores();
      await tx.wait();

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Multiple readers can see results
      const revealed1 = await this.publicDecryptMultiple.getRevealedScores();
      const revealed2 = await this.publicDecryptMultiple.getRevealedScores();

      expect(revealed1.first).to.equal(revealed2.first);
      expect(revealed1.second).to.equal(revealed2.second);
      expect(revealed1.third).to.equal(revealed2.third);
    });
  });

  describe("Comparison with User Decryption", function () {
    it("should demonstrate public vs user decryption difference", async function () {
      // User Decryption: Only authorized user sees plaintext
      // Public Decryption: Everyone sees plaintext (IRREVERSIBLE)

      const data = { value1: 100, value2: 200, value3: 300 };

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(data.value1);
      input.add32(data.value2);
      input.add32(data.value3);
      const encrypted = await input.encrypt();

      let tx = await this.publicDecryptMultiple
        .connect(this.signers.alice)
        .setScores(encrypted.handles[0], encrypted.handles[1], encrypted.handles[2], encrypted.inputProof);
      await tx.wait();

      // Public decryption
      tx = await this.publicDecryptMultiple.connect(this.signers.alice).revealScores();
      await tx.wait();

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Bob can see (no special permission needed)
      const revealed = await this.publicDecryptMultiple.getRevealedScores();
      expect(revealed.first).to.equal(BigInt(data.value1));
      expect(revealed.second).to.equal(BigInt(data.value2));
      expect(revealed.third).to.equal(BigInt(data.value3));

      // This shows: use public decryption ONLY for values meant to be public
    });
  });

  describe("Use Cases", function () {
    it("should support competitive ranking revelation", async function () {
      // Use case: Competition results ranking

      const rankings = { gold: 9800, silver: 9500, bronze: 9200 };

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(rankings.gold);
      input.add32(rankings.silver);
      input.add32(rankings.bronze);
      const encrypted = await input.encrypt();

      let tx = await this.publicDecryptMultiple
        .connect(this.signers.alice)
        .setScores(encrypted.handles[0], encrypted.handles[1], encrypted.handles[2], encrypted.inputProof);
      await tx.wait();

      // Announce winners
      tx = await this.publicDecryptMultiple.connect(this.signers.alice).revealScores();
      await tx.wait();

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Public ranking visible
      const revealed = await this.publicDecryptMultiple.getRevealedScores();
      expect(revealed.first).to.equal(BigInt(rankings.gold));
    });

    it("should support award announcement", async function () {
      // Use case: Award ceremony results

      const awards = { firstPlace: 10000, secondPlace: 7000, thirdPlace: 3000 };

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(awards.firstPlace);
      input.add32(awards.secondPlace);
      input.add32(awards.thirdPlace);
      const encrypted = await input.encrypt();

      let tx = await this.publicDecryptMultiple
        .connect(this.signers.alice)
        .setScores(encrypted.handles[0], encrypted.handles[1], encrypted.handles[2], encrypted.inputProof);
      await tx.wait();

      // Announce awards
      tx = await this.publicDecryptMultiple.connect(this.signers.alice).revealScores();
      await tx.wait();

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Awards publicly visible
      const revealed = await this.publicDecryptMultiple.getRevealedScores();
      expect(revealed.first).to.equal(BigInt(awards.firstPlace));
      expect(revealed.second).to.equal(BigInt(awards.secondPlace));
      expect(revealed.third).to.equal(BigInt(awards.thirdPlace));
    });
  });

  describe("Input Validation", function () {
    it("should reject invalid input proof", async function () {
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(100);
      input.add32(200);
      input.add32(300);
      const encrypted = await input.encrypt();

      await expect(
        this.publicDecryptMultiple
          .connect(this.signers.alice)
          .setScores(encrypted.handles[0], encrypted.handles[1], encrypted.handles[2], "0x")
      ).to.be.reverted;
    });
  });
});
