// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title Encrypt Multiple Values Example
 * @notice Demonstrates how to receive and manage multiple encrypted values
 * @dev Shows patterns for handling arrays and structures of encrypted data
 */
contract EncryptMultipleValues is SepoliaConfig {
  /// @notice Structure holding multiple encrypted values
  struct EncryptedData {
    euint32 value1;
    euint32 value2;
    euint32 value3;
  }

  /// @notice Store multiple values per user
  mapping(address => EncryptedData) private userData;

  /// @notice Array of encrypted values
  euint32[] private valueArray;

  /// @notice Event for multiple value storage
  event MultipleValuesEncrypted(
    address indexed user,
    uint256 count,
    uint256 timestamp
  );

  /**
   * @notice Store multiple encrypted values in a single transaction
   * @dev Demonstrates handling 3 encrypted values with proofs
   *
   * Key Advantages:
   * 1. All values encrypted by same user (same binding)
   * 2. Single transaction reduces gas overhead
   * 3. Atomic operation - all or nothing
   *
   * @param value1 First encrypted value
   * @param value2 Second encrypted value
   * @param value3 Third encrypted value
   * @param proof1 Proof for value1
   * @param proof2 Proof for value2
   * @param proof3 Proof for value3
   */
  function storeMultipleValues(
    externalEuint32 value1,
    externalEuint32 value2,
    externalEuint32 value3,
    bytes calldata proof1,
    bytes calldata proof2,
    bytes calldata proof3
  ) external {
    // ✅ CORRECT: Convert each encrypted input with its proof
    euint32 enc1 = FHE.fromExternal(value1, proof1);
    euint32 enc2 = FHE.fromExternal(value2, proof2);
    euint32 enc3 = FHE.fromExternal(value3, proof3);

    // Store in structure
    userData[msg.sender] = EncryptedData({
      value1: enc1,
      value2: enc2,
      value3: enc3
    });

    // ✅ CRITICAL: Grant permissions for each value
    FHE.allowThis(enc1);
    FHE.allow(enc1, msg.sender);

    FHE.allowThis(enc2);
    FHE.allow(enc2, msg.sender);

    FHE.allowThis(enc3);
    FHE.allow(enc3, msg.sender);

    emit MultipleValuesEncrypted(msg.sender, 3, block.timestamp);
  }

  /**
   * @notice Add an encrypted value to array
   * @dev Demonstrates dynamic array of encrypted values
   *
   * @param value The encrypted value to add
   * @param proof The input proof
   */
  function addValueToArray(externalEuint32 value, bytes calldata proof)
    external
  {
    // ✅ CORRECT: Convert and add
    euint32 encValue = FHE.fromExternal(value, proof);

    valueArray.push(encValue);

    FHE.allowThis(encValue);
    FHE.allow(encValue, msg.sender);

    emit MultipleValuesEncrypted(msg.sender, 1, block.timestamp);
  }

  /**
   * @notice Get all user data
   * @return The encrypted data structure
   */
  function getUserData(address user)
    external
    view
    returns (EncryptedData memory)
  {
    return userData[user];
  }

  /**
   * @notice Get specific value from array
   * @param index Array index
   * @return The encrypted value at index
   */
  function getArrayValue(uint256 index) external view returns (euint32) {
    require(index < valueArray.length, "Index out of bounds");
    return valueArray[index];
  }

  /**
   * @notice Get array length
   * @return Number of values in array
   */
  function getArrayLength() external view returns (uint256) {
    return valueArray.length;
  }

  /**
   * @notice Store arbitrary number of values (gas intensive)
   * @dev Shows pattern for variable-length encrypted data
   *
   * Note: Each value needs separate proof
   * This is gas-intensive; prefer fixed-size structs when possible
   *
   * @param values Array of encrypted values
   * @param proofs Array of input proofs (same length as values)
   */
  function storeMultipleValuesFlexible(
    externalEuint32[] calldata values,
    bytes[] calldata proofs
  ) external {
    require(values.length == proofs.length, "Length mismatch");
    require(values.length <= 10, "Too many values");  // Limit for gas safety

    for (uint256 i = 0; i < values.length; i++) {
      euint32 encValue = FHE.fromExternal(values[i], proofs[i]);

      valueArray.push(encValue);

      FHE.allowThis(encValue);
      FHE.allow(encValue, msg.sender);
    }

    emit MultipleValuesEncrypted(msg.sender, values.length, block.timestamp);
  }

  /**
   * @notice Perform operation on multiple values
   * @dev Shows pattern for computing with multiple encrypted values
   *
   * @param addProof Proof for first value
   * @param addProof2 Proof for second value
   * @param addProof3 Proof for third value
   * @return The sum of all three encrypted values
   */
  function sumThreeValues(
    externalEuint32 value1,
    externalEuint32 value2,
    externalEuint32 value3,
    bytes calldata addProof,
    bytes calldata addProof2,
    bytes calldata addProof3
  ) external returns (euint32) {
    // Convert all inputs
    euint32 enc1 = FHE.fromExternal(value1, addProof);
    euint32 enc2 = FHE.fromExternal(value2, addProof2);
    euint32 enc3 = FHE.fromExternal(value3, addProof3);

    // Compute sum (encrypted)
    euint32 sum12 = FHE.add(enc1, enc2);
    euint32 result = FHE.add(sum12, enc3);

    FHE.allowThis(result);
    FHE.allow(result, msg.sender);

    return result;
  }
}

/**
 * GAS OPTIMIZATION TIPS FOR MULTIPLE VALUES
 *
 * 1. Use Fixed-Size Structs (PREFERRED)
 *    struct Data {
 *      euint32 a;
 *      euint32 b;
 *      euint32 c;
 *    }
 *    - Known size
 *    - Gas efficient
 *    - Type safe
 *
 * 2. Avoid Dynamic Arrays of Encrypted Values
 *    euint32[] storage myArray;  // ❌ Expensive
 *    - Push/pop operations are gas-heavy
 *    - Storage operations on encrypted values are expensive
 *    - Use bounded arrays instead
 *
 * 3. Limit Input Proof Processing
 *    - Each FHE.fromExternal() call is expensive
 *    - Batch operations when possible
 *    - Consider off-chain aggregation
 *
 * 4. Permissions Pattern
 *    ✅ GOOD: Permissions in loop (if unavoidable)
 *    for (uint i = 0; i < values.length; i++) {
 *      FHE.allowThis(values[i]);
 *      FHE.allow(values[i], msg.sender);
 *    }
 *
 *    ❌ BAD: Forgetting permissions
 *    // Missing permission grants!
 */

/**
 * SECURITY CONSIDERATION: Input Proof Validation
 *
 * Each input proof is specific to:
 * - Specific ciphertext
 * - Specific [contract, user] binding
 * - Specific plaintext value
 *
 * Cannot be reused for:
 * - Different values
 * - Different contracts
 * - Different users
 *
 * This is a SECURITY FEATURE:
 * - Prevents replay attacks
 * - Ensures user participation
 * - Validates encryption correctness
 */
