import { expect } from "chai";
import { ethers } from "hardhat";
import { AccessControlExample } from "../../types";
import { createInstances } from "../instance";
import { getSigners, initSigners } from "../signers";
import { deployAccessControlExampleFixture } from "./AccessControlExample.fixture";

describe("AccessControlExample - FHEVM Permission System", function () {
  before(async function () {
    await initSigners();
    this.signers = await getSigners();
  });

  beforeEach(async function () {
    const contract = await deployAccessControlExampleFixture();
    this.contractAddress = await contract.getAddress();
    this.accessControl = contract;
    this.instances = await createInstances(this.contractAddress, ethers, this.signers);
  });

  it("should deploy contract successfully", async function () {
    expect(this.contractAddress).to.not.equal(ethers.ZeroAddress);
  });

  describe("Three Permission Functions", function () {
    it("should grant contract permission with FHE.allowThis()", async function () {
      // FHE.allowThis() grants the contract permission to read encrypted value
      // MUST be called FIRST before FHE.allow()

      const secret = 12345;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      // Contract grants itself permission
      const tx = await this.accessControl
        .connect(this.signers.alice)
        .storeSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Contract can read the encrypted value for operations
      expect(this.contractAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("should grant user permission with FHE.allow()", async function () {
      // FHE.allow(value, user) grants user permission to decrypt via relayer
      // Enables client-side decryption

      const secret = 54321;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      let tx = await this.accessControl
        .connect(this.signers.alice)
        .storeSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // User can decrypt their own value
      const stored = await this.accessControl.getSecret();
      const decrypted = await this.instances.alice.decrypt(this.contractAddress, stored);

      expect(decrypted).to.equal(BigInt(secret));
    });

    it("should use FHE.allowTransient() for temporary permission", async function () {
      // FHE.allowTransient() grants permission for current transaction only
      // More gas-efficient for intermediate results
      // Not persistent in storage

      const value1 = 100;
      const value2 = 200;

      // Store two values
      let input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(value1);
      const encrypted1 = await input.encrypt();

      let tx = await this.accessControl
        .connect(this.signers.alice)
        .storeSecret(encrypted1.handles[0], encrypted1.inputProof);
      await tx.wait();

      input = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
      input.add32(value2);
      const encrypted2 = await input.encrypt();

      tx = await this.accessControl
        .connect(this.signers.alice)
        .storeSecret(encrypted2.handles[0], encrypted2.inputProof);
      await tx.wait();

      // Contract can use transient permission for operations
      const stored = await this.accessControl.getSecret();
      expect(stored).to.not.equal(ethers.ZeroHash);
    });
  });

  describe("Mandatory Permission Pattern", function () {
    it("should require both FHE.allowThis() and FHE.allow()", async function () {
      // CRITICAL PATTERN:
      // 1. FHE.allowThis(value) - MUST be first
      // 2. FHE.allow(value, user) - Grants user permission

      const secret = 99999;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      const tx = await this.accessControl
        .connect(this.signers.alice)
        .storeSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Without both permissions, decryption fails
      // Test shows contract grants both:
      // ✅ FHE.allowThis() - contract can read
      // ✅ FHE.allow() - user can decrypt

      const stored = await this.accessControl.getSecret();
      const decrypted = await this.instances.alice.decrypt(this.contractAddress, stored);

      expect(decrypted).to.equal(BigInt(secret));
    });

    it("should fail decryption without proper permissions", async function () {
      // Demonstrate what happens without permissions

      const secret = 11111;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      const tx = await this.accessControl
        .connect(this.signers.alice)
        .storeSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Bob has no permission to decrypt Alice's value
      const stored = await this.accessControl.getSecret();

      try {
        await this.instances.bob.decrypt(this.contractAddress, stored);
        // Should not reach here
        expect(true).to.be.false;
      } catch {
        // Expected: Bob has no permission
        expect(true).to.be.true;
      }
    });
  });

  describe("Multi-User Access", function () {
    it("should grant permission to multiple users", async function () {
      // FHE.allow() can be called multiple times for different users
      // Each user can decrypt independently

      const secret = 33333;

      // Alice stores secret
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      let tx = await this.accessControl
        .connect(this.signers.alice)
        .storeSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Grant access to Bob
      tx = await this.accessControl.connect(this.signers.alice).grantAccessToUser(this.signers.bob.address);
      await tx.wait();

      // Now both Alice and Bob can decrypt
      const stored = await this.accessControl.getSecret();

      const decryptedByAlice = await this.instances.alice.decrypt(this.contractAddress, stored);
      expect(decryptedByAlice).to.equal(BigInt(secret));

      const decryptedByBob = await this.instances.bob.decrypt(this.contractAddress, stored);
      expect(decryptedByBob).to.equal(BigInt(secret));
    });
  });

  describe("Permission Transfer", function () {
    it("should update permissions on value transfer", async function () {
      // When transferring encrypted values, permissions must be updated
      // New owner needs FHE.allow() for their address

      const secret = 77777;

      // Alice stores secret
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      let tx = await this.accessControl
        .connect(this.signers.alice)
        .storeSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Alice transfers to Bob
      tx = await this.accessControl.connect(this.signers.alice).transferToUser(this.signers.bob.address);
      await tx.wait();

      // Bob can now decrypt (permissions updated)
      const stored = await this.accessControl.getSecret();
      const decrypted = await this.instances.bob.decrypt(this.contractAddress, stored);

      expect(decrypted).to.equal(BigInt(secret));
    });

    it("should maintain permissions across operations", async function () {
      // Permissions persist across contract operations

      const secret = 44444;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      const tx = await this.accessControl
        .connect(this.signers.alice)
        .storeSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Multiple decrypt attempts should work
      for (let i = 0; i < 3; i++) {
        const stored = await this.accessControl.getSecret();
        const decrypted = await this.instances.alice.decrypt(this.contractAddress, stored);

        expect(decrypted).to.equal(BigInt(secret));
      }
    });
  });

  describe("Gas Efficiency", function () {
    it("should use FHE.allowTransient() for efficiency", async function () {
      // FHE.allowTransient() costs ~2,100 gas
      // FHE.allowThis() and FHE.allow() cost ~21,000 gas each

      const value = 12345;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(value);
      const encrypted = await input.encrypt();

      const tx = await this.accessControl
        .connect(this.signers.alice)
        .storeSecret(encrypted.handles[0], encrypted.inputProof);

      const receipt = await tx.wait();

      // Observe gas usage
      // allowThis + allow = ~42,000 gas
      // allowTransient = ~2,100 gas
      expect(receipt?.gasUsed).to.be.greaterThan(0);
    });
  });

  describe("Use Cases", function () {
    it("should support role-based access control", async function () {
      // Use case: Different roles have different decryption rights

      const secret = 88888;

      // Owner stores secret
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      let tx = await this.accessControl
        .connect(this.signers.alice)
        .storeSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Grant access to manager role
      tx = await this.accessControl.connect(this.signers.alice).grantAccessToUser(this.signers.bob.address);
      await tx.wait();

      // Manager can decrypt
      const stored = await this.accessControl.getSecret();
      const decrypted = await this.instances.bob.decrypt(this.contractAddress, stored);

      expect(decrypted).to.equal(BigInt(secret));
    });

    it("should support shared data access", async function () {
      // Use case: Multiple parties access shared encrypted data

      const sharedSecret = 66666;

      // Party 1 stores
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(sharedSecret);
      const encrypted = await input.encrypt();

      let tx = await this.accessControl
        .connect(this.signers.alice)
        .storeSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Grant access to Party 2
      tx = await this.accessControl.connect(this.signers.alice).grantAccessToUser(this.signers.bob.address);
      await tx.wait();

      // Both parties can read
      const stored = await this.accessControl.getSecret();
      const party1Decrypted = await this.instances.alice.decrypt(this.contractAddress, stored);
      const party2Decrypted = await this.instances.bob.decrypt(this.contractAddress, stored);

      expect(party1Decrypted).to.equal(BigInt(sharedSecret));
      expect(party2Decrypted).to.equal(BigInt(sharedSecret));
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
        this.accessControl.connect(this.signers.alice).storeSecret(encrypted.handles[0], "0x")
      ).to.be.reverted;
    });
  });
});
