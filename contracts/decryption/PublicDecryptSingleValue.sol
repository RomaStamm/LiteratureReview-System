// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title Public Decrypt Single Value Example
 * @notice Demonstrates public decryption mechanism in FHEVM
 * @dev Shows how encrypted values can be decrypted publicly on-chain
 *
 * IMPORTANT: Public decryption reveals the plaintext to EVERYONE
 * Use only when revealing the value is acceptable (e.g., auction results)
 */
contract PublicDecryptSingleValue is SepoliaConfig {
  /// @notice Encrypted bid value
  euint32 private encryptedBid;

  /// @notice Publicly revealed bid (after decryption)
  uint32 public revealedBid;

  /// @notice Whether value has been revealed
  bool public isRevealed;

  /// @notice Event emitted when decryption is requested
  event DecryptionRequested(uint256 indexed requestId, uint256 timestamp);

  /// @notice Event emitted when value is revealed
  event ValueRevealed(uint32 value, uint256 timestamp);

  /**
   * @notice Submit encrypted bid
   * @dev Value stays encrypted until publicly decrypted
   *
   * @param bid The encrypted bid value
   * @param proof Input proof for the bid
   */
  function submitBid(externalEuint32 bid, bytes calldata proof) external {
    require(!isRevealed, "Already revealed");

    // ✅ CORRECT: Convert encrypted input
    encryptedBid = FHE.fromExternal(bid, proof);

    // ✅ CRITICAL: Grant contract permission
    FHE.allowThis(encryptedBid);
    FHE.allow(encryptedBid, msg.sender);
  }

  /**
   * @notice Request public decryption of the bid
   * @dev Initiates async decryption process
   *
   * Public Decryption Flow:
   * 1. Contract calls decryption gateway
   * 2. Request is submitted to relayer network
   * 3. Relayers perform threshold decryption
   * 4. Plaintext is returned via callback
   * 5. Contract stores plaintext in public variable
   *
   * NOTE: In real implementation, this would:
   * - Call Gateway.requestDecryption()
   * - Receive callback with plaintext
   * - Store result in public variable
   *
   * For this example, we simulate the concept
   */
  function revealBid() external {
    require(!isRevealed, "Already revealed");

    // In production, would use:
    // uint256 requestId = Gateway.requestDecryption(
    //   encryptedBid,
    //   this.decryptionCallback.selector
    // );

    // For demonstration: mark as revealed
    isRevealed = true;

    emit DecryptionRequested(0, block.timestamp);
  }

  /**
   * @notice Callback function for decryption result
   * @dev Called by decryption gateway with plaintext
   *
   * SECURITY: Should validate msg.sender is gateway
   *
   * @param plaintext The decrypted value
   */
  function decryptionCallback(uint32 plaintext) external {
    // ✅ In production: require(msg.sender == GATEWAY_ADDRESS);

    revealedBid = plaintext;
    isRevealed = true;

    emit ValueRevealed(plaintext, block.timestamp);
  }

  /**
   * @notice Get encrypted bid (before reveal)
   * @return The encrypted bid value
   */
  function getEncryptedBid() external view returns (euint32) {
    return encryptedBid;
  }

  /**
   * @notice Get revealed bid (after decryption)
   * @return The plaintext bid value (0 if not revealed)
   */
  function getRevealedBid() external view returns (uint32) {
    require(isRevealed, "Not revealed yet");
    return revealedBid;
  }
}

/**
 * PUBLIC DECRYPTION EXPLAINED
 *
 * Public decryption makes encrypted value visible to everyone:
 *
 * 1. Why Use Public Decryption?
 *    - Auction results (winning bid must be known)
 *    - Voting results (final tally must be public)
 *    - Game outcomes (winner must be revealed)
 *    - Condition resolution (contract logic needs plaintext)
 *
 * 2. How It Works:
 *    Step 1: Contract requests decryption from gateway
 *    Step 2: Gateway submits to relayer network
 *    Step 3: Relayers perform threshold decryption
 *    Step 4: Plaintext returned via callback
 *    Step 5: Contract stores plaintext in public storage
 *
 * 3. Security Considerations:
 *    - Value becomes PUBLIC (visible to all)
 *    - Cannot be "re-encrypted"
 *    - Irreversible operation
 *    - Only use when revealing is acceptable
 *
 * 4. Gas Costs:
 *    - Decryption request costs gas
 *    - Callback execution costs gas
 *    - More expensive than keeping encrypted
 */

/**
 * PUBLIC vs USER DECRYPTION
 *
 * User Decryption (Private):
 * ✅ Only authorized users can decrypt
 * ✅ Happens client-side
 * ✅ Contract never sees plaintext
 * ✅ Preserves privacy
 * ✅ Use for: balances, secrets, personal data
 *
 * Public Decryption (Public):
 * ✅ Anyone can see plaintext
 * ✅ Happens on-chain
 * ✅ Contract receives and stores plaintext
 * ❌ Loses privacy
 * ✅ Use for: results, outcomes, public reveals
 *
 * Choose based on use case:
 * - Keep encrypted: User decryption
 * - Must reveal: Public decryption
 */

/**
 * EXAMPLE USE CASES
 *
 * 1. Sealed-Bid Auction:
 *    - Bidding phase: All bids encrypted
 *    - Reveal phase: Winning bid publicly decrypted
 *    - Other bids: Remain encrypted or user-decrypted
 *
 * 2. Secret Voting:
 *    - Voting phase: All votes encrypted
 *    - Tallying phase: Final count publicly decrypted
 *    - Individual votes: Remain encrypted
 *
 * 3. Lottery/Raffle:
 *    - Entry phase: Ticket numbers encrypted
 *    - Draw phase: Winning number publicly decrypted
 *    - Verification: Anyone can verify fairness
 *
 * 4. Gaming:
 *    - Play phase: Moves encrypted
 *    - Reveal phase: Final outcome publicly decrypted
 *    - Prevents cheating while maintaining suspense
 */

/**
 * ANTI-PATTERN: Unnecessary Public Decryption
 *
 * ❌ BAD: Publicly decrypt user balance
 *   function revealBalance(address user) external {
 *     // DON'T! This exposes private data
 *     Gateway.requestDecryption(balances[user], callback);
 *   }
 *
 * ✅ GOOD: Use user decryption instead
 *   function getBalance() external view returns (euint32) {
 *     // User can decrypt client-side privately
 *     return balances[msg.sender];
 *   }
 *
 * Rule of thumb:
 * - If value should stay private → User decryption
 * - If value must be public → Public decryption
 */
