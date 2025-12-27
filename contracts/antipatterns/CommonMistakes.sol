// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title Common Mistakes and Anti-Patterns in FHEVM
 * @notice ❌ INTENTIONALLY SHOWS WRONG CODE ❌
 * @dev This contract demonstrates what NOT to do
 *
 * DO NOT USE THESE PATTERNS IN PRODUCTION!
 * This is educational material showing incorrect implementations.
 */

contract CommonMistakes is SepoliaConfig {
  euint32 private value;

  /**
   * ❌ ANTI-PATTERN 1: Missing FHE.allowThis()
   * @dev This function WILL FAIL
   *
   * Problem:
   * - Contract tries to use encrypted value without permission
   * - FHE operations require FHE.allowThis()
   * - Storing without permission causes issues later
   *
   * Why it's wrong:
   * - Contract cannot decrypt or use encrypted values
   * - Will fail when trying to operate on value
   * - User cannot decrypt either (permission still missing)
   */
  function mistake1_MissingAllowThis(
    externalEuint32 input,
    bytes calldata proof
  ) external {
    euint32 enc = FHE.fromExternal(input, proof);

    // ❌ WRONG: Only user permission, missing contract permission
    FHE.allow(enc, msg.sender);
    // Should also call: FHE.allowThis(enc);

    value = enc;
    // ❌ FAILS if contract later tries to use this value
  }

  /**
   * ❌ ANTI-PATTERN 2: Missing FHE.allow() for User
   * @dev User CANNOT decrypt their own value
   *
   * Problem:
   * - User needs permission to decrypt
   * - Storing value with only contract permission
   * - User cannot access their own encrypted data
   *
   * Why it's wrong:
   * - User relies on FHE.allow() to decrypt via relayer
   * - Without it, relayer will reject decryption
   * - Value is trapped on-chain
   */
  function mistake2_MissingUserPermission(
    externalEuint32 input,
    bytes calldata proof
  ) external {
    euint32 enc = FHE.fromExternal(input, proof);

    // ❌ WRONG: Only contract permission
    FHE.allowThis(enc);
    // Should also call: FHE.allow(enc, msg.sender);

    value = enc;
    // ❌ User CANNOT decrypt this value
  }

  /**
   * ❌ ANTI-PATTERN 3: Encrypted Value in View Function
   * @dev View functions cannot return encrypted values
   *
   * Problem:
   * - View functions are read-only (no state changes)
   * - But returning euint32 requires special handling
   * - This pattern is discouraged
   *
   * Note: Modern FHEVM might support this,
   * but it's better practice to avoid it.
   */
  function mistake3_EncryptedInView() external view returns (euint32) {
    // ❌ PROBLEMATIC: Returning encrypted value from view
    // Should return handle string instead
    return value;
  }

  /**
   * ❌ ANTI-PATTERN 4: Multiple Encrypted Values Without Proof
   * @dev Each encrypted value needs its own proof
   *
   * Problem:
   * - Trying to use single proof for multiple values
   * - Input proofs are value-specific
   * - Cannot reuse proof for different values
   *
   * Why it's wrong:
   * - Proof binding is specific to plaintext value
   * - Different ciphertexts need different proofs
   * - Will fail at FHE.fromExternal()
   */
  function mistake4_ReusingInputProof(
    externalEuint32 value1,
    externalEuint32 value2,
    bytes calldata singleProof  // ❌ Only one proof for TWO values!
  ) external {
    // ❌ WRONG: Using same proof for different values
    euint32 enc1 = FHE.fromExternal(value1, singleProof);  // May work
    euint32 enc2 = FHE.fromExternal(value2, singleProof);  // FAILS!

    // Should use separate proofs:
    // function mistake4_Fixed(
    //   externalEuint32 value1,
    //   externalEuint32 value2,
    //   bytes calldata proof1,  // ✅ Separate proof
    //   bytes calldata proof2   // ✅ Separate proof
    // ) external { ... }
  }

  /**
   * ❌ ANTI-PATTERN 5: Encryption Signer Mismatch
   * @dev Input proof validates specific [contract, user] binding
   *
   * Problem:
   * - Client encrypts for user A
   * - But user B calls the contract
   * - Input proof validation fails
   *
   * Why it's wrong (Client-Side Example):
   *   // ❌ Alice encrypts
   *   const enc = await fhevm.createEncryptedInput(
   *     contract.address,
   *     alice.address  // Encryption signer
   *   ).add32(secret).encrypt();
   *
   *   // ❌ But Bob calls contract
   *   await contract.connect(bob).store(
   *     enc.handles[0],
   *     enc.inputProof  // Fails! Bob ≠ Alice
   *   );
   *
   * ✅ CORRECT approach:
   *   const enc = await fhevm.createEncryptedInput(
   *     contract.address,
   *     bob.address  // Match the actual caller
   *   ).add32(secret).encrypt();
   *
   *   await contract.connect(bob).store(
   *     enc.handles[0],
   *     enc.inputProof  // Success! Bob == Bob
   *   );
   */
  function mistake5_SignerMismatch(
    externalEuint32 input,
    bytes calldata proof
  ) external {
    // If client encrypted for different address,
    // FHE.fromExternal() will fail validation
    // This should fail with error about binding validation
    euint32 enc = FHE.fromExternal(input, proof);
    value = enc;
  }

  /**
   * ❌ ANTI-PATTERN 6: Casting Encrypted to Uint32
   * @dev Cannot simply cast encrypted to plaintext
   *
   * Problem:
   * - euint32 cannot be cast to uint32
   * - Decryption requires relayer and async operation
   * - No direct plaintext conversion possible
   *
   * Why it's wrong:
   *   euint32 encValue = ...;
   *   uint32 plain = uint32(encValue);  // ❌ COMPILE ERROR
   *
   * Correct approach:
   * 1. Request decryption via relayer
   * 2. Callback receives plaintext
   * 3. Then use in application logic
   */
  function mistake6_CastingEncrypted(
    externalEuint32 input,
    bytes calldata proof
  ) external {
    euint32 enc = FHE.fromExternal(input, proof);

    // ❌ WRONG: Cannot cast encrypted to plain
    // uint32 plain = uint32(enc);  // COMPILE ERROR

    // ✅ CORRECT: Request async decryption
    // uint256 requestId = Gateway.requestDecryption(
    //   enc,
    //   this.decryptionCallback.selector
    // );
  }

  /**
   * ❌ ANTI-PATTERN 7: Comparing Without Storing Permissions
   * @dev Comparisons need permissions too
   *
   * Problem:
   * - After FHE comparison, result needs permissions
   * - Forgetting to grant permissions to result
   * - Cannot use result later
   */
  function mistake7_NoPermissionsOnComparison(
    externalEuint32 value1,
    externalEuint32 value2,
    bytes calldata proof1,
    bytes calldata proof2
  ) external {
    euint32 enc1 = FHE.fromExternal(value1, proof1);
    euint32 enc2 = FHE.fromExternal(value2, proof2);

    // ❌ WRONG: Forgetting permissions on result
    var result = FHE.eq(enc1, enc2);
    // Missing: FHE.allowThis(result);
    // Missing: FHE.allow(result, msg.sender);
  }

  /**
   * ❌ ANTI-PATTERN 8: Using allowTransient for Storage
   * @dev allowTransient permissions expire after transaction
   *
   * Problem:
   * - allowTransient is temporary (current transaction only)
   * - Storing value expects persistent permissions
   * - User cannot decrypt later
   *
   * Why it's wrong:
   *   euint32 value = ...;
   *   FHE.allowThis(value);
   *   FHE.allowTransient(value, msg.sender);  // ❌ Temporary!
   *   userValues[msg.sender] = value;
   *   // ❌ User cannot decrypt later (permission expired)
   *
   * ✅ CORRECT:
   *   FHE.allowThis(value);
   *   FHE.allow(value, msg.sender);  // ✅ Persistent
   *   userValues[msg.sender] = value;
   */
  function mistake8_AllowTransientForStorage(
    externalEuint32 input,
    bytes calldata proof
  ) external {
    euint32 enc = FHE.fromExternal(input, proof);

    FHE.allowThis(enc);
    FHE.allowTransient(enc, msg.sender);  // ❌ Wrong! Use FHE.allow()
    value = enc;
  }

  /**
   * ❌ ANTI-PATTERN 9: Forgetting Permissions in Loop
   * @dev Multiple values need permissions for EACH
   *
   * Problem:
   * - Processing array of encrypted values
   * - Only granting permissions to first value
   * - Other values become inaccessible
   */
  function mistake9_PermissionsInLoop(
    externalEuint32[] calldata inputs,
    bytes[] calldata proofs
  ) external {
    for (uint256 i = 0; i < inputs.length; i++) {
      euint32 enc = FHE.fromExternal(inputs[i], proofs[i]);

      if (i == 0) {
        // ❌ WRONG: Only first value gets permissions
        FHE.allowThis(enc);
        FHE.allow(enc, msg.sender);
      }
      // ❌ Other values have no permissions!
    }
  }

  /**
   * ❌ ANTI-PATTERN 10: Conditional Logic on Encrypted Boolean
   * @dev Cannot use ebool in if-statements
   *
   * Problem:
   * - FHE.eq() returns ebool (encrypted)
   * - Cannot decrypt to decide branching
   * - If-statement requires plaintext condition
   *
   * Why it's wrong:
   *   ebool result = FHE.eq(value1, value2);
   *   if (result) {  // ❌ Cannot use encrypted boolean
   *     // ...
   *   }
   *
   * ✅ CORRECT approaches:
   * 1. Keep logic encrypted (use FHE.select)
   * 2. Decrypt separately via relayer
   * 3. Different transaction for branching
   */
  function mistake10_EncryptedConditional(
    externalEuint32 val1,
    externalEuint32 val2,
    bytes calldata proof1,
    bytes calldata proof2
  ) external {
    euint32 enc1 = FHE.fromExternal(val1, proof1);
    euint32 enc2 = FHE.fromExternal(val2, proof2);

    var isEqual = FHE.eq(enc1, enc2);

    // ❌ WRONG: Cannot use encrypted in if-statement
    // if (isEqual) { ... }

    // ✅ CORRECT alternatives:
    // 1. Use FHE.select() for encrypted branching
    // 2. Decrypt separately in another transaction
    // 3. Always execute both branches, mask results
  }
}

/**
 * SUMMARY OF ANTI-PATTERNS
 *
 * ❌ 1. Missing FHE.allowThis() - Contract cannot use value
 * ❌ 2. Missing FHE.allow() - User cannot decrypt
 * ❌ 3. Encrypted in view - Discouraged pattern
 * ❌ 4. Reusing input proof - Specific to each value
 * ❌ 5. Signer mismatch - Proof validation fails
 * ❌ 6. Casting to plaintext - Must use relayer
 * ❌ 7. No permissions on results - Comparison results need permissions
 * ❌ 8. allowTransient for storage - Permissions expire
 * ❌ 9. Missing loop permissions - Each value needs permissions
 * ❌ 10. Encrypted boolean in if - Must decrypt first
 */

/**
 * KEY TAKEAWAYS
 *
 * 1. PERMISSIONS ARE CRITICAL
 *    ✅ Always: FHE.allowThis() first
 *    ✅ Always: FHE.allow() for users who need access
 *    ✅ Remember: Every encrypted value needs BOTH
 *
 * 2. INPUT PROOFS ARE SPECIFIC
 *    ✅ One proof per ciphertext
 *    ✅ Proof validates [contract, user, plaintext] binding
 *    ✅ Cannot reuse or swap proofs
 *
 * 3. DECRYPTION IS ASYNCHRONOUS
 *    ✅ Contract never sees plaintext
 *    ✅ User requests decryption via relayer
 *    ✅ Client-side decryption with private key
 *
 * 4. DESIGN FOR PRIVACY
 *    ✅ Keep data encrypted as long as possible
 *    ✅ Only decrypt when absolutely necessary
 *    ✅ Use FHE operations on encrypted data
 *
 * 5. TEST THOROUGHLY
 *    ✅ Test permission granting
 *    ✅ Test multiple users accessing data
 *    ✅ Test permission edge cases
 *    ✅ Test error conditions
 */
