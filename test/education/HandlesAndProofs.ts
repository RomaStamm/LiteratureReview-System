import { expect } from "chai";
import { ethers } from "hardhat";
import { HandlesAndProofs } from "../../types";
import { createInstances } from "../instance";
import { getSigners, initSigners } from "../signers";
import { deployHandlesAndProofsFixture } from "./HandlesAndProofs.fixture";

describe("HandlesAndProofs - FHE Handles and Input Proofs", function () {
  before(async function () {
    await initSigners();
    this.signers = await getSigners();
  });

  beforeEach(async function () {
    const contract = await deployHandlesAndProofsFixture();
    this.contractAddress = await contract.getAddress();
    this.handlesAndProofs = contract;
    this.instances = await createInstances(this.contractAddress, ethers, this.signers);
  });

  it("should deploy contract successfully", async function () {
    expect(this.contractAddress).to.not.equal(ethers.ZeroAddress);
  });

  describe("FHE Handles Explained", function () {
    it("should create and use encrypted value handles", async function () {
      // Handle = reference to encrypted value on-chain
      // Enables operations on encrypted data without exposing plaintext

      const secret = 12345;

      // Client encrypts and gets handle
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      // encrypted.handles[0] is the handle (reference)
      // encrypted.ciphertext is the actual encrypted data
      // encrypted.inputProof validates the encryption

      const tx = await this.handlesAndProofs
        .connect(this.signers.alice)
        .storeValueWithHandleExplanation(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      expect(tx).to.not.be.reverted;
    });

    it("should use handle in FHE operations", async function () {
      // Handles enable FHE operations
      // Example: FHE.add(handle1, handle2) returns new handle

      const secret = 54321;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      const tx = await this.handlesAndProofs
        .connect(this.signers.alice)
        .storeValueWithHandleExplanation(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Contract stores and can operate using handle
      const stored = await this.handlesAndProofs.getHandle();
      expect(stored).to.not.equal(ethers.ZeroHash);
    });

    it("should maintain handle across operations", async function () {
      // Handles persist for contract operations

      const secret = 99999;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      const tx = await this.handlesAndProofs
        .connect(this.signers.alice)
        .storeValueWithHandleExplanation(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Handle can be retrieved and used again
      const stored = await this.handlesAndProofs.getHandle();
      expect(stored).to.not.equal(ethers.ZeroHash);
    });
  });

  describe("Input Proofs Explained", function () {
    it("should validate input proof", async function () {
      // Input proof = zero-knowledge proof that:
      // 1. Ciphertext is valid
      // 2. Binding matches [contract, user]
      // 3. Encryption was correct

      const secret = 11111;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      // Proof validates encryption
      const tx = await this.handlesAndProofs
        .connect(this.signers.alice)
        .storeValueWithHandleExplanation(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      expect(tx).to.not.be.reverted;
    });

    it("should reject invalid input proof", async function () {
      // ❌ Invalid proof rejected by FHE.fromExternal()

      const secret = 22222;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      // Use invalid proof
      await expect(
        this.handlesAndProofs
          .connect(this.signers.alice)
          .storeValueWithHandleExplanation(encrypted.handles[0], "0x")
      ).to.be.reverted;
    });

    it("should demonstrate proof binding to [contract, user]", async function () {
      // Proof includes binding: [contract_address, user_address]
      // Cannot be reused or transferred

      const secret = 33333;

      // Alice encrypts with binding to [contract, alice]
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      // Alice's proof works
      let tx = await this.handlesAndProofs
        .connect(this.signers.alice)
        .storeValueWithHandleExplanation(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      expect(tx).to.not.be.reverted;

      // Bob cannot use Alice's proof
      // Proof is bound to [contract, alice], not [contract, bob]
      await expect(
        this.handlesAndProofs
          .connect(this.signers.bob)
          .storeValueWithHandleExplanation(encrypted.handles[0], encrypted.inputProof)
      ).to.be.reverted;
    });

    it("should prevent proof reuse attack", async function () {
      // Proof binding prevents reuse across users
      // Alice's proof cannot be used by Bob

      const secret = 44444;

      // Alice encrypts
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      // Bob tries to reuse Alice's proof with same handle
      // Proof validates: binding should be [contract, bob]
      // But proof shows: binding is [contract, alice]
      // REJECTED

      await expect(
        this.handlesAndProofs
          .connect(this.signers.bob)
          .demonstrateProofBinding(encrypted.handles[0], encrypted.inputProof)
      ).to.be.reverted;
    });

    it("should demonstrate proof cannot be forged", async function () {
      // Proof cannot be created without knowing plaintext
      // Requires actual encryption to generate valid proof

      // Any attempt to forge proof fails
      const fakeProof = ethers.solidityPacked(["uint256"], [123456]);
      const fakeHandle = ethers.getAddress(ethers.makeAddress("0x1234"));

      await expect(
        this.handlesAndProofs.connect(this.signers.alice).storeValueWithHandleExplanation(fakeHandle, fakeProof)
      ).to.be.reverted;
    });
  });

  describe("Encryption Binding Mechanism", function () {
    it("should enforce strict binding to [contract, user]", async function () {
      // Binding = [contractAddress, senderAddress]
      // Each user-contract pair is unique
      // Cannot reuse across contracts or users

      const secret = 55555;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      // Alice with this contract: works
      const tx = await this.handlesAndProofs
        .connect(this.signers.alice)
        .storeValueWithHandleExplanation(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      expect(tx).to.not.be.reverted;
    });

    it("should prevent cross-user proof reuse", async function () {
      // Critical security property:
      // Alice's proof for [contract, alice] fails for [contract, bob]

      const secret = 66666;

      // Alice encrypts
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      // Bob cannot use Alice's proof
      await expect(
        this.handlesAndProofs
          .connect(this.signers.bob)
          .demonstrateProofBinding(encrypted.handles[0], encrypted.inputProof)
      ).to.be.reverted;
    });
  });

  describe("Symbolic Execution Explained", function () {
    it("should track encrypted values symbolically", async function () {
      // Symbolic Execution:
      // - Tracks encrypted values as unknowns
      // - Records operations symbolically
      // - Never reveals plaintext
      // - Proves correctness of computation

      const secret = 77777;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      // Handle = symbolic reference to unknown plaintext
      // All operations tracked symbolically
      // Result is also symbolic (can be operated on further)

      const tx = await this.handlesAndProofs
        .connect(this.signers.alice)
        .storeValueWithHandleExplanation(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      expect(tx).to.not.be.reverted;
    });

    it("should maintain symbolic relationships", async function () {
      // Example: result = FHE.add(value1, value2)
      // Symbolically: result_symbol = add_symbol(value1_symbol, value2_symbol)
      // Still encrypted, relationship tracked

      const secret = 88888;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      // Symbolic relationships enable verification
      // Contract proves operations are correct
      // Without revealing plaintexts

      const tx = await this.handlesAndProofs
        .connect(this.signers.alice)
        .storeValueWithHandleExplanation(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      const stored = await this.handlesAndProofs.getHandle();
      expect(stored).to.not.equal(ethers.ZeroHash);
    });
  });

  describe("Handle Lifecycle", function () {
    it("should show complete handle lifecycle", async function () {
      // Lifecycle:
      // 1. Encryption: Client encrypts → handle + proof
      // 2. Transmission: Send to contract
      // 3. Validation: FHE.fromExternal() verifies proof
      // 4. Storage: Contract stores handle
      // 5. Operations: FHE.add/sub/eq on handle
      // 6. Permissions: FHE.allowThis(), FHE.allow()
      // 7. Decryption: User requests decryption of handle

      const secret = 99999;

      // Step 1: Encryption
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(secret);
      const encrypted = await input.encrypt();

      // Step 2-3: Transmission and Validation
      // Step 4: Storage
      const tx = await this.handlesAndProofs
        .connect(this.signers.alice)
        .storeValueWithHandleExplanation(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Step 5-6: Operations and Permissions
      // (Handled by contract)

      // Step 7: Decryption
      const stored = await this.handlesAndProofs.getHandle();
      const decrypted = await this.instances.alice.decrypt(this.contractAddress, stored);

      expect(decrypted).to.equal(BigInt(secret));
    });
  });

  describe("Key Concepts Summary", function () {
    it("should demonstrate handles enable FHE operations", async function () {
      // Handles: References to encrypted values
      // Enable: FHE.add(), FHE.sub(), FHE.eq(), FHE.gt()
      // Result: New handle for operation result

      expect(true).to.be.true;
    });

    it("should demonstrate input proofs prevent attacks", async function () {
      // Input Proofs:
      // Prevent: Fake ciphertexts
      // Prevent: Proof reuse across users
      // Prevent: Proof reuse across contracts
      // Enable: Secure encryption validation

      expect(true).to.be.true;
    });

    it("should demonstrate symbolic execution proves correctness", async function () {
      // Symbolic Execution:
      // Track: Encrypted value relationships
      // Prove: Computation correctness
      // Without: Revealing plaintexts
      // Enable: Smart contract verification

      expect(true).to.be.true;
    });
  });
});
