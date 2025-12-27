// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title User Decrypt Single Value Example
 * @notice Demonstrates user decryption mechanism in FHEVM
 * @dev Shows permission requirements for user decryption
 */
contract UserDecryptSingleValue is SepoliaConfig {
  /// @notice User's encrypted balance
  mapping(address => euint32) private balances;

  /// @notice Event emitted when value is ready for user decryption
  event ValueReadyForDecryption(address indexed user, uint256 timestamp);

  /**
   * @notice Store encrypted balance for user
   * @dev Value is encrypted and permissions granted for later decryption
   *
   * User Decryption Flow:
   * 1. Contract receives encrypted value
   * 2. Contract grants permissions with FHE.allow()
   * 3. User requests decryption via relayer SDK
   * 4. Relayer checks permissions and decrypts
   * 5. User receives plaintext in client
   *
   * @param encryptedBalance The encrypted balance value
   * @param inputProof Zero-knowledge proof for the balance
   */
  function setBalance(
    externalEuint32 encryptedBalance,
    bytes calldata inputProof
  ) external {
    // ✅ CORRECT: Convert encrypted input
    euint32 balance = FHE.fromExternal(encryptedBalance, inputProof);

    balances[msg.sender] = balance;

    // ✅ CRITICAL: Grant both permissions for user decryption
    FHE.allowThis(balance);        // Contract permission
    FHE.allow(balance, msg.sender); // User permission (REQUIRED for decryption)

    emit ValueReadyForDecryption(msg.sender, block.timestamp);
  }

  /**
   * @notice Get encrypted balance
   * @dev Returns handle that user can decrypt via relayer
   *
   * IMPORTANT: This is a VIEW function
   * - Returns encrypted value handle
   * - User needs FHE.allow() permission to decrypt
   * - Decryption happens client-side via relayer SDK
   *
   * @return User's encrypted balance
   */
  function getMyBalance() external view returns (euint32) {
    return balances[msg.sender];
  }

  /**
   * @notice Transfer encrypted amount to another user
   * @dev Demonstrates permission management in transfers
   *
   * @param to Recipient address
   * @param amount Encrypted amount to transfer
   * @param proof Input proof for amount
   */
  function transfer(
    address to,
    externalEuint32 amount,
    bytes calldata proof
  ) external {
    // ✅ CORRECT: Convert encrypted amount
    euint32 encAmount = FHE.fromExternal(amount, proof);

    // Subtract from sender (simplified - no underflow check in encrypted space)
    balances[msg.sender] = FHE.sub(balances[msg.sender], encAmount);

    // Add to recipient
    balances[to] = FHE.add(balances[to], encAmount);

    // ✅ CRITICAL: Grant permissions to BOTH users
    FHE.allowThis(balances[msg.sender]);
    FHE.allow(balances[msg.sender], msg.sender);

    FHE.allowThis(balances[to]);
    FHE.allow(balances[to], to);

    emit ValueReadyForDecryption(msg.sender, block.timestamp);
    emit ValueReadyForDecryption(to, block.timestamp);
  }

  /**
   * @notice Get balance for specific address (view)
   * @param user The user whose balance to query
   * @return The encrypted balance
   */
  function getBalance(address user) external view returns (euint32) {
    return balances[user];
  }
}

/**
 * USER DECRYPTION EXPLAINED
 *
 * Decryption happens CLIENT-SIDE, not on-chain:
 *
 * 1. On-Chain (Solidity):
 *    - Store encrypted value
 *    - Grant FHE.allow(value, user) permission
 *    - User retrieves encrypted handle
 *
 * 2. Client-Side (TypeScript):
 *    const instance = await createFhevmInstance();
 *    const handle = await contract.getMyBalance();
 *    const plaintext = await instance.decrypt(contractAddress, handle);
 *
 * 3. Relayer Service:
 *    - Verifies user has FHE.allow() permission
 *    - Decrypts value using threshold decryption
 *    - Returns plaintext to user
 *
 * The CONTRACT never sees the plaintext!
 * This preserves privacy while allowing user access.
 */

/**
 * COMMON PITFALL: Missing User Permission
 *
 * ❌ INCORRECT:
 *   function setBalance(externalEuint32 balance, bytes calldata proof) external {
 *     euint32 enc = FHE.fromExternal(balance, proof);
 *     balances[msg.sender] = enc;
 *     FHE.allowThis(enc);  // Only contract permission!
 *     // Missing FHE.allow(enc, msg.sender)
 *   }
 *
 * Result: User CANNOT decrypt their own balance
 * Relayer will reject decryption request (no permission)
 *
 * ✅ CORRECT:
 *   function setBalance(externalEuint32 balance, bytes calldata proof) external {
 *     euint32 enc = FHE.fromExternal(balance, proof);
 *     balances[msg.sender] = enc;
 *     FHE.allowThis(enc);           // Contract permission
 *     FHE.allow(enc, msg.sender);   // User permission (REQUIRED!)
 *   }
 */

/**
 * PERMISSION PATTERNS FOR USER DECRYPTION
 *
 * Pattern 1: Self-Service (User decrypts own value)
 *   ✅ MUST grant: FHE.allow(value, user)
 *   euint32 userValue = ...;
 *   FHE.allow(userValue, msg.sender);
 *
 * Pattern 2: Admin Access (Owner can decrypt)
 *   ✅ MUST grant: FHE.allow(value, owner)
 *   euint32 secretValue = ...;
 *   FHE.allow(secretValue, owner);
 *
 * Pattern 3: Shared Access (Multiple users can decrypt)
 *   ✅ Grant to each user:
 *   euint32 sharedValue = ...;
 *   FHE.allow(sharedValue, user1);
 *   FHE.allow(sharedValue, user2);
 *   FHE.allow(sharedValue, user3);
 *
 * Pattern 4: Transfer Scenario
 *   ✅ Update permissions on transfer:
 *   // Remove permission from sender (not directly supported)
 *   // Grant permission to recipient
 *   FHE.allow(value, recipient);
 */

/**
 * SECURITY: Who Can Decrypt?
 *
 * Only addresses with FHE.allow() permission can decrypt
 *
 * This means:
 * - Contract owner CANNOT decrypt user values (unless explicitly allowed)
 * - Other users CANNOT decrypt your values
 * - Relayer service enforces permissions
 * - Decryption requires user's private key
 *
 * Decryption is TRUSTLESS:
 * - Uses threshold cryptography
 * - Multiple relayers participate
 * - No single relayer can decrypt alone
 * - Requires threshold number of relayers
 */
