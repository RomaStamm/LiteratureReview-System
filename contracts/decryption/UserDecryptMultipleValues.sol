// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title User Decrypt Multiple Values Example
 * @notice Demonstrates decryption mechanism for multiple encrypted values
 * @dev Shows permission management for multiple user-accessible values
 */
contract UserDecryptMultipleValues is SepoliaConfig {
  /// @notice User's encrypted data with multiple fields
  struct EncryptedProfile {
    euint32 age;
    euint32 income;
    euint32 creditScore;
  }

  /// @notice Store encrypted profiles per user
  mapping(address => EncryptedProfile) private profiles;

  /// @notice Event emitted when profile is set
  event ProfileSet(address indexed user, uint256 timestamp);

  /**
   * @notice Set user's encrypted profile with multiple values
   * @dev All values encrypted by same user, permissions managed per field
   *
   * @param age Encrypted age value
   * @param income Encrypted income value
   * @param creditScore Encrypted credit score
   * @param proofAge Proof for age
   * @param proofIncome Proof for income
   * @param proofCredit Proof for credit score
   */
  function setProfile(
    externalEuint32 age,
    externalEuint32 income,
    externalEuint32 creditScore,
    bytes calldata proofAge,
    bytes calldata proofIncome,
    bytes calldata proofCredit
  ) external {
    // ✅ CORRECT: Convert each value with its proof
    euint32 encAge = FHE.fromExternal(age, proofAge);
    euint32 encIncome = FHE.fromExternal(income, proofIncome);
    euint32 encCredit = FHE.fromExternal(creditScore, proofCredit);

    // Store all values
    profiles[msg.sender] = EncryptedProfile({
      age: encAge,
      income: encIncome,
      creditScore: encCredit
    });

    // ✅ CRITICAL: Grant permissions for EACH value
    // Age permissions
    FHE.allowThis(encAge);
    FHE.allow(encAge, msg.sender);

    // Income permissions
    FHE.allowThis(encIncome);
    FHE.allow(encIncome, msg.sender);

    // Credit score permissions
    FHE.allowThis(encCredit);
    FHE.allow(encCredit, msg.sender);

    emit ProfileSet(msg.sender, block.timestamp);
  }

  /**
   * @notice Get all encrypted profile values
   * @return User's encrypted profile
   */
  function getProfile() external view returns (EncryptedProfile memory) {
    return profiles[msg.sender];
  }

  /**
   * @notice Get specific encrypted field
   * @param field Which field: 0=age, 1=income, 2=credit
   * @return The encrypted field value
   */
  function getField(uint256 field) external view returns (euint32) {
    EncryptedProfile memory profile = profiles[msg.sender];

    if (field == 0) return profile.age;
    if (field == 1) return profile.income;
    if (field == 2) return profile.creditScore;

    revert("Invalid field");
  }

  /**
   * @notice Update single field in profile
   * @dev Shows partial update with permission management
   *
   * @param newAge New encrypted age
   * @param proof Proof for new age
   */
  function updateAge(externalEuint32 newAge, bytes calldata proof) external {
    euint32 encAge = FHE.fromExternal(newAge, proof);

    // Update only age field
    profiles[msg.sender].age = encAge;

    // Grant permissions for updated value
    FHE.allowThis(encAge);
    FHE.allow(encAge, msg.sender);

    emit ProfileSet(msg.sender, block.timestamp);
  }

  /**
   * @notice Update multiple fields
   * @dev Demonstrates atomicity of multiple field updates
   *
   * @param newIncome New encrypted income
   * @param newCredit New encrypted credit score
   * @param proofIncome Proof for income
   * @param proofCredit Proof for credit
   */
  function updateFinancialData(
    externalEuint32 newIncome,
    externalEuint32 newCredit,
    bytes calldata proofIncome,
    bytes calldata proofCredit
  ) external {
    euint32 encIncome = FHE.fromExternal(newIncome, proofIncome);
    euint32 encCredit = FHE.fromExternal(newCredit, proofCredit);

    // Update both financial fields
    profiles[msg.sender].income = encIncome;
    profiles[msg.sender].creditScore = encCredit;

    // Grant permissions for both
    FHE.allowThis(encIncome);
    FHE.allow(encIncome, msg.sender);

    FHE.allowThis(encCredit);
    FHE.allow(encCredit, msg.sender);

    emit ProfileSet(msg.sender, block.timestamp);
  }

  /**
   * @notice Compare multiple encrypted values
   * @dev Shows comparisons across multiple fields without revealing plaintext
   *
   * @param otherUser User to compare with
   * @return isOlderAge Whether this user's age > otherUser's age (encrypted)
   * @return hasHigherIncome Whether this user's income > otherUser's income (encrypted)
   */
  function compareProfiles(address otherUser)
    external
    view
    returns (
      bool, // Placeholder for encrypted comparison
      bool  // Placeholder for encrypted comparison
    )
  {
    EncryptedProfile memory myProfile = profiles[msg.sender];
    EncryptedProfile memory otherProfile = profiles[otherUser];

    // In real implementation, would use FHE.gt() for encrypted comparisons
    // These are placeholders demonstrating the concept
    return (true, false);
  }
}

/**
 * MULTIPLE VALUES DECRYPTION PATTERN
 *
 * Key Points:
 *
 * 1. Each Value Needs:
 *    ✅ FHE.allowThis(value) - Contract permission
 *    ✅ FHE.allow(value, user) - User permission
 *
 * 2. Struct vs Array:
 *    ✅ PREFER: Struct with fixed encrypted fields
 *    ❌ AVOID: Dynamic array of encrypted values (gas-heavy)
 *
 * 3. Partial Updates:
 *    ✅ Can update individual fields
 *    ✅ Permissions managed per field
 *    ✅ Only updated fields need new permissions
 *
 * 4. Atomic Operations:
 *    ✅ Multiple updates in single transaction
 *    ✅ All or nothing (transaction succeeds completely)
 *    ✅ Consistent state guaranteed
 */

/**
 * COMMON PITFALL: Forgetting Permissions on One Field
 *
 * ❌ WRONG:
 *   profiles[msg.sender].age = encAge;
 *   profiles[msg.sender].income = encIncome;
 *   profiles[msg.sender].creditScore = encCredit;
 *
 *   FHE.allowThis(encAge);
 *   FHE.allow(encAge, msg.sender);
 *
 *   FHE.allowThis(encIncome);
 *   FHE.allow(encIncome, msg.sender);
 *   // Missing permissions for encCredit!
 *
 * Result: User CANNOT decrypt creditScore
 *
 * ✅ CORRECT:
 *   profiles[msg.sender].age = encAge;
 *   FHE.allowThis(encAge);
 *   FHE.allow(encAge, msg.sender);
 *
 *   profiles[msg.sender].income = encIncome;
 *   FHE.allowThis(encIncome);
 *   FHE.allow(encIncome, msg.sender);
 *
 *   profiles[msg.sender].creditScore = encCredit;
 *   FHE.allowThis(encCredit);
 *   FHE.allow(encCredit, msg.sender);
 */

/**
 * DECRYPTION FLOW FOR MULTIPLE VALUES
 *
 * Client-Side (TypeScript):
 * 1. Get all encrypted values
 *    const profile = await contract.getProfile();
 *
 * 2. Decrypt each value separately
 *    const age = await relayer.decrypt(contractAddr, profile.age);
 *    const income = await relayer.decrypt(contractAddr, profile.income);
 *    const credit = await relayer.decrypt(contractAddr, profile.creditScore);
 *
 * 3. Use decrypted plaintext
 *    console.log(`Age: ${age}, Income: ${income}, Credit: ${credit}`);
 *
 * Key Points:
 * - Each decryption is separate relayer call
 * - Decryptions can be batched for efficiency
 * - User must have FHE.allow() permission for each
 * - Contract never sees plaintext values
 * - Privacy preserved throughout
 */

/**
 * GAS OPTIMIZATION FOR MULTIPLE VALUES
 *
 * Approach 1: Struct (RECOMMENDED)
 * struct Data {
 *   euint32 value1;
 *   euint32 value2;
 *   euint32 value3;
 * }
 * mapping(address => Data) data;
 * Benefits:
 * - Fixed size
 * - Type safe
 * - Gas efficient for reads
 *
 * Approach 2: Individual mappings
 * mapping(address => euint32) value1;
 * mapping(address => euint32) value2;
 * mapping(address => euint32) value3;
 * Benefits:
 * - Can update independently
 * - Selective access
 *
 * Approach 3: Array (NOT RECOMMENDED)
 * euint32[] values;
 * Problems:
 * - Dynamic size (gas-heavy)
 * - Push/pop expensive
 * - Linear iteration cost
 */

/**
 * PERMISSION MANAGEMENT STRATEGY
 *
 * For Struct with Multiple Fields:
 *
 * Strategy 1: All fields to same user
 * ✅ User gets access to entire profile
 * euint32 age;
 * euint32 income;
 * euint32 creditScore;
 * All -> FHE.allow(value, user)
 *
 * Strategy 2: Different users for different fields
 * ✅ Selective access control
 * FHE.allow(age, user);       // Age only
 * FHE.allow(income, auditor);  // Income only
 * FHE.allow(creditScore, admin); // Credit only
 *
 * Strategy 3: Admin access
 * ✅ Owner sees all encrypted (not decrypted)
 * FHE.allow(age, owner);
 * FHE.allow(income, owner);
 * FHE.allow(creditScore, owner);
 */
