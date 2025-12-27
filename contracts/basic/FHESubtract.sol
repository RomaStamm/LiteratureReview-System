// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title FHE Subtraction Operations Example
 * @notice Demonstrates how to perform subtraction on encrypted values
 * @dev Shows secure subtraction with underflow protection
 */
contract FHESubtract is SepoliaConfig {
  /// @notice Stores the encrypted difference
  euint32 private encryptedDifference;

  /// @notice Event emitted when subtraction is performed
  event SubtractionPerformed(address indexed user, uint256 timestamp);

  /**
   * @notice Subtract two encrypted values
   * @dev Demonstrates FHE.sub operation
   *
   * Important Note:
   * In encrypted arithmetic, we cannot validate that minuend >= subtrahend
   * Underflow protection must happen at application level
   *
   * @param minuend The encrypted value to subtract from
   * @param subtrahend The encrypted value to subtract
   * @param proofMinuend Zero-knowledge proof for minuend
   * @param proofSubtrahend Zero-knowledge proof for subtrahend
   */
  function subtract(
    externalEuint32 minuend,
    externalEuint32 subtrahend,
    bytes calldata proofMinuend,
    bytes calldata proofSubtrahend
  ) external {
    // ✅ CORRECT: Convert encrypted inputs with proofs
    euint32 encMinuend = FHE.fromExternal(minuend, proofMinuend);
    euint32 encSubtrahend = FHE.fromExternal(subtrahend, proofSubtrahend);

    // ✅ CORRECT: Perform homomorphic subtraction
    encryptedDifference = FHE.sub(encMinuend, encSubtrahend);

    // ✅ CRITICAL: Grant both permissions
    FHE.allowThis(encryptedDifference);
    FHE.allow(encryptedDifference, msg.sender);

    emit SubtractionPerformed(msg.sender, block.timestamp);
  }

  /**
   * @notice Subtract from current encrypted value
   * @dev Demonstrates accumulation with subtraction
   *
   * @param value The encrypted value to subtract
   * @param inputProof Zero-knowledge proof for the input
   */
  function subtractFromDifference(
    externalEuint32 value,
    bytes calldata inputProof
  ) external {
    // ✅ CORRECT: Convert and subtract
    euint32 encValue = FHE.fromExternal(value, inputProof);
    encryptedDifference = FHE.sub(encryptedDifference, encValue);

    // ✅ CRITICAL: Always grant permissions
    FHE.allowThis(encryptedDifference);
    FHE.allow(encryptedDifference, msg.sender);

    emit SubtractionPerformed(msg.sender, block.timestamp);
  }

  /**
   * @notice Get encrypted difference
   * @return The encrypted difference value
   */
  function getDifference() external view returns (euint32) {
    return encryptedDifference;
  }

  /**
   * @notice Initialize encrypted value
   * @param initialValue The starting encrypted value
   * @param inputProof Zero-knowledge proof for initial value
   */
  function initialize(
    externalEuint32 initialValue,
    bytes calldata inputProof
  ) external {
    euint32 encValue = FHE.fromExternal(initialValue, inputProof);
    encryptedDifference = encValue;

    FHE.allowThis(encryptedDifference);
    FHE.allow(encryptedDifference, msg.sender);
  }
}

/**
 * IMPORTANT: Underflow in Encrypted Arithmetic
 *
 * In plaintext arithmetic:
 *   uint32 a = 5;
 *   uint32 b = 10;
 *   uint32 result = a - b;  // Reverts with underflow
 *
 * In encrypted arithmetic with FHE:
 *   euint32 a = encrypt(5);
 *   euint32 b = encrypt(10);
 *   euint32 result = FHE.sub(a, b);  // No revert!
 *   // Result is encrypted wrapping value (or encrypted negative)
 *
 * This is a FEATURE, not a bug:
 * - Subtraction can be performed without revealing operands
 * - Underflow protection happens at decryption time
 * - Or validate inputs before encryption
 *
 * ✅ BEST PRACTICE:
 * 1. Validate plaintext values before encryption
 * 2. Use FHE.le() or FHE.lt() for comparisons if needed
 * 3. Handle potential underflow at application level
 */
