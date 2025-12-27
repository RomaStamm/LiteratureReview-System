import { expect } from "chai";
import { ethers } from "hardhat";
import { FHESubtract } from "../../types";
import { createInstances } from "../instance";
import { getSigners, initSigners } from "../signers";
import { deployFHESubtractFixture } from "./FHESubtract.fixture";

describe("FHESubtract - Homomorphic Subtraction", function () {
  before(async function () {
    await initSigners();
    this.signers = await getSigners();
  });

  beforeEach(async function () {
    const contract = await deployFHESubtractFixture();
    this.contractAddress = await contract.getAddress();
    this.fheSubtract = contract;
    this.instances = await createInstances(this.contractAddress, ethers, this.signers);
  });

  it("should deploy contract successfully", async function () {
    expect(this.contractAddress).to.not.equal(ethers.ZeroAddress);
  });

  describe("Basic Subtraction Operations", function () {
    it("should subtract encrypted values correctly", async function () {
      const minuend = 100;
      const subtrahend = 30;
      const expectedDifference = minuend - subtrahend;

      // Encrypt minuend (value to subtract from)
      const inputMinuend = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      inputMinuend.add32(minuend);
      const encryptedMinuend = await inputMinuend.encrypt();

      // Encrypt subtrahend (value to subtract)
      const inputSubtrahend = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      inputSubtrahend.add32(subtrahend);
      const encryptedSubtrahend = await inputSubtrahend.encrypt();

      // Store initial value
      let tx = await this.fheSubtract
        .connect(this.signers.alice)
        .setBalance(encryptedMinuend.handles[0], encryptedMinuend.inputProof);
      await tx.wait();

      // Subtract value
      tx = await this.fheSubtract
        .connect(this.signers.alice)
        .subtractFromBalance(encryptedSubtrahend.handles[0], encryptedSubtrahend.inputProof);
      await tx.wait();

      // Decrypt and verify result
      const result = await this.fheSubtract.getBalance();
      const decryptedResult = await this.instances.alice.decrypt(this.contractAddress, result);

      expect(decryptedResult).to.equal(BigInt(expectedDifference));
    });

    it("should handle subtraction resulting in zero", async function () {
      const value = 100;

      // Set balance
      const inputSet = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      inputSet.add32(value);
      const encryptedSet = await inputSet.encrypt();

      let tx = await this.fheSubtract
        .connect(this.signers.alice)
        .setBalance(encryptedSet.handles[0], encryptedSet.inputProof);
      await tx.wait();

      // Subtract same amount
      const inputSubtract = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      inputSubtract.add32(value);
      const encryptedSubtract = await inputSubtract.encrypt();

      tx = await this.fheSubtract
        .connect(this.signers.alice)
        .subtractFromBalance(encryptedSubtract.handles[0], encryptedSubtract.inputProof);
      await tx.wait();

      // Verify result is zero
      const result = await this.fheSubtract.getBalance();
      const decryptedResult = await this.instances.alice.decrypt(this.contractAddress, result);

      expect(decryptedResult).to.equal(BigInt(0));
    });

    it("should handle subtraction from zero", async function () {
      const value = 50;

      // Balance starts at zero
      // Subtract from zero
      const input = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
      input.add32(value);
      const encrypted = await input.encrypt();

      const tx = await this.fheSubtract
        .connect(this.signers.alice)
        .subtractFromBalance(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Note: Encrypted subtraction doesn't revert on underflow
      // This is a critical pattern - validation happens at application level
      const result = await this.fheSubtract.getBalance();
      const decrypted = await this.instances.alice.decrypt(this.contractAddress, result);

      // Result will be wrapped (modulo 2^32)
      // 0 - 50 = -50 mod 2^32 = 4294967246
      expect(decrypted).to.equal(BigInt(4294967246));
    });

    it("should handle multiple sequential subtractions", async function () {
      const initialValue = 1000;
      const subtractions = [100, 200, 150, 50];
      let expectedResult = initialValue;

      // Set initial balance
      const inputInitial = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      inputInitial.add32(initialValue);
      const encryptedInitial = await inputInitial.encrypt();

      let tx = await this.fheSubtract
        .connect(this.signers.alice)
        .setBalance(encryptedInitial.handles[0], encryptedInitial.inputProof);
      await tx.wait();

      // Perform subtractions
      for (const subtractValue of subtractions) {
        expectedResult -= subtractValue;

        const input = this.instances.alice.createEncryptedInput(
          this.contractAddress,
          this.signers.alice.address
        );
        input.add32(subtractValue);
        const encrypted = await input.encrypt();

        tx = await this.fheSubtract
          .connect(this.signers.alice)
          .subtractFromBalance(encrypted.handles[0], encrypted.inputProof);
        await tx.wait();
      }

      // Verify final result
      const result = await this.fheSubtract.getBalance();
      const decrypted = await this.instances.alice.decrypt(this.contractAddress, result);

      expect(decrypted).to.equal(BigInt(expectedResult));
    });
  });

  describe("Permission Management", function () {
    it("should grant permissions on balance updates", async function () {
      const value = 100;

      const input = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
      input.add32(value);
      const encrypted = await input.encrypt();

      const tx = await this.fheSubtract
        .connect(this.signers.alice)
        .setBalance(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Alice should be able to decrypt
      const result = await this.fheSubtract.getBalance();
      const decrypted = await this.instances.alice.decrypt(this.contractAddress, result);

      expect(decrypted).to.equal(BigInt(value));
    });

    it("should maintain permissions after subtraction", async function () {
      const initial = 100;
      const subtract = 30;

      // Set balance
      const inputSet = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      inputSet.add32(initial);
      const encryptedSet = await inputSet.encrypt();

      await this.fheSubtract
        .connect(this.signers.alice)
        .setBalance(encryptedSet.handles[0], encryptedSet.inputProof);

      // Subtract
      const inputSub = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      inputSub.add32(subtract);
      const encryptedSub = await inputSub.encrypt();

      await this.fheSubtract
        .connect(this.signers.alice)
        .subtractFromBalance(encryptedSub.handles[0], encryptedSub.inputProof);

      // Alice should still be able to decrypt
      const result = await this.fheSubtract.getBalance();
      const decrypted = await this.instances.alice.decrypt(this.contractAddress, result);

      expect(decrypted).to.equal(BigInt(initial - subtract));
    });
  });

  describe("Multiple Users", function () {
    it("should handle different users updating balance", async function () {
      const aliceValue = 100;
      const bobSubtract = 25;

      // Alice sets balance
      const inputAlice = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      inputAlice.add32(aliceValue);
      const encryptedAlice = await inputAlice.encrypt();

      await this.fheSubtract
        .connect(this.signers.alice)
        .setBalance(encryptedAlice.handles[0], encryptedAlice.inputProof);

      // Bob subtracts (each user provides their own encrypted value)
      const inputBob = this.instances.bob.createEncryptedInput(this.contractAddress, this.signers.bob.address);
      inputBob.add32(bobSubtract);
      const encryptedBob = await inputBob.encrypt();

      await this.fheSubtract
        .connect(this.signers.bob)
        .subtractFromBalance(encryptedBob.handles[0], encryptedBob.inputProof);

      // Alice verifies result
      const result = await this.fheSubtract.getBalance();
      const decrypted = await this.instances.alice.decrypt(this.contractAddress, result);

      expect(decrypted).to.equal(BigInt(aliceValue - bobSubtract));
    });
  });

  describe("Underflow Behavior", function () {
    it("should not revert on encrypted underflow", async function () {
      const small = 10;
      const large = 100;

      // Set small balance
      const inputSmall = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      inputSmall.add32(small);
      const encryptedSmall = await inputSmall.encrypt();

      await this.fheSubtract
        .connect(this.signers.alice)
        .setBalance(encryptedSmall.handles[0], encryptedSmall.inputProof);

      // Try to subtract more than balance
      const inputLarge = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      inputLarge.add32(large);
      const encryptedLarge = await inputLarge.encrypt();

      // Should NOT revert - encrypted operations wrap
      const tx = await this.fheSubtract
        .connect(this.signers.alice)
        .subtractFromBalance(encryptedLarge.handles[0], encryptedLarge.inputProof);

      expect(tx).to.not.be.reverted;
      await tx.wait();

      // Result will be wrapped (10 - 100 mod 2^32)
      const result = await this.fheSubtract.getBalance();
      const decrypted = await this.instances.alice.decrypt(this.contractAddress, result);

      // 10 - 100 = -90 mod 2^32 = 4294967206
      expect(decrypted).to.equal(BigInt(4294967206));
    });

    it("should require client-side validation for underflow protection", async function () {
      // This demonstrates that underflow protection must happen at application level
      // The contract cannot prevent underflow with encrypted values
      // Developers must validate on client-side BEFORE encryption

      const balance = 50;
      const attemptedWithdrawal = 100;

      // Set balance
      const input = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
      input.add32(balance);
      const encrypted = await input.encrypt();

      await this.fheSubtract
        .connect(this.signers.alice)
        .setBalance(encrypted.handles[0], encrypted.inputProof);

      // Client should validate: attemptedWithdrawal <= balance
      // Since balance is encrypted, this validation happens client-side
      // Then client either:
      // 1. Encrypts the withdrawal amount (approved after validation)
      // 2. Rejects the transaction (insufficient funds)

      // In this test, we show that the contract CANNOT enforce this
      const inputWithdraw = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      inputWithdraw.add32(attemptedWithdrawal);
      const encryptedWithdraw = await inputWithdraw.encrypt();

      // Contract cannot prevent this - it will wrap
      const tx = await this.fheSubtract
        .connect(this.signers.alice)
        .subtractFromBalance(encryptedWithdraw.handles[0], encryptedWithdraw.inputProof);

      expect(tx).to.not.be.reverted;
      await tx.wait();
    });
  });

  describe("Input Validation", function () {
    it("should reject invalid input proof on setBalance", async function () {
      const value = 100;

      const input = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
      input.add32(value);
      const encrypted = await input.encrypt();

      // Use invalid proof
      await expect(this.fheSubtract.connect(this.signers.alice).setBalance(encrypted.handles[0], "0x")).to.be
        .reverted;
    });

    it("should reject mismatched encryption signer", async function () {
      const value = 100;

      const input = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
      input.add32(value);
      const encrypted = await input.encrypt();

      // Bob tries to use Alice's encrypted value
      await expect(
        this.fheSubtract.connect(this.signers.bob).setBalance(encrypted.handles[0], encrypted.inputProof)
      ).to.be.reverted;
    });
  });
});
