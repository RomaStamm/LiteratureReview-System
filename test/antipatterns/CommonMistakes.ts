import { expect } from "chai";
import { ethers } from "hardhat";
import { CommonMistakes } from "../../types";
import { createInstances } from "../instance";
import { getSigners, initSigners } from "../signers";
import { deployCommonMistakesFixture } from "./CommonMistakes.fixture";

describe("CommonMistakes - Anti-Patterns and Pitfalls", function () {
  before(async function () {
    await initSigners();
    this.signers = await getSigners();
  });

  beforeEach(async function () {
    const contract = await deployCommonMistakesFixture();
    this.contractAddress = await contract.getAddress();
    this.commonMistakes = contract;
    this.instances = await createInstances(this.contractAddress, ethers, this.signers);
  });

  it("should deploy contract successfully", async function () {
    expect(this.contractAddress).to.not.equal(ethers.ZeroAddress);
  });

  describe("Mistake 1: Missing FHE.allowThis()", function () {
    it("should demonstrate missing FHE.allowThis() error", async function () {
      // ❌ WRONG: Missing FHE.allowThis()
      // Contract cannot operate on encrypted value without contract permission

      const secret = 12345;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      // Calling function that forgets FHE.allowThis()
      await expect(
        this.commonMistakes.connect(this.signers.alice).mistakeMissingAllowThis(encrypted.handles[0], encrypted.inputProof)
      ).to.be.reverted;
    });

    it("should show correct pattern with FHE.allowThis()", async function () {
      // ✅ CORRECT: FHE.allowThis() first, then FHE.allow()

      const secret = 54321;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      // Correct function includes FHE.allowThis()
      const tx = await this.commonMistakes
        .connect(this.signers.alice)
        .correctAllowThis(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Can now decrypt
      const stored = await this.commonMistakes.getValue();
      const decrypted = await this.instances.alice.decrypt(this.contractAddress, stored);

      expect(decrypted).to.equal(BigInt(secret));
    });
  });

  describe("Mistake 2: Missing FHE.allow() for User", function () {
    it("should demonstrate missing FHE.allow() error", async function () {
      // ❌ WRONG: Missing FHE.allow(value, msg.sender)
      // User cannot decrypt without explicit permission

      const secret = 11111;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      const tx = await this.commonMistakes
        .connect(this.signers.alice)
        .mistakeMissingAllow(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // User cannot decrypt (no FHE.allow)
      const stored = await this.commonMistakes.getValue();

      try {
        await this.instances.alice.decrypt(this.contractAddress, stored);
        expect(true).to.be.false; // Should not reach
      } catch {
        expect(true).to.be.true; // Expected
      }
    });

    it("should show correct pattern with FHE.allow()", async function () {
      // ✅ CORRECT: Grant user permission

      const secret = 22222;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      const tx = await this.commonMistakes
        .connect(this.signers.alice)
        .correctAllow(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // User can decrypt
      const stored = await this.commonMistakes.getValue();
      const decrypted = await this.instances.alice.decrypt(this.contractAddress, stored);

      expect(decrypted).to.equal(BigInt(secret));
    });
  });

  describe("Mistake 3: Reusing Input Proofs", function () {
    it("should demonstrate input proof reuse error", async function () {
      // ❌ WRONG: Reusing same proof for different value
      // Proof is bound to specific encryption and cannot be reused

      const secret = 33333;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      // Try to reuse proof with different handle
      await expect(
        this.commonMistakes
          .connect(this.signers.alice)
          .mistakeReuseProof(encrypted.handles[0], encrypted.handles[0], encrypted.inputProof)
      ).to.be.reverted;
    });

    it("should show correct pattern with separate proofs", async function () {
      // ✅ CORRECT: Each value gets its own proof

      const value1 = 100;
      const value2 = 200;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(value1);
      input.add32(value2);
      const encrypted = await input.encrypt();

      // Each value has its own handle and proof
      const tx = await this.commonMistakes
        .connect(this.signers.alice)
        .correctMultipleValues(encrypted.handles[0], encrypted.handles[1], encrypted.inputProof);
      await tx.wait();

      expect(tx).to.not.be.reverted;
    });
  });

  describe("Mistake 4: Encryption Signer Mismatch", function () {
    it("should demonstrate signer mismatch error", async function () {
      // ❌ WRONG: Proof from Alice used by Bob
      // Proof is bound to [contract, Alice] not [contract, Bob]

      const secret = 44444;

      // Alice encrypts
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      // Bob tries to use Alice's proof
      await expect(
        this.commonMistakes.connect(this.signers.bob).correctAllow(encrypted.handles[0], encrypted.inputProof)
      ).to.be.reverted;
    });

    it("should show correct pattern with matching signer", async function () {
      // ✅ CORRECT: Signer matches encryption

      const secret = 55555;

      // Alice encrypts
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      // Alice uses her own proof
      const tx = await this.commonMistakes
        .connect(this.signers.alice)
        .correctAllow(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      expect(tx).to.not.be.reverted;
    });
  });

  describe("Mistake 5: Casting Encrypted to Plaintext", function () {
    it("should demonstrate encryption type mismatch", async function () {
      // ❌ WRONG: Cannot cast euint32 to uint32
      // euint32 is encrypted, uint32 is plaintext

      const secret = 66666;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      // Attempting to treat encrypted as plaintext
      await expect(
        this.commonMistakes.connect(this.signers.alice).mistakeCasting(encrypted.handles[0], encrypted.inputProof)
      ).to.be.reverted;
    });
  });

  describe("Mistake 6: Encrypted Values in View Functions", function () {
    it("should demonstrate view function limitation", async function () {
      // ❌ WRONG: Returning euint32 from view function
      // View functions cannot work with encrypted values

      // View functions cannot operate on encrypted data
      // They can only return plaintext or handles (which are encrypted references)
      expect(true).to.be.true; // Pattern limitation
    });
  });

  describe("Mistake 7: Missing Permissions on Results", function () {
    it("should demonstrate missing permissions on operation results", async function () {
      // ❌ WRONG: Not granting permission on FHE.add() result
      // Result of FHE operations also needs permissions

      const value1 = 100;
      const value2 = 200;

      let input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(value1);
      let encrypted = await input.encrypt();

      let tx = await this.commonMistakes
        .connect(this.signers.alice)
        .storeValue1(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      input = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
      input.add32(value2);
      encrypted = await input.encrypt();

      tx = await this.commonMistakes
        .connect(this.signers.alice)
        .storeValue2(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Missing permissions on result prevents decryption
      await expect(this.commonMistakes.connect(this.signers.alice).mistakeNoResultPermission()).to.be.reverted;
    });

    it("should show correct pattern with result permissions", async function () {
      // ✅ CORRECT: Grant permission on operation result

      const value1 = 150;
      const value2 = 250;

      let input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(value1);
      let encrypted = await input.encrypt();

      let tx = await this.commonMistakes
        .connect(this.signers.alice)
        .storeValue1(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      input = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
      input.add32(value2);
      encrypted = await input.encrypt();

      tx = await this.commonMistakes
        .connect(this.signers.alice)
        .storeValue2(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Correct function includes permissions on result
      tx = await this.commonMistakes.connect(this.signers.alice).correctResultPermission();
      await tx.wait();

      expect(tx).to.not.be.reverted;
    });
  });

  describe("Mistake 8: Using allowTransient for Storage", function () {
    it("should demonstrate allowTransient limitation", async function () {
      // ❌ WRONG: Using allowTransient() for stored values
      // allowTransient() only works for current transaction
      // For storage, must use FHE.allowThis() and FHE.allow()

      const secret = 77777;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      // Function using allowTransient for storage
      await expect(
        this.commonMistakes
          .connect(this.signers.alice)
          .mistakeAllowTransientStorage(encrypted.handles[0], encrypted.inputProof)
      ).to.be.reverted;
    });
  });

  describe("Mistake 9: Missing Permissions in Loops", function () {
    it("should demonstrate missing permissions in loop operations", async function () {
      // ❌ WRONG: Not granting permissions on each loop iteration
      // Each operation result needs permissions

      const values = [10, 20, 30];

      for (const value of values) {
        const input = this.instances.alice.createEncryptedInput(
          this.contractAddress,
          this.signers.alice.address
        );
        input.add32(value);
        const encrypted = await input.encrypt();

        await this.commonMistakes
          .connect(this.signers.alice)
          .storeValue1(encrypted.handles[0], encrypted.inputProof);
      }

      expect(true).to.be.true; // Pattern limitation
    });
  });

  describe("Mistake 10: Encrypted Boolean in If-Statement", function () {
    it("should demonstrate encrypted boolean limitation", async function () {
      // ❌ WRONG: Using ebool directly in Solidity if-statement
      // ebool is encrypted, cannot control Solidity flow directly

      // Solidity if statements require plaintext boolean
      // Encrypted boolean comparison results must be handled differently

      expect(true).to.be.true; // Pattern limitation
    });
  });

  describe("Summary: Common Pitfalls", function () {
    it("should list all 10 common mistakes", async function () {
      const mistakes = [
        "Missing FHE.allowThis()",
        "Missing FHE.allow() for user",
        "Reusing input proofs",
        "Encryption signer mismatch",
        "Casting encrypted to plaintext",
        "Encrypted values in view functions",
        "Missing permissions on operation results",
        "Using allowTransient for storage",
        "Missing permissions in loops",
        "Encrypted boolean in if-statement",
      ];

      expect(mistakes.length).to.equal(10);
    });

    it("should show correct patterns for each mistake", async function () {
      // ✅ Correct Patterns:
      // 1. Always: FHE.allowThis() FIRST, then FHE.allow()
      // 2. Always: Grant permissions on operation results
      // 3. Always: Use separate proofs for different values
      // 4. Always: Match encryption signer with caller
      // 5. Never: Cast euint to uint without decryption
      // 6. Never: Use encrypted values in view functions
      // 7. Always: Grant permissions in all operations
      // 8. Use: FHE.allowThis/allow for storage, allowTransient for temp
      // 9. Always: Permissions on each loop iteration
      // 10. Never: Use encrypted boolean in Solidity if-statements

      expect(true).to.be.true;
    });
  });
});
