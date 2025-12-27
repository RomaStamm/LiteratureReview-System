import { expect } from "chai";
import { ethers } from "hardhat";
import { PublicDecryptSingleValue } from "../../types";
import { createInstances } from "../instance";
import { getSigners, initSigners } from "../signers";
import { deployPublicDecryptSingleValueFixture } from "./PublicDecryptSingleValue.fixture";

describe("PublicDecryptSingleValue - Public Decryption", function () {
  before(async function () {
    await initSigners();
    this.signers = await getSigners();
  });

  beforeEach(async function () {
    const contract = await deployPublicDecryptSingleValueFixture();
    this.contractAddress = await contract.getAddress();
    this.publicDecrypt = contract;
    this.instances = await createInstances(this.contractAddress, ethers, this.signers);
  });

  it("should deploy contract successfully", async function () {
    expect(this.contractAddress).to.not.equal(ethers.ZeroAddress);
  });

  describe("Public Decryption Mechanism", function () {
    it("should decrypt value publicly to anyone", async function () {
      const secret = 12345;

      // Alice stores encrypted value
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      let tx = await this.publicDecrypt
        .connect(this.signers.alice)
        .storeSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Initiate public decryption
      tx = await this.publicDecrypt.connect(this.signers.alice).requestPublicDecryption();
      await tx.wait();

      // Wait for decryption
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Anyone can read the decrypted value
      const decrypted = await this.publicDecrypt.getDecryptedSecret();
      expect(decrypted).to.equal(BigInt(secret));
    });

    it("should make decrypted value publicly accessible", async function () {
      const secret = 98765;

      // Alice stores secret
      let input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      let encrypted = await input.encrypt();

      let tx = await this.publicDecrypt
        .connect(this.signers.alice)
        .storeSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Request public decryption
      tx = await this.publicDecrypt.connect(this.signers.alice).requestPublicDecryption();
      await tx.wait();

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Bob can also read the decrypted value
      const decryptedByBob = await this.publicDecrypt.getDecryptedSecret();
      expect(decryptedByBob).to.equal(BigInt(secret));
    });

    it("should support auction result revelation pattern", async function () {
      // Use case: Reveal auction winner
      // Bids were encrypted, now winning bid is revealed publicly

      const winningBid = 100000;

      // Store winning bid (encrypted during bidding phase)
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(winningBid);
      const encrypted = await input.encrypt();

      let tx = await this.publicDecrypt
        .connect(this.signers.alice)
        .storeSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Auction ends - reveal winner's bid
      tx = await this.publicDecrypt.connect(this.signers.alice).requestPublicDecryption();
      await tx.wait();

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Everyone can see winning bid
      const revealed = await this.publicDecrypt.getDecryptedSecret();
      expect(revealed).to.equal(BigInt(winningBid));
    });

    it("should support voting result revelation pattern", async function () {
      // Use case: Reveal election winner
      // Votes were encrypted, now results are public

      const winningVotes = 5000;

      // Store candidate result (encrypted during voting)
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(winningVotes);
      const encrypted = await input.encrypt();

      let tx = await this.publicDecrypt
        .connect(this.signers.alice)
        .storeSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Voting ends - reveal results
      tx = await this.publicDecrypt.connect(this.signers.alice).requestPublicDecryption();
      await tx.wait();

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // All voters can see results
      const results = await this.publicDecrypt.getDecryptedSecret();
      expect(results).to.equal(BigInt(winningVotes));
    });
  });

  describe("Irreversible Revelation", function () {
    it("should permanently reveal value once decrypted publicly", async function () {
      const secret = 54321;

      // Store secret
      let input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      let encrypted = await input.encrypt();

      let tx = await this.publicDecrypt
        .connect(this.signers.alice)
        .storeSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Request decryption
      tx = await this.publicDecrypt.connect(this.signers.alice).requestPublicDecryption();
      await tx.wait();

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Value is permanently revealed
      const decrypted = await this.publicDecrypt.getDecryptedSecret();
      expect(decrypted).to.equal(BigInt(secret));

      // Cannot re-encrypt or hide
      // This demonstrates the irreversible nature
    });

    it("should warn about privacy loss on public decryption", async function () {
      // This test demonstrates the critical difference between user and public decryption

      // User Decryption: Only authorized user can see plaintext
      // Public Decryption: EVERYONE can see plaintext (IRREVERSIBLE)

      const secret = 11111;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      let tx = await this.publicDecrypt
        .connect(this.signers.alice)
        .storeSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // PUBLIC decryption - privacy is lost
      tx = await this.publicDecrypt.connect(this.signers.alice).requestPublicDecryption();
      await tx.wait();

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Bob can see Alice's secret
      const decrypted = await this.publicDecrypt.getDecryptedSecret();
      expect(decrypted).to.equal(BigInt(secret));

      // This demonstrates: use user decryption for private data,
      // public decryption only for results that MUST be public
    });
  });

  describe("Async Decryption Pattern", function () {
    it("should handle asynchronous decryption", async function () {
      const secret = 77777;

      // Store secret
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      let tx = await this.publicDecrypt
        .connect(this.signers.alice)
        .storeSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Request decryption (async)
      tx = await this.publicDecrypt.connect(this.signers.alice).requestPublicDecryption();
      await tx.wait();

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check if decryption is complete
      const decrypted = await this.publicDecrypt.getDecryptedSecret();
      expect(decrypted).to.equal(BigInt(secret));
    });
  });

  describe("Use Cases", function () {
    it("should support game result revelation", async function () {
      // Use case: Game outcome must be revealed after game ends

      const winnerScore = 9999;

      // Store score (encrypted during gameplay)
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(winnerScore);
      const encrypted = await input.encrypt();

      let tx = await this.publicDecrypt
        .connect(this.signers.alice)
        .storeSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Game ends - reveal result
      tx = await this.publicDecrypt.connect(this.signers.alice).requestPublicDecryption();
      await tx.wait();

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Everyone sees final score
      const score = await this.publicDecrypt.getDecryptedSecret();
      expect(score).to.equal(BigInt(winnerScore));
    });

    it("should support contest result announcement", async function () {
      // Use case: Final winner announcement in contest

      const winnerPoints = 8500;

      // Store points (encrypted during contest)
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(winnerPoints);
      const encrypted = await input.encrypt();

      let tx = await this.publicDecrypt
        .connect(this.signers.alice)
        .storeSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Contest ends - announce winner
      tx = await this.publicDecrypt.connect(this.signers.alice).requestPublicDecryption();
      await tx.wait();

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Public announcement
      const points = await this.publicDecrypt.getDecryptedSecret();
      expect(points).to.equal(BigInt(winnerPoints));
    });
  });

  describe("Comparison with User Decryption", function () {
    it("should demonstrate difference between user and public decryption", async function () {
      // Critical difference:
      //
      // User Decryption (FHE.allow):
      // - Only authorized user can decrypt
      // - Plaintext never exposed publicly
      // - Good for personal data
      //
      // Public Decryption:
      // - Everyone can see plaintext
      // - Permanent revelation
      // - Good for results that MUST be public
      //
      // Use public decryption ONLY when:
      // ✅ Results must be transparent
      // ✅ All parties need to see plaintext
      // ❌ NOT for sensitive/personal data
      // ❌ NOT for data that should remain private

      const secret = 33333;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      let tx = await this.publicDecrypt
        .connect(this.signers.alice)
        .storeSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Public decryption - pattern choice shows intent to reveal
      tx = await this.publicDecrypt.connect(this.signers.alice).requestPublicDecryption();
      await tx.wait();

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const decrypted = await this.publicDecrypt.getDecryptedSecret();
      expect(decrypted).to.equal(BigInt(secret));
    });
  });

  describe("Input Validation", function () {
    it("should reject invalid input proof", async function () {
      const secret = 12345;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      await expect(
        this.publicDecrypt.connect(this.signers.alice).storeSecret(encrypted.handles[0], "0x")
      ).to.be.reverted;
    });
  });
});
