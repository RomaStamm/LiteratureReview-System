// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint32, ebool, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title FHE Equality Comparison Example
 * @notice Demonstrates how to compare encrypted values for equality
 * @dev Shows encrypted comparison returning encrypted boolean
 */
contract FHEEquality is SepoliaConfig {
  /// @notice Stores encrypted comparison result
  ebool private comparisonResult;

  /// @notice Event emitted when comparison is performed
  event EqualityChecked(address indexed user, uint256 timestamp);

  /**
   * @notice Check if two encrypted values are equal
   * @dev Demonstrates FHE.eq operation
   *
   * Key Points:
   * - Returns encrypted boolean (ebool)
   * - Can be used in further FHE operations
   * - Result stays encrypted until decryption
   *
   * @param value1 First encrypted value as external type
   * @param value2 Second encrypted value as external type
   * @param proof1 Zero-knowledge proof for value1
   * @param proof2 Zero-knowledge proof for value2
   */
  function checkEquality(
    externalEuint32 value1,
    externalEuint32 value2,
    bytes calldata proof1,
    bytes calldata proof2
  ) external {
    // ✅ CORRECT: Convert encrypted inputs with proofs
    euint32 encValue1 = FHE.fromExternal(value1, proof1);
    euint32 encValue2 = FHE.fromExternal(value2, proof2);

    // ✅ CORRECT: Perform encrypted equality check
    // Returns ebool (encrypted boolean)
    comparisonResult = FHE.eq(encValue1, encValue2);

    // ✅ CRITICAL: Grant both permissions for encrypted result
    FHE.allowThis(comparisonResult);
    FHE.allow(comparisonResult, msg.sender);

    emit EqualityChecked(msg.sender, block.timestamp);
  }

  /**
   * @notice Check if value equals specific target
   * @dev Useful for verifying encrypted conditions
   *
   * @param value The encrypted value to check
   * @param target The plaintext target value
   * @param proof Zero-knowledge proof for value
   */
  function checkEqualsTarget(
    externalEuint32 value,
    uint32 target,
    bytes calldata proof
  ) external {
    // ✅ CORRECT: Convert encrypted input
    euint32 encValue = FHE.fromExternal(value, proof);

    // ✅ CORRECT: Convert plaintext to encrypted
    euint32 encTarget = FHE.asEuint32(target);

    // ✅ CORRECT: Compare
    comparisonResult = FHE.eq(encValue, encTarget);

    // ✅ CRITICAL: Grant permissions
    FHE.allowThis(comparisonResult);
    FHE.allow(comparisonResult, msg.sender);

    emit EqualityChecked(msg.sender, block.timestamp);
  }

  /**
   * @notice Check if value is not equal to target
   * @dev Demonstrates inequality (using equality and negation concept)
   *
   * @param value The encrypted value to check
   * @param target The plaintext target value
   * @param proof Zero-knowledge proof for value
   */
  function checkNotEquals(
    externalEuint32 value,
    uint32 target,
    bytes calldata proof
  ) external {
    // ✅ CORRECT: Convert inputs
    euint32 encValue = FHE.fromExternal(value, proof);
    euint32 encTarget = FHE.asEuint32(target);

    // ✅ CORRECT: Check equality
    // Note: For "not equals", decryption client would check result is false
    comparisonResult = FHE.eq(encValue, encTarget);

    FHE.allowThis(comparisonResult);
    FHE.allow(comparisonResult, msg.sender);

    emit EqualityChecked(msg.sender, block.timestamp);
  }

  /**
   * @notice Get the encrypted comparison result
   * @return The encrypted boolean result
   */
  function getComparisonResult() external view returns (ebool) {
    return comparisonResult;
  }

  /**
   * @notice Demonstrate conditional logic with encrypted boolean
   * @dev Shows how encrypted comparisons can control flow
   *
   * @param value1 First encrypted value
   * @param value2 Second encrypted value
   * @param proof1 Proof for value1
   * @param proof2 Proof for value2
   * @return The encrypted boolean result
   */
  function conditionalCheck(
    externalEuint32 value1,
    externalEuint32 value2,
    bytes calldata proof1,
    bytes calldata proof2
  ) external returns (ebool) {
    // ✅ CORRECT: Create encrypted comparison
    euint32 encValue1 = FHE.fromExternal(value1, proof1);
    euint32 encValue2 = FHE.fromExternal(value2, proof2);

    ebool result = FHE.eq(encValue1, encValue2);

    FHE.allowThis(result);
    FHE.allow(result, msg.sender);

    // Store and return
    comparisonResult = result;
    return result;
  }
}

/**
 * ENCRYPTED BOOLEAN OPERATIONS
 *
 * FHE.eq() returns ebool (encrypted boolean)
 * This enables:
 * 1. Privacy-preserving comparisons
 * 2. Conditional logic without revealing values
 * 3. Multi-step encrypted computations
 *
 * Example: Secret voting
 * - Each vote is encrypted
 * - Check if encrypted vote == encrypted candidate
 * - Result stays encrypted until final reveal
 *
 * ✅ CORRECT PATTERN:
 *   ebool result = FHE.eq(encValue1, encValue2);
 *   FHE.allowThis(result);
 *   FHE.allow(result, msg.sender);
 *
 * Note: You cannot use ebool directly in Solidity if-statements
 * The comparison result must be decrypted first through relayer
 */
