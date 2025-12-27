// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title FHE Addition Operations Example
 * @notice Demonstrates how to perform addition on encrypted values
 * @dev Shows both correct patterns and common pitfalls
 */
contract FHEAdd is SepoliaConfig {
  /// @notice Stores the encrypted sum
  euint32 private encryptedSum;

  /// @notice Event emitted when addition is performed
  event AdditionPerformed(address indexed user, uint256 timestamp);

  /**
   * @notice Add two encrypted values
   * @dev This demonstrates proper FHE.add operation
   *
   * FHE Pattern:
   * 1. Convert external input to encrypted with input proof
   * 2. Perform homomorphic operation (FHE.add)
   * 3. Grant both contract and user permissions
   *
   * @param value1 First encrypted value as external type
   * @param value2 Second encrypted value as external type
   * @param inputProof1 Zero-knowledge proof for value1
   * @param inputProof2 Zero-knowledge proof for value2
   */
  function add(
    externalEuint32 value1,
    externalEuint32 value2,
    bytes calldata inputProof1,
    bytes calldata inputProof2
  ) external {
    // ✅ CORRECT: Convert external inputs with input proofs
    euint32 encValue1 = FHE.fromExternal(value1, inputProof1);
    euint32 encValue2 = FHE.fromExternal(value2, inputProof2);

    // ✅ CORRECT: Perform homomorphic addition
    encryptedSum = FHE.add(encValue1, encValue2);

    // ✅ CRITICAL: Grant both permissions
    FHE.allowThis(encryptedSum);
    FHE.allow(encryptedSum, msg.sender);

    emit AdditionPerformed(msg.sender, block.timestamp);
  }

  /**
   * @notice Add a value to the stored encrypted sum
   * @dev Demonstrates accumulation pattern
   *
   * @param value The encrypted value to add
   * @param inputProof Zero-knowledge proof for the input
   */
  function addToSum(
    externalEuint32 value,
    bytes calldata inputProof
  ) external {
    // ✅ CORRECT: Convert and add
    euint32 encValue = FHE.fromExternal(value, inputProof);
    encryptedSum = FHE.add(encryptedSum, encValue);

    // ✅ CRITICAL: Always grant permissions
    FHE.allowThis(encryptedSum);
    FHE.allow(encryptedSum, msg.sender);

    emit AdditionPerformed(msg.sender, block.timestamp);
  }

  /**
   * @notice Get encrypted sum (returns handle for relayer decryption)
   * @dev Note: Returns encrypted value handle, not plaintext
   * @return Encrypted sum value
   */
  function getSum() external view returns (euint32) {
    return encryptedSum;
  }

  /**
   * @notice Reset the sum to zero
   * @dev Owner function to reset state
   */
  function resetSum() external {
    encryptedSum = FHE.asEuint32(0);
    FHE.allowThis(encryptedSum);
  }
}

/**
 * COMMON PITFALL: Forgetting FHE.allowThis()
 *
 * ❌ INCORRECT:
 *   euint32 result = FHE.add(value1, value2);
 *   FHE.allow(result, msg.sender);  // Missing FHE.allowThis!
 *   return result;
 *
 * The contract cannot decrypt without FHE.allowThis().
 * This will cause relayer decryption to fail.
 *
 * ✅ CORRECT:
 *   euint32 result = FHE.add(value1, value2);
 *   FHE.allowThis(result);           // Grant contract permission
 *   FHE.allow(result, msg.sender);   // Grant user permission
 *   return result;
 */
