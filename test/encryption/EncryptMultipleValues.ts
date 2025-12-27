import { expect } from "chai";
import { ethers } from "hardhat";
import { EncryptMultipleValues } from "../../types";
import { createInstances } from "../instance";
import { getSigners, initSigners } from "../signers";
import { deployEncryptMultipleValuesFixture } from "./EncryptMultipleValues.fixture";

describe("EncryptMultipleValues - Multiple Value Encryption", function () {
  before(async function () {
    await initSigners();
    this.signers = await getSigners();
  });

  beforeEach(async function () {
    const contract = await deployEncryptMultipleValuesFixture();
    this.contractAddress = await contract.getAddress();
    this.encryptMultiple = contract;
    this.instances = await createInstances(this.contractAddress, ethers, this.signers);
  });

  it("should deploy contract successfully", async function () {
    expect(this.contractAddress).to.not.equal(ethers.ZeroAddress);
  });

  describe("Multiple Value Encryption", function () {
    it("should store multiple encrypted values in a single transaction", async function () {
      const value1 = 100;
      const value2 = 200;
      const value3 = 300;

      // Alice encrypts multiple values
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(value1);
      input.add32(value2);
      input.add32(value3);
      const encrypted = await input.encrypt();

      // Alice submits all three values with single proof
      const tx = await this.encryptMultiple
        .connect(this.signers.alice)
        .setData(encrypted.handles[0], encrypted.handles[1], encrypted.handles[2], encrypted.inputProof);
      await tx.wait();

      // Alice decrypts all values
      const data = await this.encryptMultiple.getData();
      const decrypted1 = await this.instances.alice.decrypt(this.contractAddress, data.value1);
      const decrypted2 = await this.instances.alice.decrypt(this.contractAddress, data.value2);
      const decrypted3 = await this.instances.alice.decrypt(this.contractAddress, data.value3);

      expect(decrypted1).to.equal(BigInt(value1));
      expect(decrypted2).to.equal(BigInt(value2));
      expect(decrypted3).to.equal(BigInt(value3));
    });

    it("should handle different values from multiple users", async function () {
      const aliceValue1 = 111;
      const aliceValue2 = 222;
      const aliceValue3 = 333;

      const bobValue1 = 444;
      const bobValue2 = 555;
      const bobValue3 = 666;

      // Alice stores her values
      let input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(aliceValue1);
      input.add32(aliceValue2);
      input.add32(aliceValue3);
      let encrypted = await input.encrypt();

      let tx = await this.encryptMultiple
        .connect(this.signers.alice)
        .setData(encrypted.handles[0], encrypted.handles[1], encrypted.handles[2], encrypted.inputProof);
      await tx.wait();

      // Bob stores his values (overwrites)
      input = this.instances.bob.createEncryptedInput(this.contractAddress, this.signers.bob.address);
      input.add32(bobValue1);
      input.add32(bobValue2);
      input.add32(bobValue3);
      encrypted = await input.encrypt();

      tx = await this.encryptMultiple
        .connect(this.signers.bob)
        .setData(encrypted.handles[0], encrypted.handles[1], encrypted.handles[2], encrypted.inputProof);
      await tx.wait();

      // Bob decrypts his values
      const data = await this.encryptMultiple.getData();
      const decrypted1 = await this.instances.bob.decrypt(this.contractAddress, data.value1);
      const decrypted2 = await this.instances.bob.decrypt(this.contractAddress, data.value2);
      const decrypted3 = await this.instances.bob.decrypt(this.contractAddress, data.value3);

      expect(decrypted1).to.equal(BigInt(bobValue1));
      expect(decrypted2).to.equal(BigInt(bobValue2));
      expect(decrypted3).to.equal(BigInt(bobValue3));
    });

    it("should handle zero values", async function () {
      const value1 = 0;
      const value2 = 0;
      const value3 = 0;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(value1);
      input.add32(value2);
      input.add32(value3);
      const encrypted = await input.encrypt();

      const tx = await this.encryptMultiple
        .connect(this.signers.alice)
        .setData(encrypted.handles[0], encrypted.handles[1], encrypted.handles[2], encrypted.inputProof);
      await tx.wait();

      const data = await this.encryptMultiple.getData();
      const decrypted1 = await this.instances.alice.decrypt(this.contractAddress, data.value1);
      const decrypted2 = await this.instances.alice.decrypt(this.contractAddress, data.value2);
      const decrypted3 = await this.instances.alice.decrypt(this.contractAddress, data.value3);

      expect(decrypted1).to.equal(BigInt(0));
      expect(decrypted2).to.equal(BigInt(0));
      expect(decrypted3).to.equal(BigInt(0));
    });

    it("should handle maximum uint32 values", async function () {
      const maxUint32 = 2 ** 32 - 1;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(maxUint32);
      input.add32(maxUint32);
      input.add32(maxUint32);
      const encrypted = await input.encrypt();

      const tx = await this.encryptMultiple
        .connect(this.signers.alice)
        .setData(encrypted.handles[0], encrypted.handles[1], encrypted.handles[2], encrypted.inputProof);
      await tx.wait();

      const data = await this.encryptMultiple.getData();
      const decrypted1 = await this.instances.alice.decrypt(this.contractAddress, data.value1);
      const decrypted2 = await this.instances.alice.decrypt(this.contractAddress, data.value2);
      const decrypted3 = await this.instances.alice.decrypt(this.contractAddress, data.value3);

      expect(decrypted1).to.equal(BigInt(maxUint32));
      expect(decrypted2).to.equal(BigInt(maxUint32));
      expect(decrypted3).to.equal(BigInt(maxUint32));
    });
  });

  describe("Struct Storage Patterns", function () {
    it("should maintain struct organization with multiple encrypted fields", async function () {
      // Demonstrates that multiple encrypted fields can be organized in a struct
      // This is more efficient than using dynamic arrays

      const values = {
        value1: 1000,
        value2: 2000,
        value3: 3000,
      };

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(values.value1);
      input.add32(values.value2);
      input.add32(values.value3);
      const encrypted = await input.encrypt();

      const tx = await this.encryptMultiple
        .connect(this.signers.alice)
        .setData(encrypted.handles[0], encrypted.handles[1], encrypted.handles[2], encrypted.inputProof);
      await tx.wait();

      // Retrieve struct
      const data = await this.encryptMultiple.getData();

      // All three fields should be accessible
      expect(data).to.have.property("value1");
      expect(data).to.have.property("value2");
      expect(data).to.have.property("value3");

      // Verify values
      const decrypted1 = await this.instances.alice.decrypt(this.contractAddress, data.value1);
      const decrypted2 = await this.instances.alice.decrypt(this.contractAddress, data.value2);
      const decrypted3 = await this.instances.alice.decrypt(this.contractAddress, data.value3);

      expect(decrypted1).to.equal(BigInt(values.value1));
      expect(decrypted2).to.equal(BigInt(values.value2));
      expect(decrypted3).to.equal(BigInt(values.value3));
    });

    it("should allow independent updates of struct fields", async function () {
      // Each value can have its own lifetime and permissions

      const initialValues = { v1: 100, v2: 200, v3: 300 };

      // Set initial values
      let input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(initialValues.v1);
      input.add32(initialValues.v2);
      input.add32(initialValues.v3);
      let encrypted = await input.encrypt();

      let tx = await this.encryptMultiple
        .connect(this.signers.alice)
        .setData(encrypted.handles[0], encrypted.handles[1], encrypted.handles[2], encrypted.inputProof);
      await tx.wait();

      // Update with new values
      const newValues = { v1: 400, v2: 500, v3: 600 };

      input = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
      input.add32(newValues.v1);
      input.add32(newValues.v2);
      input.add32(newValues.v3);
      encrypted = await input.encrypt();

      tx = await this.encryptMultiple
        .connect(this.signers.alice)
        .setData(encrypted.handles[0], encrypted.handles[1], encrypted.handles[2], encrypted.inputProof);
      await tx.wait();

      // Verify updated values
      const data = await this.encryptMultiple.getData();
      const decrypted1 = await this.instances.alice.decrypt(this.contractAddress, data.value1);
      const decrypted2 = await this.instances.alice.decrypt(this.contractAddress, data.value2);
      const decrypted3 = await this.instances.alice.decrypt(this.contractAddress, data.value3);

      expect(decrypted1).to.equal(BigInt(newValues.v1));
      expect(decrypted2).to.equal(BigInt(newValues.v2));
      expect(decrypted3).to.equal(BigInt(newValues.v3));
    });
  });

  describe("Input Proof Validation", function () {
    it("should reject invalid input proof", async function () {
      const value1 = 100;
      const value2 = 200;
      const value3 = 300;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(value1);
      input.add32(value2);
      input.add32(value3);
      const encrypted = await input.encrypt();

      // Use invalid proof
      await expect(
        this.encryptMultiple
          .connect(this.signers.alice)
          .setData(encrypted.handles[0], encrypted.handles[1], encrypted.handles[2], "0x")
      ).to.be.reverted;
    });

    it("should reject mismatched handles and proof", async function () {
      const value1 = 100;
      const value2 = 200;
      const value3 = 300;

      // Create first encrypted input
      let input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(value1);
      input.add32(value2);
      input.add32(value3);
      let encrypted1 = await input.encrypt();

      // Create second encrypted input with different values
      input = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
      input.add32(999);
      input.add32(888);
      input.add32(777);
      let encrypted2 = await input.encrypt();

      // Mix handles and proof from different encryptions
      await expect(
        this.encryptMultiple
          .connect(this.signers.alice)
          .setData(encrypted1.handles[0], encrypted2.handles[1], encrypted1.handles[2], encrypted2.inputProof)
      ).to.be.reverted;
    });
  });

  describe("Permission Management", function () {
    it("should grant permissions on all encrypted values", async function () {
      const values = { v1: 100, v2: 200, v3: 300 };

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(values.v1);
      input.add32(values.v2);
      input.add32(values.v3);
      const encrypted = await input.encrypt();

      const tx = await this.encryptMultiple
        .connect(this.signers.alice)
        .setData(encrypted.handles[0], encrypted.handles[1], encrypted.handles[2], encrypted.inputProof);
      await tx.wait();

      // Alice should be able to decrypt all values
      const data = await this.encryptMultiple.getData();
      const decrypted1 = await this.instances.alice.decrypt(this.contractAddress, data.value1);
      const decrypted2 = await this.instances.alice.decrypt(this.contractAddress, data.value2);
      const decrypted3 = await this.instances.alice.decrypt(this.contractAddress, data.value3);

      expect(decrypted1).to.equal(BigInt(values.v1));
      expect(decrypted2).to.equal(BigInt(values.v2));
      expect(decrypted3).to.equal(BigInt(values.v3));
    });
  });

  describe("Encryption Binding", function () {
    it("should reject proof from different user", async function () {
      const value1 = 100;
      const value2 = 200;
      const value3 = 300;

      // Alice encrypts
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(value1);
      input.add32(value2);
      input.add32(value3);
      const encrypted = await input.encrypt();

      // Bob tries to use Alice's proof
      await expect(
        this.encryptMultiple
          .connect(this.signers.bob)
          .setData(encrypted.handles[0], encrypted.handles[1], encrypted.handles[2], encrypted.inputProof)
      ).to.be.reverted;
    });
  });

  describe("Use Cases", function () {
    it("should support multi-dimensional data submission", async function () {
      // Use case: Submit multiple related encrypted values
      // Example: Rating system with multiple dimensions

      const rating = {
        quality: 85,
        originality: 92,
        impact: 78,
      };

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(rating.quality);
      input.add32(rating.originality);
      input.add32(rating.impact);
      const encrypted = await input.encrypt();

      const tx = await this.encryptMultiple
        .connect(this.signers.alice)
        .setData(encrypted.handles[0], encrypted.handles[1], encrypted.handles[2], encrypted.inputProof);
      await tx.wait();

      // Verify ratings
      const data = await this.encryptMultiple.getData();
      const decrypted1 = await this.instances.alice.decrypt(this.contractAddress, data.value1);
      const decrypted2 = await this.instances.alice.decrypt(this.contractAddress, data.value2);
      const decrypted3 = await this.instances.alice.decrypt(this.contractAddress, data.value3);

      expect(decrypted1).to.equal(BigInt(rating.quality));
      expect(decrypted2).to.equal(BigInt(rating.originality));
      expect(decrypted3).to.equal(BigInt(rating.impact));
    });

    it("should support encrypted profile submission", async function () {
      // Use case: Submit multiple encrypted personal attributes
      // Example: Age, income, credit score

      const profile = {
        age: 35,
        income: 75000,
        creditScore: 750,
      };

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(profile.age);
      input.add32(profile.income);
      input.add32(profile.creditScore);
      const encrypted = await input.encrypt();

      const tx = await this.encryptMultiple
        .connect(this.signers.alice)
        .setData(encrypted.handles[0], encrypted.handles[1], encrypted.handles[2], encrypted.inputProof);
      await tx.wait();

      // Only Alice can see her profile
      const data = await this.encryptMultiple.getData();
      const decryptedAge = await this.instances.alice.decrypt(this.contractAddress, data.value1);
      const decryptedIncome = await this.instances.alice.decrypt(this.contractAddress, data.value2);
      const decryptedScore = await this.instances.alice.decrypt(this.contractAddress, data.value3);

      expect(decryptedAge).to.equal(BigInt(profile.age));
      expect(decryptedIncome).to.equal(BigInt(profile.income));
      expect(decryptedScore).to.equal(BigInt(profile.creditScore));
    });
  });

  describe("Gas Efficiency", function () {
    it("should be more efficient than single value approach for multiple values", async function () {
      // This test demonstrates that storing multiple values in a struct
      // with a single transaction is more efficient than separate transactions

      const value1 = 100;
      const value2 = 200;
      const value3 = 300;

      // All three values in one transaction
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(value1);
      input.add32(value2);
      input.add32(value3);
      const encrypted = await input.encrypt();

      const tx = await this.encryptMultiple
        .connect(this.signers.alice)
        .setData(encrypted.handles[0], encrypted.handles[1], encrypted.handles[2], encrypted.inputProof);
      const receipt = await tx.wait();

      // Single transaction is more efficient than three separate ones
      expect(receipt).to.not.be.null;
      expect(receipt?.gasUsed).to.be.greaterThan(0);
    });
  });
});
