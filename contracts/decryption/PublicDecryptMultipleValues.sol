// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title Public Decrypt Multiple Values Example
 * @notice Demonstrates public decryption for multiple encrypted values
 * @dev Shows when and how to reveal multiple encrypted values to everyone
 *
 * Use Cases:
 * - Auction: Reveal winning bid and runner-up
 * - Election: Reveal top 3 candidates
 * - Leaderboard: Reveal top scores
 * - Results: Reveal final standings
 */
contract PublicDecryptMultipleValues is SepoliaConfig {
  /// @notice Competition results
  struct Results {
    uint32 firstPlace;
    uint32 secondPlace;
    uint32 thirdPlace;
    bool revealed;
  }

  /// @notice Encrypted scores
  mapping(uint256 => mapping(address => euint32)) private scores;

  /// @notice Final results (revealed)
  mapping(uint256 => Results) public results;

  /// @notice Event when decryption requested
  event DecryptionRequested(uint256 indexed competitionId, uint256 timestamp);

  /// @notice Event when results revealed
  event ResultsRevealed(
    uint256 indexed competitionId,
    uint32 first,
    uint32 second,
    uint32 third,
    uint256 timestamp
  );

  /**
   * @notice Submit encrypted score
   * @param competitionId Competition identifier
   * @param score Encrypted score value
   * @param proof Input proof
   */
  function submitScore(
    uint256 competitionId,
    externalEuint32 score,
    bytes calldata proof
  ) external {
    euint32 encScore = FHE.fromExternal(score, proof);

    scores[competitionId][msg.sender] = encScore;

    FHE.allowThis(encScore);
    FHE.allow(encScore, msg.sender);
  }

  /**
   * @notice Request decryption of top 3 scores
   * @dev This initiates async decryption process
   *
   * In Production:
   * - Calls Gateway.requestDecryption() for each score
   * - Multiple decryption requests initiated
   * - Callbacks return plaintext values
   * - Results stored in public mapping
   *
   * @param competitionId Competition to reveal
   */
  function revealTopThree(uint256 competitionId) external {
    require(!results[competitionId].revealed, "Already revealed");

    // In production, would request decryption for multiple values:
    // uint256 id1 = Gateway.requestDecryption(
    //   scores[competitionId][firstPlace],
    //   this.decryptionCallback.selector
    // );
    // uint256 id2 = Gateway.requestDecryption(
    //   scores[competitionId][secondPlace],
    //   this.decryptionCallback.selector
    // );
    // uint256 id3 = Gateway.requestDecryption(
    //   scores[competitionId][thirdPlace],
    //   this.decryptionCallback.selector
    // );

    emit DecryptionRequested(competitionId, block.timestamp);
  }

  /**
   * @notice Callback receiving decrypted values
   * @dev Called by decryption gateway with plaintext results
   *
   * IMPORTANT: In production, must validate:
   * - msg.sender is decryption gateway
   * - Values are correctly decrypted
   * - Signatures are valid
   *
   * @param competitionId Competition identifier
   * @param first Decrypted first place score
   * @param second Decrypted second place score
   * @param third Decrypted third place score
   */
  function setResults(
    uint256 competitionId,
    uint32 first,
    uint32 second,
    uint32 third
  ) external {
    // In production: require(msg.sender == GATEWAY_ADDRESS);

    results[competitionId] = Results({
      firstPlace: first,
      secondPlace: second,
      thirdPlace: third,
      revealed: true
    });

    emit ResultsRevealed(competitionId, first, second, third, block.timestamp);
  }

  /**
   * @notice Get results for competition
   * @return Competition results structure
   */
  function getResults(uint256 competitionId)
    external
    view
    returns (Results memory)
  {
    require(results[competitionId].revealed, "Not revealed yet");
    return results[competitionId];
  }

  /**
   * @notice Get all top three scores at once
   * @return first First place score
   * @return second Second place score
   * @return third Third place score
   */
  function getTopThree(uint256 competitionId)
    external
    view
    returns (
      uint32,
      uint32,
      uint32
    )
  {
    require(results[competitionId].revealed, "Not revealed yet");

    Results memory res = results[competitionId];
    return (res.firstPlace, res.secondPlace, res.thirdPlace);
  }

  /**
   * @notice Check if results are revealed
   * @return Whether results have been publicly revealed
   */
  function isRevealed(uint256 competitionId) external view returns (bool) {
    return results[competitionId].revealed;
  }

  /**
   * @notice Demonstrate selective revelation
   * @dev Only reveal top score, keep others encrypted
   *
   * @param competitionId Competition to partially reveal
   * @param topScore The decrypted top score
   */
  function revealWinnerOnly(uint256 competitionId, uint32 topScore)
    external
  {
    require(!results[competitionId].revealed, "Already revealed");

    // Only set first place
    results[competitionId].firstPlace = topScore;
    results[competitionId].revealed = true;
    // Keep second and third at 0 (unrevealed)

    emit ResultsRevealed(competitionId, topScore, 0, 0, block.timestamp);
  }
}

/**
 * MULTIPLE VALUE PUBLIC DECRYPTION PATTERNS
 *
 * Pattern 1: Reveal All Related Values
 *   ✅ Reveal all scores of winner
 *   ✅ Reveal complete results
 *   ✅ Atomic operation (all or nothing)
 *
 * Pattern 2: Selective Revelation
 *   ✅ Reveal only top result
 *   ✅ Keep others encrypted
 *   ✅ Reveal in stages
 *
 * Pattern 3: Ordered Revelation
 *   ✅ First reveal 1st place
 *   ✅ Then reveal 2nd place
 *   ✅ Finally reveal 3rd place
 *   ✅ Drama and suspense!
 *
 * Pattern 4: Conditional Revelation
 *   ✅ Only reveal if conditions met
 *   ✅ Reveal after timeout
 *   ✅ Reveal on demand
 */

/**
 * DECRYPTION GATEWAY PATTERN
 *
 * Flow:
 * 1. Request Decryption
 *    uint256 requestId = Gateway.requestDecryption(
 *      encryptedValue1,
 *      this.callback.selector
 *    );
 *
 * 2. Relayer Processing
 *    - Receives decryption request
 *    - Submits to relayer network
 *    - Threshold decryption performed
 *    - Result computed securely
 *
 * 3. Callback
 *    function decryptionCallback(
 *      uint256 requestId,
 *      uint32 plaintext
 *    ) external {
 *      // Store plaintext
 *    }
 *
 * 4. Results Public
 *    - Everyone can read plaintext
 *    - Immutable on-chain
 *    - Verifiable and transparent
 *
 * Key: Each value needs separate decryption request
 */

/**
 * USE CASES FOR MULTIPLE PUBLIC DECRYPTION
 *
 * 1. Leaderboard
 *    Reveal:
 *    - Top score
 *    - Runner-up score
 *    - Third place score
 *    - All addresses
 *    Everyone sees full leaderboard
 *
 * 2. Auction Results
 *    Reveal:
 *    - Winning bid
 *    - Winner address
 *    - Runner-up bid (optional)
 *    Public knows outcome
 *
 * 3. Election/Voting
 *    Reveal:
 *    - Top 3 candidates
 *    - Vote counts
 *    - Final results
 *    Voters verify results
 *
 * 4. Stock Trading
 *    Reveal:
 *    - Highest bid
 *    - Lowest ask
 *    - Clearing price
 *    - Volume
 *    Market transparency
 *
 * 5. Salary/Compensation
 *    Reveal:
 *    - Top earners (with permission)
 *    - Average salary
 *    - Salary ranges
 *    Pay equity analysis
 */

/**
 * IMPORTANT: User vs Public Decryption Decision
 *
 * User Decryption:
 * ✅ Each user sees their value
 * ✅ Values stay encrypted on-chain
 * ✅ Privacy preserved
 * ❌ Cannot do cross-user logic
 *
 * Public Decryption:
 * ✅ Everyone sees value
 * ✅ Can perform comparisons
 * ✅ Final results determined
 * ❌ Loses all privacy
 * ❌ Irreversible
 *
 * Decision Rule:
 * - If value should stay private → User decryption
 * - If value must be public → Public decryption
 * - If both needed → Different values/fields
 */

/**
 * ANTI-PATTERN: Unnecessary Public Decryption
 *
 * ❌ BAD: Decrypt all user scores
 *   function showAllScores(uint256 competitionId) external {
 *     // Loop through all users
 *     // Decrypt their encrypted scores
 *     // Expose private information!
 *   }
 *
 * ✅ GOOD: Only decrypt results needed
 *   function revealWinners() external {
 *     // Decrypt only top 3
 *     // Keep other scores encrypted
 *     // Only necessary data revealed
 *   }
 */

/**
 * GAS CONSIDERATIONS FOR MULTIPLE DECRYPTIONS
 *
 * Cost Breakdown:
 * - Each decryption request: ~21,000 gas (estimation)
 * - Callback execution: ~50,000 gas per callback
 * - Storage of results: ~22,000 gas per value
 *
 * Total for 3 values: ~200,000+ gas
 *
 * Optimization:
 * 1. Batch decryption requests
 * 2. Single callback for multiple values
 * 3. Store results efficiently
 * 4. Consider off-chain aggregation first
 *
 * When to Use Public Decryption:
 * ✅ Results that MUST be public
 * ✅ Can be revealed asynchronously
 * ✅ Value justifies gas cost
 *
 * When NOT to Use:
 * ❌ Private user data
 * ❌ Intermediate calculations
 * ❌ Data that can stay encrypted
 */
