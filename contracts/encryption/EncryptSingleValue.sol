// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title Encrypt Single Value Example
 * @notice Demonstrates how to receive and store a single encrypted value
 * @dev Shows common pitfalls and correct encryption patterns
 */
contract EncryptSingleValue is SepoliaConfig {
  /// @notice Stores a single encrypted value
  euint32 private storedValue;

  /// @notice Maps addresses to their encrypted values
  mapping(address => euint32) private userValues;

  /// @notice Event emitted when a value is encrypted and stored
  event ValueEncrypted(address indexed user, uint256 timestamp);

  /**
   * @notice Store a single encrypted value
   * @dev Demonstrates correct encryption binding pattern
   *
   * Critical Points:
   * 1. Input proof validates encryption binding
   * 2. Binding is [contract address, user address]
   * 3. User who encrypted must match msg.sender
   *
   * @param encryptedInput The encrypted value (type: externalEuint32)
   * @param inputProof Zero-knowledge proof validating the encryption
   */
  function storeEncryptedValue(
    externalEuint32 encryptedInput,
    bytes calldata inputProof
  ) external {
    // ✅ CORRECT: Convert external encrypted input using input proof
    // Input proof validates:
    // - Encryption was done correctly
    // - Binding matches [this contract, msg.sender]
    // - User who encrypted is msg.sender
    euint32 value = FHE.fromExternal(encryptedInput, inputProof);

    // Store the encrypted value
    storedValue = value;
    userValues[msg.sender] = value;

    // ✅ CRITICAL: Grant both permissions
    FHE.allowThis(value);
    FHE.allow(value, msg.sender);

    emit ValueEncrypted(msg.sender, block.timestamp);
  }

  /**
   * @notice Store value for any user (authorized function)
   * @dev Demonstrates storing encrypted value for another user
   *
   * @param user The user whose value is being stored
   * @param encryptedInput The encrypted value
   * @param inputProof The encryption proof
   */
  function storeValueForUser(
    address user,
    externalEuint32 encryptedInput,
    bytes calldata inputProof
  ) external {
    // Note: Input proof was created with 'user' as encryption signer
    // This validates that 'user' encrypted this value
    euint32 value = FHE.fromExternal(encryptedInput, inputProof);

    userValues[user] = value;

    FHE.allowThis(value);
    FHE.allow(value, user);

    emit ValueEncrypted(user, block.timestamp);
  }

  /**
   * @notice Get stored encrypted value
   * @return The encrypted value (not decrypted)
   */
  function getStoredValue() external view returns (euint32) {
    return storedValue;
  }

  /**
   * @notice Get user's encrypted value
   * @param user The user whose value to retrieve
   * @return The encrypted value
   */
  function getUserValue(address user) external view returns (euint32) {
    return userValues[user];
  }
}

/**
 * COMMON PITFALL 1: Ignoring Input Proof
 *
 * ❌ INCORRECT:
 *   function storeValue(externalEuint32 encryptedInput) external {
 *     euint32 value = FHE.asEuint32(0);  // WRONG! Ignores input
 *     storedValue = value;
 *   }
 *
 * The input proof MUST be passed to FHE.fromExternal()
 * Without it, you cannot validate the encryption binding
 *
 * ✅ CORRECT:
 *   function storeValue(
 *     externalEuint32 encryptedInput,
 *     bytes calldata inputProof
 *   ) external {
 *     euint32 value = FHE.fromExternal(encryptedInput, inputProof);
 *     storedValue = value;
 *   }
 */

/**
 * COMMON PITFALL 2: Encryption Signer Mismatch
 *
 * ❌ INCORRECT:
 * Client-side TypeScript:
 *   const enc = await fhevm.createEncryptedInput(
 *     contract.address,
 *     alice.address  // Alice encrypts
 *   ).add32(secret).encrypt();
 *
 * Contract-side Solidity:
 *   await contract.connect(bob).storeValue(
 *     enc.handles[0],  // Bob calls with Alice's encryption
 *     enc.inputProof
 *   );  // FAILS! Proof was for Alice
 *
 * ✅ CORRECT:
 * Client-side TypeScript:
 *   const signer = alice.address;  // Who will call the contract
 *   const enc = await fhevm.createEncryptedInput(
 *     contract.address,
 *     signer
 *   ).add32(secret).encrypt();
 *
 * Contract-side Solidity:
 *   await contract.connect(alice).storeValue(
 *     enc.handles[0],
 *     enc.inputProof
 *   );  // SUCCESS! Signer matches
 */

/**
 * ENCRYPTION BINDING EXPLAINED
 *
 * When you encrypt a value for FHEVM:
 * 1. Client chooses 3 parameters:
 *    - Contract address
 *    - User address
 *    - Plaintext value
 *
 * 2. Encryption creates binding: [contract, user]
 *    - Same plaintext with different [contract, user] = different ciphertexts
 *    - This prevents replay attacks
 *    - Ensures user cannot use their encrypted value in another contract
 *
 * 3. Input proof proves:
 *    - Encryption was done correctly
 *    - Ciphertext really encrypts the claimed plaintext
 *    - Binding matches [this contract, claimed user]
 *
 * 4. Contract verifies with FHE.fromExternal()
 *    - Validates input proof
 *    - Binds value to this contract instance
 *    - User must match msg.sender in most cases
 */
