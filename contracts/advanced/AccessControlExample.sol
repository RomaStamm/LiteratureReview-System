// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title Access Control Example for FHE
 * @notice Demonstrates FHE.allow, FHE.allowTransient, and permission patterns
 * @dev Complete guide to FHEVM permission system
 *
 * THIS IS THE MOST IMPORTANT CONCEPT IN FHEVM!
 */
contract AccessControlExample is SepoliaConfig {
  /// @notice Owner of the contract
  address public owner;

  /// @notice User's encrypted balances
  mapping(address => euint32) private balances;

  /// @notice Shared encrypted value
  euint32 private sharedSecret;

  /// @notice Addresses with access to shared secret
  mapping(address => bool) public hasAccess;

  /// @notice Events
  event PermissionGranted(address indexed user, uint256 timestamp);
  event PermissionRevoked(address indexed user, uint256 timestamp);

  constructor() {
    owner = msg.sender;
  }

  /**
   * @notice Demonstrates FHE.allowThis - Contract Permission
   * @dev CRITICAL: Contract must have permission to work with encrypted values
   *
   * When to use:
   * - ALWAYS! Every encrypted value needs FHE.allowThis()
   * - Before storing encrypted value
   * - Before using in FHE operations
   * - Before comparisons
   *
   * @param value Encrypted value to store
   * @param proof Input proof
   */
  function demonstrateAllowThis(
    externalEuint32 value,
    bytes calldata proof
  ) external {
    euint32 encValue = FHE.fromExternal(value, proof);

    // ✅ CRITICAL: Grant contract permission FIRST
    FHE.allowThis(encValue);

    // Now contract can:
    // - Store the value
    // - Use in computations
    // - Compare with other values
    // - Grant permissions to users

    balances[msg.sender] = encValue;
  }

  /**
   * @notice Demonstrates FHE.allow - User Permission
   * @dev Grants specific user permission to decrypt value
   *
   * When to use:
   * - After FHE.allowThis()
   * - To allow user to decrypt their data
   * - To share data with specific addresses
   * - For multi-party access control
   *
   * @param value Encrypted value
   * @param proof Input proof
   */
  function demonstrateAllow(
    externalEuint32 value,
    bytes calldata proof
  ) external {
    euint32 encValue = FHE.fromExternal(value, proof);

    // ✅ Step 1: Contract permission
    FHE.allowThis(encValue);

    // ✅ Step 2: User permission
    FHE.allow(encValue, msg.sender);

    // Now msg.sender can:
    // - Decrypt value via relayer
    // - Access plaintext client-side
    // - Verify computations

    balances[msg.sender] = encValue;
    emit PermissionGranted(msg.sender, block.timestamp);
  }

  /**
   * @notice Demonstrates FHE.allowTransient - Temporary Permission
   * @dev Grants temporary permission within single transaction
   *
   * When to use:
   * - For intermediate computation results
   * - Values that don't need storage
   * - Gas optimization (cheaper than FHE.allow)
   * - One-time operations
   *
   * Note: allowTransient permissions DON'T persist!
   * They're only valid within the same transaction
   *
   * @param value1 First encrypted value
   * @param value2 Second encrypted value
   * @param proof1 Proof for value1
   * @param proof2 Proof for value2
   * @return The encrypted sum (transient permission)
   */
  function demonstrateAllowTransient(
    externalEuint32 value1,
    externalEuint32 value2,
    bytes calldata proof1,
    bytes calldata proof2
  ) external returns (euint32) {
    euint32 enc1 = FHE.fromExternal(value1, proof1);
    euint32 enc2 = FHE.fromExternal(value2, proof2);

    // Compute result
    euint32 sum = FHE.add(enc1, enc2);

    // ✅ Use allowTransient for temporary result
    // This is cheaper than FHE.allow + FHE.allowThis
    // But only valid within this transaction!
    FHE.allowTransient(sum, msg.sender);

    // User can decrypt within this transaction
    // But permission expires after transaction ends
    return sum;
  }

  /**
   * @notice Grant shared access to multiple users
   * @dev Shows how to share encrypted data with multiple addresses
   *
   * @param secret Encrypted shared secret
   * @param proof Input proof
   * @param users Array of addresses to grant access
   */
  function shareWithMultipleUsers(
    externalEuint32 secret,
    bytes calldata proof,
    address[] calldata users
  ) external {
    require(msg.sender == owner, "Only owner");

    euint32 encSecret = FHE.fromExternal(secret, proof);

    // ✅ CRITICAL: Contract permission first
    FHE.allowThis(encSecret);

    // ✅ Grant access to each user
    for (uint256 i = 0; i < users.length; i++) {
      FHE.allow(encSecret, users[i]);
      hasAccess[users[i]] = true;
    }

    sharedSecret = encSecret;

    for (uint256 i = 0; i < users.length; i++) {
      emit PermissionGranted(users[i], block.timestamp);
    }
  }

  /**
   * @notice Transfer with permission update
   * @dev Shows permission management during value transfer
   *
   * @param to Recipient address
   * @param amount Encrypted amount
   * @param proof Input proof
   */
  function transferWithPermissions(
    address to,
    externalEuint32 amount,
    bytes calldata proof
  ) external {
    euint32 encAmount = FHE.fromExternal(amount, proof);

    // Update balances
    balances[msg.sender] = FHE.sub(balances[msg.sender], encAmount);
    balances[to] = FHE.add(balances[to], encAmount);

    // ✅ CRITICAL: Update permissions for BOTH users
    FHE.allowThis(balances[msg.sender]);
    FHE.allow(balances[msg.sender], msg.sender);

    FHE.allowThis(balances[to]);
    FHE.allow(balances[to], to);

    emit PermissionGranted(msg.sender, block.timestamp);
    emit PermissionGranted(to, block.timestamp);
  }

  /**
   * @notice Get balance (requires permission)
   * @return Encrypted balance
   */
  function getBalance() external view returns (euint32) {
    return balances[msg.sender];
  }

  /**
   * @notice Get shared secret (requires access)
   * @return Encrypted shared secret
   */
  function getSharedSecret() external view returns (euint32) {
    require(hasAccess[msg.sender], "No access");
    return sharedSecret;
  }
}

/**
 * PERMISSION SYSTEM EXPLAINED
 *
 * Three Permission Functions:
 *
 * 1. FHE.allowThis(value)
 *    - Grants permission to THIS contract
 *    - REQUIRED for contract to use the value
 *    - Must be called FIRST
 *    - Persists in storage
 *    - Cost: ~21,000 gas
 *
 * 2. FHE.allow(value, address)
 *    - Grants permission to specific address
 *    - Allows address to decrypt via relayer
 *    - Can grant to multiple addresses
 *    - Persists in storage
 *    - Cost: ~21,000 gas per address
 *
 * 3. FHE.allowTransient(value, address)
 *    - Grants TEMPORARY permission
 *    - Only valid within current transaction
 *    - Does NOT persist
 *    - Cheaper than FHE.allow
 *    - Cost: ~2,100 gas
 *    - Use for: intermediate results, temporary access
 */

/**
 * PERMISSION PATTERNS
 *
 * Pattern 1: Standard Storage (Most Common)
 *   ✅ ALWAYS use this pattern for stored values
 *   euint32 value = ...;
 *   FHE.allowThis(value);           // Contract permission
 *   FHE.allow(value, msg.sender);    // User permission
 *   storage[key] = value;
 *
 * Pattern 2: Transient Return Value
 *   ✅ Use for immediate return without storage
 *   euint32 result = FHE.add(a, b);
 *   FHE.allowTransient(result, msg.sender);
 *   return result;  // User can decrypt in same transaction
 *
 * Pattern 3: Shared Access
 *   ✅ Multiple users need access
 *   FHE.allowThis(value);
 *   FHE.allow(value, user1);
 *   FHE.allow(value, user2);
 *   FHE.allow(value, user3);
 *
 * Pattern 4: Admin Access
 *   ✅ Owner needs to see all data
 *   FHE.allowThis(value);
 *   FHE.allow(value, msg.sender);  // User access
 *   FHE.allow(value, owner);        // Admin access
 */

/**
 * COMMON PITFALLS
 *
 * Pitfall 1: Missing FHE.allowThis()
 *   ❌ WRONG:
 *     euint32 value = FHE.fromExternal(input, proof);
 *     FHE.allow(value, msg.sender);  // Missing allowThis!
 *     storage[key] = value;  // FAILS! Contract can't use value
 *
 *   ✅ CORRECT:
 *     euint32 value = FHE.fromExternal(input, proof);
 *     FHE.allowThis(value);           // Contract permission
 *     FHE.allow(value, msg.sender);    // User permission
 *     storage[key] = value;
 *
 * Pitfall 2: Missing FHE.allow() for User
 *   ❌ WRONG:
 *     FHE.allowThis(value);  // Only contract permission
 *     // Missing user permission!
 *   Result: User CANNOT decrypt their own data
 *
 *   ✅ CORRECT:
 *     FHE.allowThis(value);
 *     FHE.allow(value, msg.sender);
 *
 * Pitfall 3: Using allowTransient for Storage
 *   ❌ WRONG:
 *     FHE.allowTransient(value, msg.sender);
 *     storage[key] = value;
 *   Result: User CANNOT decrypt later (permission expired)
 *
 *   ✅ CORRECT:
 *     FHE.allow(value, msg.sender);  // Persistent permission
 *     storage[key] = value;
 *
 * Pitfall 4: Forgetting Permission After Transfer
 *   ❌ WRONG:
 *     balances[to] = FHE.add(balances[to], amount);
 *     // Missing FHE.allow(balances[to], to)
 *   Result: Recipient CANNOT decrypt their balance
 *
 *   ✅ CORRECT:
 *     balances[to] = FHE.add(balances[to], amount);
 *     FHE.allowThis(balances[to]);
 *     FHE.allow(balances[to], to);
 */

/**
 * GAS OPTIMIZATION
 *
 * FHE.allowThis():     ~21,000 gas
 * FHE.allow():         ~21,000 gas
 * FHE.allowTransient(): ~2,100 gas
 *
 * Optimization Strategy:
 * 1. Use allowTransient for temporary results
 * 2. Batch permission grants when possible
 * 3. Only grant to addresses that need access
 * 4. Remove permissions when no longer needed (not directly supported yet)
 */

/**
 * SECURITY BEST PRACTICES
 *
 * 1. ALWAYS grant FHE.allowThis() first
 * 2. Only grant FHE.allow() to authorized addresses
 * 3. Use allowTransient for temporary access
 * 4. Track who has access (hasAccess mapping)
 * 5. Validate permissions in getter functions
 * 6. Document permission requirements in comments
 * 7. Test permission edge cases thoroughly
 */
