import { expect } from "chai";
import { ethers } from "hardhat";
import { FHEAdd } from "../../types";
import { createInstances } from "../instance";
import { getSigners, initSigners } from "../signers";
import { deployFHEAddFixture } from "./FHEAdd.fixture";

describe("FHEAdd - Homomorphic Addition", function () {
  before(async function () {
    await initSigners();
    this.signers = await getSigners();
  });

  beforeEach(async function () {
    const contract = await deployFHEAddFixture();
    this.contractAddress = await contract.getAddress();
    this.fheAdd = contract;
    this.instances = await createInstances(this.contractAddress, ethers, this.signers);
  });

  it("should deploy contract successfully", async function () {
    expect(this.contractAddress).to.not.equal(ethers.ZeroAddress);
  });

  describe("Basic Addition Operations", function () {
    it("should add two encrypted values correctly", async function () {
      const value1 = 100;
      const value2 = 50;

      // Encrypt values from Alice's perspective
      const input1 = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
      input1.add32(value1);
      const encryptedValue1 = await input1.encrypt();

      const input2 = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
      input2.add32(value2);
      const encryptedValue2 = await input2.encrypt();

      // Store first value
      const tx1 = await this.fheAdd
        .connect(this.signers.alice)
        .addValue(encryptedValue1.handles[0], encryptedValue1.inputProof);
      await tx1.wait();

      // Add second value to first
      const tx2 = await this.fheAdd
        .connect(this.signers.alice)
        .addValue(encryptedValue2.handles[0], encryptedValue2.inputProof);
      await tx2.wait();

      // Decrypt and verify result
      const result = await this.fheAdd.getTotal();
      const decryptedResult = await this.instances.alice.decrypt(this.contractAddress, result);

      expect(decryptedResult).to.equal(BigInt(value1 + value2));
    });

    it("should accumulate multiple additions", async function () {
      const values = [10, 20, 30, 40, 50];
      let expectedSum = 0;

      for (const value of values) {
        expectedSum += value;

        const input = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
        input.add32(value);
        const encrypted = await input.encrypt();

        const tx = await this.fheAdd
          .connect(this.signers.alice)
          .addValue(encrypted.handles[0], encrypted.inputProof);
        await tx.wait();
      }

      // Verify total
      const result = await this.fheAdd.getTotal();
      const decryptedResult = await this.instances.alice.decrypt(this.contractAddress, result);

      expect(decryptedResult).to.equal(BigInt(expectedSum));
    });

    it("should handle zero addition", async function () {
      const value = 0;

      const input = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
      input.add32(value);
      const encrypted = await input.encrypt();

      const tx = await this.fheAdd
        .connect(this.signers.alice)
        .addValue(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      const result = await this.fheAdd.getTotal();
      const decryptedResult = await this.instances.alice.decrypt(this.contractAddress, result);

      expect(decryptedResult).to.equal(BigInt(0));
    });

    it("should handle maximum uint32 values", async function () {
      const maxUint32 = 2 ** 32 - 1;
      const value = maxUint32;

      const input = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
      input.add32(value);
      const encrypted = await input.encrypt();

      const tx = await this.fheAdd
        .connect(this.signers.alice)
        .addValue(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      const result = await this.fheAdd.getTotal();
      const decryptedResult = await this.instances.alice.decrypt(this.contractAddress, result);

      expect(decryptedResult).to.equal(BigInt(value));
    });
  });

  describe("Permission Management", function () {
    it("should grant permissions correctly after addition", async function () {
      const value = 100;

      const input = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
      input.add32(value);
      const encrypted = await input.encrypt();

      const tx = await this.fheAdd
        .connect(this.signers.alice)
        .addValue(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Alice should be able to decrypt
      const result = await this.fheAdd.getTotal();
      const decrypted = await this.instances.alice.decrypt(this.contractAddress, result);

      expect(decrypted).to.equal(BigInt(value));
    });

    it("should allow contract to use encrypted values", async function () {
      const value1 = 50;
      const value2 = 75;

      // Add first value
      const input1 = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
      input1.add32(value1);
      const encrypted1 = await input1.encrypt();

      await this.fheAdd
        .connect(this.signers.alice)
        .addValue(encrypted1.handles[0], encrypted1.inputProof);

      // Add second value (contract must have permission to add to existing total)
      const input2 = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
      input2.add32(value2);
      const encrypted2 = await input2.encrypt();

      const tx = await this.fheAdd
        .connect(this.signers.alice)
        .addValue(encrypted2.handles[0], encrypted2.inputProof);
      await tx.wait();

      // Verify result
      const result = await this.fheAdd.getTotal();
      const decrypted = await this.instances.alice.decrypt(this.contractAddress, result);

      expect(decrypted).to.equal(BigInt(value1 + value2));
    });
  });

  describe("Multiple Users", function () {
    it("should allow different users to add values", async function () {
      const aliceValue = 100;
      const bobValue = 200;

      // Alice adds value
      const inputAlice = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      inputAlice.add32(aliceValue);
      const encryptedAlice = await inputAlice.encrypt();

      await this.fheAdd
        .connect(this.signers.alice)
        .addValue(encryptedAlice.handles[0], encryptedAlice.inputProof);

      // Bob adds value
      const inputBob = this.instances.bob.createEncryptedInput(this.contractAddress, this.signers.bob.address);
      inputBob.add32(bobValue);
      const encryptedBob = await inputBob.encrypt();

      await this.fheAdd.connect(this.signers.bob).addValue(encryptedBob.handles[0], encryptedBob.inputProof);

      // Alice verifies total
      const result = await this.fheAdd.getTotal();
      const decrypted = await this.instances.alice.decrypt(this.contractAddress, result);

      expect(decrypted).to.equal(BigInt(aliceValue + bobValue));
    });
  });

  describe("Edge Cases", function () {
    it("should handle adding same value multiple times", async function () {
      const value = 50;
      const count = 5;

      for (let i = 0; i < count; i++) {
        const input = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
        input.add32(value);
        const encrypted = await input.encrypt();

        await this.fheAdd
          .connect(this.signers.alice)
          .addValue(encrypted.handles[0], encrypted.inputProof);
      }

      const result = await this.fheAdd.getTotal();
      const decrypted = await this.instances.alice.decrypt(this.contractAddress, result);

      expect(decrypted).to.equal(BigInt(value * count));
    });

    it("should maintain accuracy with large accumulated sums", async function () {
      const values = [1000000, 2000000, 3000000, 4000000];
      let expectedSum = 0;

      for (const value of values) {
        expectedSum += value;

        const input = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
        input.add32(value);
        const encrypted = await input.encrypt();

        await this.fheAdd
          .connect(this.signers.alice)
          .addValue(encrypted.handles[0], encrypted.inputProof);
      }

      const result = await this.fheAdd.getTotal();
      const decrypted = await this.instances.alice.decrypt(this.contractAddress, result);

      expect(decrypted).to.equal(BigInt(expectedSum));
    });
  });

  describe("Input Validation", function () {
    it("should reject invalid input proof", async function () {
      const value = 100;

      const input = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
      input.add32(value);
      const encrypted = await input.encrypt();

      // Use invalid proof (empty bytes)
      await expect(
        this.fheAdd.connect(this.signers.alice).addValue(encrypted.handles[0], "0x")
      ).to.be.reverted;
    });

    it("should reject mismatched encryption signer", async function () {
      const value = 100;

      // Alice encrypts
      const input = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
      input.add32(value);
      const encrypted = await input.encrypt();

      // Bob tries to submit Alice's encrypted value
      await expect(
        this.fheAdd.connect(this.signers.bob).addValue(encrypted.handles[0], encrypted.inputProof)
      ).to.be.reverted;
    });
  });
});
