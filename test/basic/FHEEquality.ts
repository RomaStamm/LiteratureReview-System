import { expect } from "chai";
import { ethers } from "hardhat";
import { FHEEquality } from "../../types";
import { createInstances } from "../instance";
import { getSigners, initSigners } from "../signers";
import { deployFHEEqualityFixture } from "./FHEEquality.fixture";

describe("FHEEquality - Encrypted Equality Comparison", function () {
  before(async function () {
    await initSigners();
    this.signers = await getSigners();
  });

  beforeEach(async function () {
    const contract = await deployFHEEqualityFixture();
    this.contractAddress = await contract.getAddress();
    this.fheEquality = contract;
    this.instances = await createInstances(this.contractAddress, ethers, this.signers);
  });

  it("should deploy contract successfully", async function () {
    expect(this.contractAddress).to.not.equal(ethers.ZeroAddress);
  });

  describe("Basic Equality Comparison", function () {
    it("should compare equal encrypted values", async function () {
      const value = 42;

      // Encrypt value1
      const input1 = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
      input1.add32(value);
      const encrypted1 = await input1.encrypt();

      // Encrypt value2 (same value)
      const input2 = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
      input2.add32(value);
      const encrypted2 = await input2.encrypt();

      // Store values
      let tx = await this.fheEquality
        .connect(this.signers.alice)
        .setValue1(encrypted1.handles[0], encrypted1.inputProof);
      await tx.wait();

      tx = await this.fheEquality
        .connect(this.signers.alice)
        .setValue2(encrypted2.handles[0], encrypted2.inputProof);
      await tx.wait();

      // Compare (should be equal)
      tx = await this.fheEquality.connect(this.signers.alice).compareValues();
      await tx.wait();

      // Get result
      const resultHandle = await this.fheEquality.getComparisonResult();
      const decryptedResult = await this.instances.alice.decrypt(this.contractAddress, resultHandle);

      expect(decryptedResult).to.equal(BigInt(1)); // true = 1
    });

    it("should detect unequal encrypted values", async function () {
      const value1 = 42;
      const value2 = 99;

      // Encrypt different values
      const input1 = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
      input1.add32(value1);
      const encrypted1 = await input1.encrypt();

      const input2 = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
      input2.add32(value2);
      const encrypted2 = await input2.encrypt();

      // Store values
      let tx = await this.fheEquality
        .connect(this.signers.alice)
        .setValue1(encrypted1.handles[0], encrypted1.inputProof);
      await tx.wait();

      tx = await this.fheEquality
        .connect(this.signers.alice)
        .setValue2(encrypted2.handles[0], encrypted2.inputProof);
      await tx.wait();

      // Compare (should be unequal)
      tx = await this.fheEquality.connect(this.signers.alice).compareValues();
      await tx.wait();

      // Get result
      const resultHandle = await this.fheEquality.getComparisonResult();
      const decryptedResult = await this.instances.alice.decrypt(this.contractAddress, resultHandle);

      expect(decryptedResult).to.equal(BigInt(0)); // false = 0
    });

    it("should handle zero equality", async function () {
      const value = 0;

      // Encrypt zeros
      const input1 = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
      input1.add32(value);
      const encrypted1 = await input1.encrypt();

      const input2 = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
      input2.add32(value);
      const encrypted2 = await input2.encrypt();

      // Store values
      let tx = await this.fheEquality
        .connect(this.signers.alice)
        .setValue1(encrypted1.handles[0], encrypted1.inputProof);
      await tx.wait();

      tx = await this.fheEquality
        .connect(this.signers.alice)
        .setValue2(encrypted2.handles[0], encrypted2.inputProof);
      await tx.wait();

      // Compare
      tx = await this.fheEquality.connect(this.signers.alice).compareValues();
      await tx.wait();

      // Get result
      const resultHandle = await this.fheEquality.getComparisonResult();
      const decryptedResult = await this.instances.alice.decrypt(this.contractAddress, resultHandle);

      expect(decryptedResult).to.equal(BigInt(1)); // 0 == 0 = true
    });

    it("should handle maximum uint32 values", async function () {
      const maxUint32 = 2 ** 32 - 1;

      // Encrypt max values
      const input1 = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
      input1.add32(maxUint32);
      const encrypted1 = await input1.encrypt();

      const input2 = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
      input2.add32(maxUint32);
      const encrypted2 = await input2.encrypt();

      // Store values
      let tx = await this.fheEquality
        .connect(this.signers.alice)
        .setValue1(encrypted1.handles[0], encrypted1.inputProof);
      await tx.wait();

      tx = await this.fheEquality
        .connect(this.signers.alice)
        .setValue2(encrypted2.handles[0], encrypted2.inputProof);
      await tx.wait();

      // Compare
      tx = await this.fheEquality.connect(this.signers.alice).compareValues();
      await tx.wait();

      // Get result
      const resultHandle = await this.fheEquality.getComparisonResult();
      const decryptedResult = await this.instances.alice.decrypt(this.contractAddress, resultHandle);

      expect(decryptedResult).to.equal(BigInt(1)); // equal
    });
  });

  describe("Multiple Comparisons", function () {
    it("should handle sequential comparisons", async function () {
      const testCases = [
        { val1: 10, val2: 10, expected: 1 }, // equal
        { val1: 10, val2: 20, expected: 0 }, // not equal
        { val1: 0, val2: 0, expected: 1 }, // equal
        { val1: 100, val2: 50, expected: 0 }, // not equal
      ];

      for (const testCase of testCases) {
        // Encrypt values
        const input1 = this.instances.alice.createEncryptedInput(
          this.contractAddress,
          this.signers.alice.address
        );
        input1.add32(testCase.val1);
        const encrypted1 = await input1.encrypt();

        const input2 = this.instances.alice.createEncryptedInput(
          this.contractAddress,
          this.signers.alice.address
        );
        input2.add32(testCase.val2);
        const encrypted2 = await input2.encrypt();

        // Store values
        let tx = await this.fheEquality
          .connect(this.signers.alice)
          .setValue1(encrypted1.handles[0], encrypted1.inputProof);
        await tx.wait();

        tx = await this.fheEquality
          .connect(this.signers.alice)
          .setValue2(encrypted2.handles[0], encrypted2.inputProof);
        await tx.wait();

        // Compare
        tx = await this.fheEquality.connect(this.signers.alice).compareValues();
        await tx.wait();

        // Get result
        const resultHandle = await this.fheEquality.getComparisonResult();
        const decryptedResult = await this.instances.alice.decrypt(this.contractAddress, resultHandle);

        expect(decryptedResult).to.equal(BigInt(testCase.expected));
      }
    });
  });

  describe("Permission Management", function () {
    it("should grant permissions on comparison result", async function () {
      const value = 42;

      // Encrypt values
      const input1 = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
      input1.add32(value);
      const encrypted1 = await input1.encrypt();

      const input2 = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
      input2.add32(value);
      const encrypted2 = await input2.encrypt();

      // Store values
      let tx = await this.fheEquality
        .connect(this.signers.alice)
        .setValue1(encrypted1.handles[0], encrypted1.inputProof);
      await tx.wait();

      tx = await this.fheEquality
        .connect(this.signers.alice)
        .setValue2(encrypted2.handles[0], encrypted2.inputProof);
      await tx.wait();

      // Compare
      tx = await this.fheEquality.connect(this.signers.alice).compareValues();
      await tx.wait();

      // Alice should be able to decrypt result
      const resultHandle = await this.fheEquality.getComparisonResult();
      const decrypted = await this.instances.alice.decrypt(this.contractAddress, resultHandle);

      expect(decrypted).to.equal(BigInt(1));
    });
  });

  describe("Multiple Users", function () {
    it("should handle comparisons from different users", async function () {
      const aliceValue = 100;
      const bobValue = 100;

      // Alice encrypts her value
      const inputAlice = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      inputAlice.add32(aliceValue);
      const encryptedAlice = await inputAlice.encrypt();

      // Bob encrypts his value
      const inputBob = this.instances.bob.createEncryptedInput(this.contractAddress, this.signers.bob.address);
      inputBob.add32(bobValue);
      const encryptedBob = await inputBob.encrypt();

      // Alice stores her value
      let tx = await this.fheEquality
        .connect(this.signers.alice)
        .setValue1(encryptedAlice.handles[0], encryptedAlice.inputProof);
      await tx.wait();

      // Bob stores his value
      tx = await this.fheEquality
        .connect(this.signers.bob)
        .setValue2(encryptedBob.handles[0], encryptedBob.inputProof);
      await tx.wait();

      // Compare
      tx = await this.fheEquality.connect(this.signers.alice).compareValues();
      await tx.wait();

      // Alice decrypts result
      const resultHandle = await this.fheEquality.getComparisonResult();
      const decrypted = await this.instances.alice.decrypt(this.contractAddress, resultHandle);

      expect(decrypted).to.equal(BigInt(1)); // equal
    });
  });

  describe("Use Cases", function () {
    it("should support identity verification pattern", async function () {
      // Use case: Verify that two secret values match
      // Example: Check if password hash matches stored hash

      const secretValue = 12345;
      const storedSecretHash = 12345; // In real use, this would be encrypted hash

      // Encrypt provided value
      const inputProvided = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      inputProvided.add32(secretValue);
      const encryptedProvided = await inputProvided.encrypt();

      // Encrypt stored value
      const inputStored = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      inputStored.add32(storedSecretHash);
      const encryptedStored = await inputStored.encrypt();

      // Store for comparison
      let tx = await this.fheEquality
        .connect(this.signers.alice)
        .setValue1(encryptedProvided.handles[0], encryptedProvided.inputProof);
      await tx.wait();

      tx = await this.fheEquality
        .connect(this.signers.alice)
        .setValue2(encryptedStored.handles[0], encryptedStored.inputProof);
      await tx.wait();

      // Compare
      tx = await this.fheEquality.connect(this.signers.alice).compareValues();
      await tx.wait();

      // Get result
      const resultHandle = await this.fheEquality.getComparisonResult();
      const isMatch = await this.instances.alice.decrypt(this.contractAddress, resultHandle);

      expect(isMatch).to.equal(BigInt(1)); // values match
    });

    it("should support membership check pattern", async function () {
      // Use case: Check if encrypted value is in a set
      // Example: Verify membership without revealing the value

      const memberValue = 42;
      const checkValue = 42; // Check if this matches

      // Encrypt values
      const inputMember = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      inputMember.add32(memberValue);
      const encryptedMember = await inputMember.encrypt();

      const inputCheck = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      inputCheck.add32(checkValue);
      const encryptedCheck = await inputCheck.encrypt();

      // Store values
      let tx = await this.fheEquality
        .connect(this.signers.alice)
        .setValue1(encryptedMember.handles[0], encryptedMember.inputProof);
      await tx.wait();

      tx = await this.fheEquality
        .connect(this.signers.alice)
        .setValue2(encryptedCheck.handles[0], encryptedCheck.inputProof);
      await tx.wait();

      // Compare
      tx = await this.fheEquality.connect(this.signers.alice).compareValues();
      await tx.wait();

      // Check membership
      const resultHandle = await this.fheEquality.getComparisonResult();
      const isMember = await this.instances.alice.decrypt(this.contractAddress, resultHandle);

      expect(isMember).to.equal(BigInt(1)); // value is member
    });
  });

  describe("Input Validation", function () {
    it("should reject invalid input proof on setValue1", async function () {
      const value = 100;

      const input = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
      input.add32(value);
      const encrypted = await input.encrypt();

      await expect(this.fheEquality.connect(this.signers.alice).setValue1(encrypted.handles[0], "0x")).to.be
        .reverted;
    });

    it("should reject mismatched encryption signer", async function () {
      const value = 100;

      const input = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
      input.add32(value);
      const encrypted = await input.encrypt();

      // Bob tries to use Alice's encrypted value
      await expect(
        this.fheEquality.connect(this.signers.bob).setValue1(encrypted.handles[0], encrypted.inputProof)
      ).to.be.reverted;
    });
  });
});
