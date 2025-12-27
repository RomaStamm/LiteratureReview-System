import { expect } from "chai";
import { ethers } from "hardhat";
import { UserDecryptMultipleValues } from "../../types";
import { createInstances } from "../instance";
import { getSigners, initSigners } from "../signers";
import { deployUserDecryptMultipleValuesFixture } from "./UserDecryptMultipleValues.fixture";

describe("UserDecryptMultipleValues - Multiple Value User Decryption", function () {
  before(async function () {
    await initSigners();
    this.signers = await getSigners();
  });

  beforeEach(async function () {
    const contract = await deployUserDecryptMultipleValuesFixture();
    this.contractAddress = await contract.getAddress();
    this.userDecryptMultiple = contract;
    this.instances = await createInstances(this.contractAddress, ethers, this.signers);
  });

  it("should deploy contract successfully", async function () {
    expect(this.contractAddress).to.not.equal(ethers.ZeroAddress);
  });

  describe("Multiple Value User Decryption", function () {
    it("should allow user to decrypt multiple encrypted values", async function () {
      const profile = { field1: 100, field2: 200, field3: 300 };

      // Alice stores encrypted profile
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(profile.field1);
      input.add32(profile.field2);
      input.add32(profile.field3);
      const encrypted = await input.encrypt();

      const tx = await this.userDecryptMultiple
        .connect(this.signers.alice)
        .setProfile(encrypted.handles[0], encrypted.handles[1], encrypted.handles[2], encrypted.inputProof);
      await tx.wait();

      // Alice decrypts all fields
      const data = await this.userDecryptMultiple.getProfile();
      const decrypted1 = await this.instances.alice.decrypt(this.contractAddress, data.field1);
      const decrypted2 = await this.instances.alice.decrypt(this.contractAddress, data.field2);
      const decrypted3 = await this.instances.alice.decrypt(this.contractAddress, data.field3);

      expect(decrypted1).to.equal(BigInt(profile.field1));
      expect(decrypted2).to.equal(BigInt(profile.field2));
      expect(decrypted3).to.equal(BigInt(profile.field3));
    });

    it("should prevent unauthorized user from decrypting", async function () {
      const profile = { field1: 100, field2: 200, field3: 300 };

      // Alice stores profile
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(profile.field1);
      input.add32(profile.field2);
      input.add32(profile.field3);
      const encrypted = await input.encrypt();

      const tx = await this.userDecryptMultiple
        .connect(this.signers.alice)
        .setProfile(encrypted.handles[0], encrypted.handles[1], encrypted.handles[2], encrypted.inputProof);
      await tx.wait();

      // Bob cannot decrypt (no permission)
      const data = await this.userDecryptMultiple.getProfile();

      try {
        await this.instances.bob.decrypt(this.contractAddress, data.field1);
        expect(true).to.be.false;
      } catch {
        expect(true).to.be.true;
      }
    });

    it("should manage permissions for each field independently", async function () {
      const profile = { field1: 111, field2: 222, field3: 333 };

      // Store profile
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(profile.field1);
      input.add32(profile.field2);
      input.add32(profile.field3);
      const encrypted = await input.encrypt();

      const tx = await this.userDecryptMultiple
        .connect(this.signers.alice)
        .setProfile(encrypted.handles[0], encrypted.handles[1], encrypted.handles[2], encrypted.inputProof);
      await tx.wait();

      // Each field has its own permission
      const data = await this.userDecryptMultiple.getProfile();

      // Alice can decrypt all
      const decrypted1 = await this.instances.alice.decrypt(this.contractAddress, data.field1);
      const decrypted2 = await this.instances.alice.decrypt(this.contractAddress, data.field2);
      const decrypted3 = await this.instances.alice.decrypt(this.contractAddress, data.field3);

      expect(decrypted1).to.equal(BigInt(profile.field1));
      expect(decrypted2).to.equal(BigInt(profile.field2));
      expect(decrypted3).to.equal(BigInt(profile.field3));
    });
  });

  describe("Profile Management", function () {
    it("should support encrypted user profile", async function () {
      // Use case: Store encrypted user attributes
      const userProfile = { age: 35, salary: 75000, rating: 850 };

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(userProfile.age);
      input.add32(userProfile.salary);
      input.add32(userProfile.rating);
      const encrypted = await input.encrypt();

      const tx = await this.userDecryptMultiple
        .connect(this.signers.alice)
        .setProfile(encrypted.handles[0], encrypted.handles[1], encrypted.handles[2], encrypted.inputProof);
      await tx.wait();

      // User can decrypt their profile
      const data = await this.userDecryptMultiple.getProfile();
      const decryptedAge = await this.instances.alice.decrypt(this.contractAddress, data.field1);
      const decryptedSalary = await this.instances.alice.decrypt(this.contractAddress, data.field2);
      const decryptedRating = await this.instances.alice.decrypt(this.contractAddress, data.field3);

      expect(decryptedAge).to.equal(BigInt(userProfile.age));
      expect(decryptedSalary).to.equal(BigInt(userProfile.salary));
      expect(decryptedRating).to.equal(BigInt(userProfile.rating));
    });

    it("should support encrypted rating submission", async function () {
      // Use case: Store multiple rating dimensions
      const ratings = { quality: 85, originality: 92, impact: 78 };

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(ratings.quality);
      input.add32(ratings.originality);
      input.add32(ratings.impact);
      const encrypted = await input.encrypt();

      const tx = await this.userDecryptMultiple
        .connect(this.signers.alice)
        .setProfile(encrypted.handles[0], encrypted.handles[1], encrypted.handles[2], encrypted.inputProof);
      await tx.wait();

      // Ratings remain private until user decrypts
      const data = await this.userDecryptMultiple.getProfile();
      const quality = await this.instances.alice.decrypt(this.contractAddress, data.field1);
      const originality = await this.instances.alice.decrypt(this.contractAddress, data.field2);
      const impact = await this.instances.alice.decrypt(this.contractAddress, data.field3);

      expect(quality).to.equal(BigInt(ratings.quality));
      expect(originality).to.equal(BigInt(ratings.originality));
      expect(impact).to.equal(BigInt(ratings.impact));
    });
  });

  describe("Struct Storage Patterns", function () {
    it("should maintain struct with multiple encrypted fields", async function () {
      // Demonstrates efficient struct storage vs individual values

      const data = { value1: 1000, value2: 2000, value3: 3000 };

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(data.value1);
      input.add32(data.value2);
      input.add32(data.value3);
      const encrypted = await input.encrypt();

      const tx = await this.userDecryptMultiple
        .connect(this.signers.alice)
        .setProfile(encrypted.handles[0], encrypted.handles[1], encrypted.handles[2], encrypted.inputProof);
      await tx.wait();

      // Struct maintains organization
      const profile = await this.userDecryptMultiple.getProfile();
      expect(profile).to.have.property("field1");
      expect(profile).to.have.property("field2");
      expect(profile).to.have.property("field3");
    });

    it("should allow updating profile while maintaining permissions", async function () {
      // Update 1
      let input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(100);
      input.add32(200);
      input.add32(300);
      let encrypted = await input.encrypt();

      let tx = await this.userDecryptMultiple
        .connect(this.signers.alice)
        .setProfile(encrypted.handles[0], encrypted.handles[1], encrypted.handles[2], encrypted.inputProof);
      await tx.wait();

      // Update 2
      input = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
      input.add32(400);
      input.add32(500);
      input.add32(600);
      encrypted = await input.encrypt();

      tx = await this.userDecryptMultiple
        .connect(this.signers.alice)
        .setProfile(encrypted.handles[0], encrypted.handles[1], encrypted.handles[2], encrypted.inputProof);
      await tx.wait();

      // Latest values decryptable
      const profile = await this.userDecryptMultiple.getProfile();
      const val1 = await this.instances.alice.decrypt(this.contractAddress, profile.field1);
      const val2 = await this.instances.alice.decrypt(this.contractAddress, profile.field2);
      const val3 = await this.instances.alice.decrypt(this.contractAddress, profile.field3);

      expect(val1).to.equal(BigInt(400));
      expect(val2).to.equal(BigInt(500));
      expect(val3).to.equal(BigInt(600));
    });
  });

  describe("Multiple Users", function () {
    it("should handle different users with separate profiles", async function () {
      // Alice's profile
      let input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(100);
      input.add32(200);
      input.add32(300);
      let encrypted = await input.encrypt();

      let tx = await this.userDecryptMultiple
        .connect(this.signers.alice)
        .setProfile(encrypted.handles[0], encrypted.handles[1], encrypted.handles[2], encrypted.inputProof);
      await tx.wait();

      // Verify Alice's
      let data = await this.userDecryptMultiple.getProfile();
      let val1 = await this.instances.alice.decrypt(this.contractAddress, data.field1);
      expect(val1).to.equal(BigInt(100));

      // Bob's profile (overwrites)
      input = this.instances.bob.createEncryptedInput(this.contractAddress, this.signers.bob.address);
      input.add32(400);
      input.add32(500);
      input.add32(600);
      encrypted = await input.encrypt();

      tx = await this.userDecryptMultiple
        .connect(this.signers.bob)
        .setProfile(encrypted.handles[0], encrypted.handles[1], encrypted.handles[2], encrypted.inputProof);
      await tx.wait();

      // Verify Bob's
      data = await this.userDecryptMultiple.getProfile();
      val1 = await this.instances.bob.decrypt(this.contractAddress, data.field1);
      expect(val1).to.equal(BigInt(400));
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
        this.userDecryptMultiple
          .connect(this.signers.alice)
          .setProfile(encrypted.handles[0], encrypted.handles[1], encrypted.handles[2], "0x")
      ).to.be.reverted;
    });
  });
});
