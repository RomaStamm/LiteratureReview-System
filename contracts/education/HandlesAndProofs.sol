// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title Handles and Input Proofs Explanation
 * @notice Educational guide to understanding FHE handles and input proofs
 * @dev Explains the critical security mechanism in FHEVM
 */
contract HandlesAndProofs is SepoliaConfig {
  /// @notice Store encrypted values
  euint32 private encryptedValue;

  /// @notice Track handle creation
  event HandleCreated(address indexed user, uint256 timestamp);

  /**
   * HANDLES EXPLAINED
   *
   * What is a Handle?
   * ================
   * A handle is a REFERENCE to an encrypted value on-chain.
   * NOT the actual ciphertext, but a pointer to it.
   *
   * Analogy:
   * Handle = Library book ID (e.g., "ISBN-12345")
   * Ciphertext = The actual encrypted book on the shelf
   *
   * Why Handles?
   * ============
   * 1. Compact representation
   *    - 32-byte ciphertext → Small handle ID
   *
   * 2. Enable operations
   *    - FHE.add(handle1, handle2) → New handle
   *    - Contract knows which encrypted values to operate on
   *
   * 3. Permission management
   *    - FHE.allow(handle, user)
   *    - Links user to specific encrypted value
   *
   * 4. Return from functions
   *    - Functions return handles, not plaintext
   *    - Users can decrypt handles via relayer
   *
   * Handle Lifecycle
   * ================
   *
   * 1. CREATION
   *    - Client encrypts locally:
   *      const enc = await fhevm.createEncryptedInput(addr, user)
   *        .add32(secret).encrypt();
   *    - Returns:
   *      - Ciphertext (sent to contract)
   *      - Handles (euint32 references)
   *      - Input proofs (validation proofs)
   *
   * 2. TRANSMISSION
   *    - Client sends to contract:
   *      await contract.storeValue(encCiphertext, inputProof);
   *
   * 3. VERIFICATION
   *    - Contract calls FHE.fromExternal(ciphertext, proof)
   *    - Proof validates:
   *      ✅ Ciphertext is valid
   *      ✅ Binding matches [contract, user]
   *      ✅ Encryption was correct
   *    - Returns handle to encrypted value
   *
   * 4. USAGE
   *    - Contract operates using handles
   *    - FHE.add(handle1, handle2)
   *    - Creates new handle for result
   *
   * 5. STORAGE
   *    - Stores handle (not ciphertext)
   *    - Storage optimized
   *    - Can be retrieved later
   *
   * 6. DECRYPTION
   *    - User requests decryption of handle
   *    - Relayer looks up encrypted value
   *    - Performs threshold decryption
   *    - Returns plaintext to user
   *
   * Example Flow:
   * =============
   *
   * Step 1: Client-side encryption
   *   const enc = await fhevm.createEncryptedInput(
   *     contractAddress,
   *     aliceAddress  // Binding parameter 1
   *   ).add32(secret)   // Value to encrypt
   *    .encrypt();      // Returns: {handles, ciphertext, inputProof}
   *
   * Step 2: Send to contract
   *   const tx = await contract.storeValue(
   *     enc.ciphertext,  // The encrypted data
   *     enc.inputProof   // Proof that encryption is valid
   *   );
   *
   * Step 3: Contract receives and validates
   *   function storeValue(
   *     externalEuint32 ciphertext,
   *     bytes calldata inputProof
   *   ) external {
   *     // Validates proof and returns handle
   *     euint32 handle = FHE.fromExternal(ciphertext, inputProof);
   *     // Now have handle to encrypted value
   *     storedValue = handle;
   *   }
   *
   * Step 4: Contract operates on handle
   *   euint32 result = FHE.add(handle1, handle2);
   *   // New handle created for result
   *
   * Step 5: Client decrypts handle
   *   const plaintext = await relayer.decrypt(
   *     contractAddress,
   *     handle
   *   );
   *   // Returns decrypted value
   */

  /**
   * @notice Demonstrate handle creation and usage
   * @param value Encrypted value with proof
   * @param inputProof Zero-knowledge proof
   */
  function storeValueWithHandleExplanation(
    externalEuint32 value,
    bytes calldata inputProof
  ) external {
    // ✅ FHE.fromExternal creates HANDLE from CIPHERTEXT + PROOF
    // This is the critical step where:
    // 1. Proof is validated
    // 2. Binding [contract, user] is verified
    // 3. Handle is created for the encrypted value
    euint32 handle = FHE.fromExternal(value, inputProof);

    // Now 'handle' is a reference to the encrypted value
    // We can:
    // - Store it
    // - Use it in operations
    // - Return it
    // - Grant permissions to it

    encryptedValue = handle;

    emit HandleCreated(msg.sender, block.timestamp);
  }

  /**
   * INPUT PROOFS EXPLAINED
   *
   * What is an Input Proof?
   * =======================
   * A zero-knowledge proof that proves:
   * 1. Ciphertext is valid and well-formed
   * 2. Encryption binding matches [contract, user]
   * 3. The claimed plaintext was encrypted correctly
   *
   * WITHOUT revealing the plaintext!
   *
   * Why Input Proofs?
   * =================
   *
   * Security:
   * ✅ Prevents fake ciphertexts
   * ✅ Validates user participation
   * ✅ Ensures correct encryption
   * ✅ Prevents replay attacks
   * ✅ Binds value to specific [contract, user]
   *
   * Example Threat (Without Input Proofs):
   * ======================================
   *
   * Attack Scenario:
   * 1. Mallory sees Alice's encrypted bid in auction
   * 2. Mallory copies the ciphertext
   * 3. Mallory submits same ciphertext as her own bid
   * 4. Both Alice and Mallory have same encrypted bid!
   * 5. Winner election becomes confused
   *
   * Solution: Input Proofs
   * ======================
   * 1. Mallory cannot reuse Alice's proof
   *    - Proof binds to [contract, Alice]
   *    - Reusing for [contract, Mallory] fails
   *
   * 2. Mallory cannot forge her own proof
   *    - Requires knowledge of plaintext
   *    - Requires encryption of her value
   *
   * 3. Input proof is one-time use
   *    - Cannot be reused across values
   *    - Cannot be reused across users
   *
   * Input Proof Structure
   * =====================
   * Zero-knowledge proof proving:
   *
   * Proof = ZK{
   *   ciphertext correctly encrypts plaintext,
   *   binding equals [contract_address, sender_address],
   *   encryption was performed correctly
   * }
   *
   * This proof is:
   * ✅ Compact (small size)
   * ✅ Fast to verify
   * ✅ Non-interactive
   * ✅ Cannot be forged without plaintext knowledge
   *
   * Proof Validation in Contract
   * =============================
   *
   * Step 1: Receive ciphertext and proof
   *   externalEuint32 ciphertext,
   *   bytes calldata inputProof
   *
   * Step 2: Contract calls FHE.fromExternal()
   *   euint32 handle = FHE.fromExternal(ciphertext, inputProof);
   *
   * Step 3: FHE system validates:
   *   ✅ Proof is cryptographically valid
   *   ✅ Binding matches this contract + msg.sender
   *   ✅ Ciphertext is well-formed
   *   ✅ No tampering occurred
   *
   * Step 4: If validation succeeds
   *   Handle created successfully
   *   Value can be used
   *
   * Step 5: If validation fails
   *   Transaction reverts
   *   No handle created
   *   Invalid encryption rejected
   *
   * Proof Reuse Attack Prevention
   * =============================
   *
   * Scenario: Can Alice's proof be reused?
   *
   * NO! Because proof includes binding:
   * Alice encrypts for [contract, Alice]
   * Proof proves binding = [contract, Alice]
   *
   * If Bob tries to use same proof:
   * Validation requires binding = [contract, Bob]
   * Proof doesn't match
   * Validation fails
   * Bob's usage is rejected
   *
   * Key Insight:
   * ============
   * Input proofs are the FOUNDATION of FHEVM security
   *
   * They ensure:
   * 1. Only correct encryptions are accepted
   * 2. Proofs cannot be forged
   * 3. Proofs cannot be replayed
   * 4. Encryption binding is verified
   * 5. Users cannot spoof others' values
   */

  /**
   * @notice Demonstrate proof binding
   * @dev Shows that each user needs their own proof
   *
   * CRITICAL: Proof from Alice cannot be used by Bob!
   *
   * Why?
   * Proof proves binding = [contract, Alice]
   * But Bob is msg.sender, so binding = [contract, Bob]
   * Mismatch! Validation fails!
   *
   * @param aliceValue Alice's encrypted value
   * @param aliceProof Proof Alice created (binds to Alice)
   */
  function demonstrateProofBinding(
    externalEuint32 aliceValue,
    bytes calldata aliceProof
  ) external {
    // ✅ This works if msg.sender is Alice
    // ❌ This fails if msg.sender is Bob

    // Why?
    // aliceProof proves binding = [contract, Alice]
    // But FHE.fromExternal checks binding = [contract, msg.sender]
    // If msg.sender != Alice, binding doesn't match!

    euint32 handle = FHE.fromExternal(aliceValue, aliceProof);
    encryptedValue = handle;
  }

  /**
   * @notice Get stored handle
   * @return The encrypted value handle
   */
  function getHandle() external view returns (euint32) {
    return encryptedValue;
  }

  /**
   * SYMBOLIC EXECUTION EXPLAINED
   *
   * What is Symbolic Execution?
   * ===========================
   * A technique that:
   * 1. Treats ciphertexts as symbolic values
   * 2. Tracks operations symbolically
   * 3. Determines handle relationships
   * 4. Verifies computation correctness
   *
   * Example:
   * --------
   * encryptedA = encrypt(plaintext_A)
   * encryptedB = encrypt(plaintext_B)
   * result = FHE.add(encryptedA, encryptedB)
   *
   * Symbolic Execution Traces:
   * - encryptedA represents unknown plaintext
   * - encryptedB represents unknown plaintext
   * - result represents sum of unknowns
   * - Never reveals actual values
   * - Still proves correctness
   *
   * Why Symbolic Execution?
   * =======================
   * 1. Verifies operation sequences
   * 2. Ensures correct handle usage
   * 3. Proves computation without decryption
   * 4. Enables smart contract verification
   * 5. Prevents logical errors
   *
   * How FHEVM Uses Symbolic Execution
   * ==================================
   * 1. Tracks each encrypted value
   * 2. Records operations on encrypted values
   * 3. Symbolic execution determines:
   *    - Is this operation valid?
   *    - Do permissions allow this?
   *    - Is handle usage correct?
   * 4. Enables correct computation
   * 5. Prevents type errors
   *
   * Example in FHEVM:
   * =================
   *
   * Symbolic Value: euint32 x
   * Represents: An unknown 32-bit encrypted value
   *
   * Operation: euint32 y = FHE.add(x, x);
   * Symbolic Execution:
   *   y = add_symbolic(x_unknown, x_unknown)
   *   y now represents sum of two identical unknowns
   *   Still secret, but relationship is tracked
   *
   * Benefits:
   * - Verify add() works correctly
   * - Ensure handle is properly managed
   * - Prove computation is valid
   * - No plaintext exposure
   */

  /**
   * SUMMARY: Handle Lifecycle
   *
   * 1. Encryption (Client-Side)
   *    ↓ Client encrypts value locally
   *    ↓ Get ciphertext + handles + input proof
   *
   * 2. Transmission (Network)
   *    ↓ Send ciphertext and input proof to contract
   *
   * 3. Validation (Contract)
   *    ↓ Contract calls FHE.fromExternal()
   *    ↓ Proof validated
   *    ↓ Binding verified
   *    ↓ Handle created
   *
   * 4. Storage (On-Chain)
   *    ↓ Store handle reference
   *    ↓ Grant permissions
   *
   * 5. Operations (Contract Logic)
   *    ↓ FHE.add(handle1, handle2)
   *    ↓ Creates new handle for result
   *    ↓ Symbolic execution proves correctness
   *
   * 6. Access Control (Permissions)
   *    ↓ FHE.allowThis(handle)
   *    ↓ FHE.allow(handle, user)
   *    ↓ User can decrypt via relayer
   *
   * 7. Decryption (Client-Side)
   *    ↓ Request decryption of handle
   *    ↓ Relayer performs threshold decryption
   *    ↓ Returns plaintext to authorized user
   */
}

/**
 * KEY CONCEPTS SUMMARY
 *
 * Handles:
 * - References to encrypted values
 * - Enable operations on encrypted data
 * - Returned from functions
 * - Used in permission management
 *
 * Input Proofs:
 * - Zero-knowledge proofs of valid encryption
 * - Cannot be forged without plaintext
 * - Cannot be replayed across users
 * - Verify binding [contract, user]
 *
 * Symbolic Execution:
 * - Tracks operations on encrypted values
 * - Never reveals plaintexts
 * - Proves computation correctness
 * - Enables smart contract verification
 *
 * Together, they enable:
 * ✅ Confidential computation
 * ✅ Correct operation sequences
 * ✅ Secure permission management
 * ✅ Privacy-preserving smart contracts
 */
