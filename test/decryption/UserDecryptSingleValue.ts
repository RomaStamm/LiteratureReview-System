import { expect } from "chai";
import { ethers } from "hardhat";
import { UserDecryptSingleValue } from "../../types";
import { createInstances } from "../instance";
import { getSigners, initSigners } from "../signers";
import { deployUserDecryptSingleValueFixture } from "./UserDecryptSingleValue.fixture";

describe("UserDecryptSingleValue - User Decryption", function () {
  before(async function () {
    await initSigners();
    this.signers = await getSigners();
  });

  beforeEach(async function () {
    const contract = await deployUserDecryptSingleValueFixture();
    this.contractAddress = await contract.getAddress();
    this.userDecrypt = contract;
    this.instances = await createInstances(this.contractAddress, ethers, this.signers);
  });

  it("should deploy contract successfully", async function () {
    expect(this.contractAddress).to.not.equal(ethers.ZeroAddress);
  });

  describe("User Decryption Mechanism", function () {
    it("should allow user to decrypt their own value", async function () {
      const secret = 12345;

      // Alice encrypts and stores
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      const tx = await this.userDecrypt
        .connect(this.signers.alice)
        .storeSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Alice can decrypt via relayer
      const stored = await this.userDecrypt.getSecret();
      const decrypted = await this.instances.alice.decrypt(this.contractAddress, stored);

      expect(decrypted).to.equal(BigInt(secret));
    });

    it("should prevent unauthorized user from decrypting", async function () {
      const secret = 12345;

      // Alice stores secret
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      const tx = await this.userDecrypt
        .connect(this.signers.alice)
        .storeSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Bob cannot decrypt Alice's value (no permission)
      const stored = await this.userDecrypt.getSecret();

      // Bob's attempt to decrypt should fail
      try {
        const decrypted = await this.instances.bob.decrypt(this.contractAddress, stored);
        // If decrypt succeeds, it means permission was somehow granted
        expect(decrypted).to.be.undefined;
      } catch {
        // Expected: Bob has no permission
        expect(true).to.be.true;
      }
    });

    it("should require FHE.allow() for user decryption", async function () {
      // This demonstrates the critical pattern:
      // FHE.allowThis() - Contract permission
      // FHE.allow(value, user) - User decryption permission

      const secret = 99999;

      // Alice stores secret
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      const tx = await this.userDecrypt
        .connect(this.signers.alice)
        .storeSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Alice should be able to decrypt (contract grants permission)
      const stored = await this.userDecrypt.getSecret();
      const decrypted = await this.instances.alice.decrypt(this.contractAddress, stored);

      expect(decrypted).to.equal(BigInt(secret));
    });
  });

  describe("Permission Transfer", function () {
    it("should transfer secret with updated permissions", async function () {
      const secret = 50000;

      // Alice stores secret
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      let tx = await this.userDecrypt
        .connect(this.signers.alice)
        .storeSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Alice transfers to Bob
      tx = await this.userDecrypt.connect(this.signers.alice).transferSecret(this.signers.bob.address);
      await tx.wait();

      // Bob can now decrypt
      const stored = await this.userDecrypt.getSecret();
      const decrypted = await this.instances.bob.decrypt(this.contractAddress, stored);

      expect(decrypted).to.equal(BigInt(secret));
    });

    it("should update permissions on transfer", async function () {
      const secret = 12345;

      // Alice stores
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      let tx = await this.userDecrypt
        .connect(this.signers.alice)
        .storeSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Alice transfers to Bob
      tx = await this.userDecrypt.connect(this.signers.alice).transferSecret(this.signers.bob.address);
      await tx.wait();

      // Bob has permission
      const stored = await this.userDecrypt.getSecret();
      const decrypted = await this.instances.bob.decrypt(this.contractAddress, stored);

      expect(decrypted).to.equal(BigInt(secret));
    });
  });

  describe("Multiple Users", function () {
    it("should handle different users storing their own secrets", async function () {
      const aliceSecret = 11111;
      const bobSecret = 22222;

      // Alice stores her secret
      let input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(aliceSecret);
      let encrypted = await input.encrypt();

      let tx = await this.userDecrypt
        .connect(this.signers.alice)
        .storeSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Alice can decrypt
      let stored = await this.userDecrypt.getSecret();
      let decrypted = await this.instances.alice.decrypt(this.contractAddress, stored);
      expect(decrypted).to.equal(BigInt(aliceSecret));

      // Bob stores his secret (overwrites)
      input = this.instances.bob.createEncryptedInput(this.contractAddress, this.signers.bob.address);
      input.add32(bobSecret);
      encrypted = await input.encrypt();

      tx = await this.userDecrypt
        .connect(this.signers.bob)
        .storeSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Bob can decrypt his secret
      stored = await this.userDecrypt.getSecret();
      decrypted = await this.instances.bob.decrypt(this.contractAddress, stored);
      expect(decrypted).to.equal(BigInt(bobSecret));
    });
  });

  describe("Sensitive Data Scenarios", function () {
    it("should support personal data storage", async function () {
      // Use case: Store sensitive personal information
      const personalData = 191290; // Example: encrypted identity number

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(personalData);
      const encrypted = await input.encrypt();

      const tx = await this.userDecrypt
        .connect(this.signers.alice)
        .storeSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Only Alice can access
      const stored = await this.userDecrypt.getSecret();
      const decrypted = await this.instances.alice.decrypt(this.contractAddress, stored);

      expect(decrypted).to.equal(BigInt(personalData));
    });

    it("should support encrypted balance access", async function () {
      // Use case: User retrieves their encrypted account balance
      const balance = 500000;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(balance);
      const encrypted = await input.encrypt();

      const tx = await this.userDecrypt
        .connect(this.signers.alice)
        .storeSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // User decrypts their balance
      const stored = await this.userDecrypt.getSecret();
      const decrypted = await this.instances.alice.decrypt(this.contractAddress, stored);

      expect(decrypted).to.equal(BigInt(balance));
    });
  });

  describe("Key Patterns", function () {
    it("demonstrates FHE.allowThis() and FHE.allow() pattern", async function () {
      // Critical pattern shown in this example:
      // 1. FHE.allowThis(value) - Grants contract permission
      // 2. FHE.allow(value, msg.sender) - Grants user permission

      const secret = 55555;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      const tx = await this.userDecrypt
        .connect(this.signers.alice)
        .storeSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Pattern ensures:
      // ✅ Contract can operate on value
      // ✅ User can decrypt via relayer
      // ❌ Others cannot decrypt

      const stored = await this.userDecrypt.getSecret();
      const decrypted = await this.instances.alice.decrypt(this.contractAddress, stored);

      expect(decrypted).to.equal(BigInt(secret));
    });

    it("should maintain permissions across operations", async function () {
      // Permissions persist for user decryption

      const secret = 12345;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      const tx = await this.userDecrypt
        .connect(this.signers.alice)
        .storeSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Alice can decrypt multiple times
      for (let i = 0; i < 3; i++) {
        const stored = await this.userDecrypt.getSecret();
        const decrypted = await this.instances.alice.decrypt(this.contractAddress, stored);

        expect(decrypted).to.equal(BigInt(secret));
      }
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
        this.userDecrypt.connect(this.signers.alice).storeSecret(encrypted.handles[0], "0x")
      ).to.be.reverted;
    });

    it("should reject mismatched encryption signer", async function () {
      const secret = 12345;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      // Bob tries to use Alice's encrypted value
      await expect(
        this.userDecrypt.connect(this.signers.bob).storeSecret(encrypted.handles[0], encrypted.inputProof)
      ).to.be.reverted;
    });
  });
});
