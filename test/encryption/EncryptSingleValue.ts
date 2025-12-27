import { expect } from "chai";
import { ethers } from "hardhat";
import { EncryptSingleValue } from "../../types";
import { createInstances } from "../instance";
import { getSigners, initSigners } from "../signers";
import { deployEncryptSingleValueFixture } from "./EncryptSingleValue.fixture";

describe("EncryptSingleValue - Single Value Encryption", function () {
  before(async function () {
    await initSigners();
    this.signers = await getSigners();
  });

  beforeEach(async function () {
    const contract = await deployEncryptSingleValueFixture();
    this.contractAddress = await contract.getAddress();
    this.encryptSingle = contract;
    this.instances = await createInstances(this.contractAddress, ethers, this.signers);
  });

  it("should deploy contract successfully", async function () {
    expect(this.contractAddress).to.not.equal(ethers.ZeroAddress);
  });

  describe("Single Value Encryption", function () {
    it("should encrypt and store a single value with valid proof", async function () {
      const secret = 12345;

      // Alice encrypts a value
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      // Alice submits encrypted value with proof
      const tx = await this.encryptSingle
        .connect(this.signers.alice)
        .setSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Alice can decrypt the value
      const stored = await this.encryptSingle.getSecret();
      const decrypted = await this.instances.alice.decrypt(this.contractAddress, stored);

      expect(decrypted).to.equal(BigInt(secret));
    });

    it("should store different values from different users", async function () {
      const aliceSecret = 11111;
      const bobSecret = 22222;

      // Alice encrypts and stores
      const inputAlice = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      inputAlice.add32(aliceSecret);
      const encryptedAlice = await inputAlice.encrypt();

      let tx = await this.encryptSingle
        .connect(this.signers.alice)
        .setSecret(encryptedAlice.handles[0], encryptedAlice.inputProof);
      await tx.wait();

      // Bob encrypts and stores (overwrites)
      const inputBob = this.instances.bob.createEncryptedInput(this.contractAddress, this.signers.bob.address);
      inputBob.add32(bobSecret);
      const encryptedBob = await inputBob.encrypt();

      tx = await this.encryptSingle
        .connect(this.signers.bob)
        .setSecret(encryptedBob.handles[0], encryptedBob.inputProof);
      await tx.wait();

      // Bob can decrypt his value
      const stored = await this.encryptSingle.getSecret();
      const decrypted = await this.instances.bob.decrypt(this.contractAddress, stored);

      expect(decrypted).to.equal(BigInt(bobSecret));
    });

    it("should handle zero value", async function () {
      const secret = 0;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      const tx = await this.encryptSingle
        .connect(this.signers.alice)
        .setSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      const stored = await this.encryptSingle.getSecret();
      const decrypted = await this.instances.alice.decrypt(this.contractAddress, stored);

      expect(decrypted).to.equal(BigInt(0));
    });

    it("should handle maximum uint32 value", async function () {
      const maxUint32 = 2 ** 32 - 1;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(maxUint32);
      const encrypted = await input.encrypt();

      const tx = await this.encryptSingle
        .connect(this.signers.alice)
        .setSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      const stored = await this.encryptSingle.getSecret();
      const decrypted = await this.instances.alice.decrypt(this.contractAddress, stored);

      expect(decrypted).to.equal(BigInt(maxUint32));
    });
  });

  describe("Input Proof Validation", function () {
    it("should reject invalid input proof", async function () {
      const secret = 12345;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      // Use invalid proof (empty bytes)
      await expect(
        this.encryptSingle.connect(this.signers.alice).setSecret(encrypted.handles[0], "0x")
      ).to.be.reverted;
    });

    it("should reject corrupted input proof", async function () {
      const secret = 12345;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      // Use corrupted proof (flip some bits)
      const corruptedProof = encrypted.inputProof.slice(0, -4) + "ffff";

      await expect(
        this.encryptSingle.connect(this.signers.alice).setSecret(encrypted.handles[0], corruptedProof)
      ).to.be.reverted;
    });
  });

  describe("Encryption Binding", function () {
    it("should reject proof from different user", async function () {
      const secret = 12345;

      // Alice encrypts
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      // Bob tries to use Alice's proof
      // Proof is bound to [contract, alice], not [contract, bob]
      await expect(
        this.encryptSingle.connect(this.signers.bob).setSecret(encrypted.handles[0], encrypted.inputProof)
      ).to.be.reverted;
    });

    it("should reject proof from different contract address", async function () {
      // This test demonstrates that encryption binding includes contract address
      // A proof is only valid for the specific contract it was encrypted for

      const secret = 12345;
      const wrongAddress = ethers.ZeroAddress;

      // Encrypt for wrong address (contract address must match)
      const input = this.instances.alice.createEncryptedInput(wrongAddress, this.signers.alice.address);
      input.add32(secret);
      const encrypted = await input.encrypt();

      // Try to submit to actual contract
      // Proof is bound to [wrongAddress, alice], not [contractAddress, alice]
      await expect(
        this.encryptSingle.connect(this.signers.alice).setSecret(encrypted.handles[0], encrypted.inputProof)
      ).to.be.reverted;
    });

    it("should accept proof only from binding signer", async function () {
      const secret = 12345;

      // Alice encrypts with explicit binding to her address
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address // Binding includes Alice's address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      // Only Alice can submit this proof
      const tx = await this.encryptSingle
        .connect(this.signers.alice)
        .setSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Verify
      const stored = await this.encryptSingle.getSecret();
      const decrypted = await this.instances.alice.decrypt(this.contractAddress, stored);

      expect(decrypted).to.equal(BigInt(secret));
    });
  });

  describe("Permission Management", function () {
    it("should grant proper permissions after storing encrypted value", async function () {
      const secret = 12345;

      // Alice stores encrypted value
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      const tx = await this.encryptSingle
        .connect(this.signers.alice)
        .setSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Alice should be able to decrypt
      const stored = await this.encryptSingle.getSecret();
      const decrypted = await this.instances.alice.decrypt(this.contractAddress, stored);

      expect(decrypted).to.equal(BigInt(secret));
    });

    it("should allow contract to read encrypted value", async function () {
      const secret = 12345;

      // Alice stores encrypted value
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      const tx = await this.encryptSingle
        .connect(this.signers.alice)
        .setSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Contract should be able to read it
      const stored = await this.encryptSingle.getSecret();

      // Contract operation: verify the value exists and can be operated on
      expect(stored).to.not.equal(ethers.ZeroHash);
    });
  });

  describe("Use Cases", function () {
    it("should support secret submission pattern", async function () {
      // Use case: User submits encrypted secret
      // Example: Private key backup, password, API key

      const userSecret = 987654321;

      // User encrypts secret locally
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(userSecret);
      const encrypted = await input.encrypt();

      // User submits to contract with proof
      const tx = await this.encryptSingle
        .connect(this.signers.alice)
        .setSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Only user can decrypt
      const stored = await this.encryptSingle.getSecret();
      const decrypted = await this.instances.alice.decrypt(this.contractAddress, stored);

      expect(decrypted).to.equal(BigInt(userSecret));
    });

    it("should support confidential data submission pattern", async function () {
      // Use case: Submit sensitive information without revealing to contract operators
      // Example: Salary, medical record, financial data

      const confidentialValue = 50000; // Example: salary

      // Employee encrypts their data
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(confidentialValue);
      const encrypted = await input.encrypt();

      // Submit to contract (contract sees only encrypted data)
      const tx = await this.encryptSingle
        .connect(this.signers.alice)
        .setSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Contract can perform operations on encrypted value without seeing plaintext
      const stored = await this.encryptSingle.getSecret();
      expect(stored).to.not.equal(ethers.ZeroHash);

      // Only employee can decrypt
      const decrypted = await this.instances.alice.decrypt(this.contractAddress, stored);
      expect(decrypted).to.equal(BigInt(confidentialValue));
    });
  });

  describe("Multiple Updates", function () {
    it("should allow updating encrypted value multiple times", async function () {
      const values = [100, 200, 300, 400, 500];

      for (const value of values) {
        const input = this.instances.alice.createEncryptedInput(
          this.contractAddress,
          this.signers.alice.address
        );
        input.add32(value);
        const encrypted = await input.encrypt();

        const tx = await this.encryptSingle
          .connect(this.signers.alice)
          .setSecret(encrypted.handles[0], encrypted.inputProof);
        await tx.wait();

        // Verify latest value
        const stored = await this.encryptSingle.getSecret();
        const decrypted = await this.instances.alice.decrypt(this.contractAddress, stored);

        expect(decrypted).to.equal(BigInt(value));
      }
    });

    it("should overwrite previous encrypted value on update", async function () {
      const value1 = 111;
      const value2 = 222;

      // Store first value
      let input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(value1);
      let encrypted = await input.encrypt();

      let tx = await this.encryptSingle
        .connect(this.signers.alice)
        .setSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Update with second value
      input = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
      input.add32(value2);
      encrypted = await input.encrypt();

      tx = await this.encryptSingle
        .connect(this.signers.alice)
        .setSecret(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Verify only second value is stored
      const stored = await this.encryptSingle.getSecret();
      const decrypted = await this.instances.alice.decrypt(this.contractAddress, stored);

      expect(decrypted).to.equal(BigInt(value2));
    });
  });
});
