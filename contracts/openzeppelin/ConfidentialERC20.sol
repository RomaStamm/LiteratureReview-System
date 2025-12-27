// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title Confidential ERC20 Token
 * @notice ERC20-like token with encrypted balances using FHEVM
 * @dev Simplified implementation inspired by OpenZeppelin's confidential contracts
 *
 * Key Features:
 * - Encrypted balances (no one sees your balance)
 * - Encrypted transfers (transfer amounts are secret)
 * - Encrypted allowances (approval amounts are secret)
 * - User can decrypt their own balance
 * - Public functions for name/symbol/total supply
 *
 * Based on ERC7984 concept (Confidential Token Standard)
 */
contract ConfidentialERC20 is SepoliaConfig {
  /// @notice Token name
  string public name;

  /// @notice Token symbol
  string public symbol;

  /// @notice Token decimals
  uint8 public constant decimals = 18;

  /// @notice Total supply (plaintext, public)
  uint256 public totalSupply;

  /// @notice Owner of the contract
  address public owner;

  /// @notice Encrypted balances
  mapping(address => euint32) private balances;

  /// @notice Encrypted allowances: owner => spender => amount
  mapping(address => mapping(address => euint32)) private allowances;

  /// @notice Events
  event Transfer(address indexed from, address indexed to);
  event Approval(address indexed owner, address indexed spender);
  event Mint(address indexed to, uint256 amount);

  constructor(string memory _name, string memory _symbol, uint256 _initialSupply) {
    name = _name;
    symbol = _symbol;
    owner = msg.sender;
    totalSupply = _initialSupply;

    // Mint initial supply to owner (encrypted)
    euint32 encInitialSupply = FHE.asEuint32(uint32(_initialSupply));
    balances[owner] = encInitialSupply;

    FHE.allowThis(encInitialSupply);
    FHE.allow(encInitialSupply, owner);

    emit Mint(owner, _initialSupply);
  }

  /**
   * @notice Get encrypted balance of account
   * @dev Returns encrypted balance handle (not plaintext!)
   *
   * User can decrypt this via relayer SDK client-side:
   *   const plainBalance = await relayer.decrypt(contractAddr, handle);
   *
   * @param account Account to query
   * @return Encrypted balance handle
   */
  function balanceOf(address account) external view returns (euint32) {
    return balances[account];
  }

  /**
   * @notice Transfer encrypted amount to recipient
   * @dev Amount is encrypted, no one knows how much was transferred
   *
   * Process:
   * 1. Sender encrypts amount client-side with input proof
   * 2. Contract receives encrypted amount
   * 3. Validates proof and creates handle
   * 4. Subtracts from sender (encrypted)
   * 5. Adds to recipient (encrypted)
   * 6. Grants permissions to both parties
   *
   * @param to Recipient address
   * @param encryptedAmount Encrypted transfer amount
   * @param inputProof Zero-knowledge proof for amount
   * @return Success (always true if doesn't revert)
   */
  function transfer(
    address to,
    externalEuint32 encryptedAmount,
    bytes calldata inputProof
  ) external returns (bool) {
    require(to != address(0), "Transfer to zero address");

    // ✅ CORRECT: Validate and get encrypted amount
    euint32 amount = FHE.fromExternal(encryptedAmount, inputProof);

    // Perform encrypted subtraction and addition
    balances[msg.sender] = FHE.sub(balances[msg.sender], amount);
    balances[to] = FHE.add(balances[to], amount);

    // ✅ CRITICAL: Grant permissions to both parties
    FHE.allowThis(balances[msg.sender]);
    FHE.allow(balances[msg.sender], msg.sender);

    FHE.allowThis(balances[to]);
    FHE.allow(balances[to], to);

    emit Transfer(msg.sender, to);
    return true;
  }

  /**
   * @notice Approve spender to spend encrypted amount
   * @dev Allowance is encrypted
   *
   * @param spender Address to approve
   * @param encryptedAmount Encrypted allowance amount
   * @param inputProof Zero-knowledge proof
   * @return Success
   */
  function approve(
    address spender,
    externalEuint32 encryptedAmount,
    bytes calldata inputProof
  ) external returns (bool) {
    require(spender != address(0), "Approve to zero address");

    // ✅ CORRECT: Create encrypted allowance
    euint32 amount = FHE.fromExternal(encryptedAmount, inputProof);

    allowances[msg.sender][spender] = amount;

    // Grant permissions
    FHE.allowThis(amount);
    FHE.allow(amount, msg.sender);
    FHE.allow(amount, spender);  // Spender can see allowance

    emit Approval(msg.sender, spender);
    return true;
  }

  /**
   * @notice Transfer from owner to recipient using allowance
   * @dev Spender transfers encrypted amount on behalf of owner
   *
   * @param from Owner address
   * @param to Recipient address
   * @param encryptedAmount Encrypted transfer amount
   * @param inputProof Zero-knowledge proof
   * @return Success
   */
  function transferFrom(
    address from,
    address to,
    externalEuint32 encryptedAmount,
    bytes calldata inputProof
  ) external returns (bool) {
    require(from != address(0), "Transfer from zero address");
    require(to != address(0), "Transfer to zero address");

    euint32 amount = FHE.fromExternal(encryptedAmount, inputProof);

    // Decrease allowance (encrypted subtraction)
    allowances[from][msg.sender] = FHE.sub(
      allowances[from][msg.sender],
      amount
    );

    // Transfer balances
    balances[from] = FHE.sub(balances[from], amount);
    balances[to] = FHE.add(balances[to], amount);

    // Update permissions
    FHE.allowThis(allowances[from][msg.sender]);
    FHE.allow(allowances[from][msg.sender], from);
    FHE.allow(allowances[from][msg.sender], msg.sender);

    FHE.allowThis(balances[from]);
    FHE.allow(balances[from], from);

    FHE.allowThis(balances[to]);
    FHE.allow(balances[to], to);

    emit Transfer(from, to);
    return true;
  }

  /**
   * @notice Get encrypted allowance
   * @param tokenOwner Owner of tokens
   * @param spender Spender address
   * @return Encrypted allowance
   */
  function allowance(address tokenOwner, address spender)
    external
    view
    returns (euint32)
  {
    return allowances[tokenOwner][spender];
  }

  /**
   * @notice Mint new tokens (owner only)
   * @dev Increases total supply and recipient's encrypted balance
   *
   * @param to Recipient
   * @param amount Amount to mint (plaintext for simplicity)
   */
  function mint(address to, uint32 amount) external {
    require(msg.sender == owner, "Only owner can mint");
    require(to != address(0), "Mint to zero address");

    // Increase total supply
    totalSupply += amount;

    // Add to recipient's encrypted balance
    euint32 encAmount = FHE.asEuint32(amount);
    balances[to] = FHE.add(balances[to], encAmount);

    FHE.allowThis(balances[to]);
    FHE.allow(balances[to], to);

    emit Mint(to, amount);
  }
}

/**
 * CONFIDENTIAL ERC20 PATTERNS
 *
 * Key Differences from Standard ERC20:
 *
 * Standard ERC20:
 * - balances are public (anyone can see)
 * - transfer amounts are public
 * - allowances are public
 * ❌ No privacy
 *
 * Confidential ERC20:
 * - balances are encrypted (euint32)
 * - transfer amounts are encrypted
 * - allowances are encrypted
 * ✅ Complete privacy
 *
 * Benefits:
 * =========
 * 1. Balance Privacy
 *    No one knows how much you own
 *
 * 2. Transaction Privacy
 *    Transfer amounts are secret
 *
 * 3. Allowance Privacy
 *    Approval amounts are secret
 *
 * 4. Selective Disclosure
 *    You can decrypt your own balance
 *    Others cannot
 *
 * Use Cases:
 * ==========
 * 1. Private Payroll
 *    - Salary amounts secret
 *    - Balance privacy
 *
 * 2. Confidential Investments
 *    - Investment amounts secret
 *    - Holdings private
 *
 * 3. Anonymous Donations
 *    - Donation amounts secret
 *    - Donor balances private
 *
 * 4. Privacy-Preserving DeFi
 *    - Trading amounts secret
 *    - Positions private
 */

/**
 * COMPARISON: Standard vs Confidential
 *
 * Standard ERC20:
 * ---------------
 * function balanceOf(address account) returns (uint256) {
 *   return balances[account];  // ❌ Public! Anyone can see
 * }
 *
 * function transfer(address to, uint256 amount) {
 *   balances[msg.sender] -= amount;  // ❌ Public operation
 *   balances[to] += amount;          // ❌ Public operation
 * }
 *
 * Confidential ERC20:
 * -------------------
 * function balanceOf(address account) returns (euint32) {
 *   return balances[account];  // ✅ Returns encrypted handle
 * }
 *
 * function transfer(address to, externalEuint32 amount, bytes proof) {
 *   balances[msg.sender] = FHE.sub(balances[msg.sender], amount);  // ✅ Encrypted
 *   balances[to] = FHE.add(balances[to], amount);                   // ✅ Encrypted
 *   FHE.allowThis(balances[msg.sender]);  // ✅ Permission
 *   FHE.allow(balances[msg.sender], msg.sender);
 *   FHE.allowThis(balances[to]);
 *   FHE.allow(balances[to], to);
 * }
 */

/**
 * INTEGRATION WITH OPENZEPPELIN
 *
 * OpenZeppelin's Confidential Contracts library provides:
 * 1. ConfidentialERC20 - Full implementation
 * 2. ConfidentialERC20Mintable - With minting
 * 3. ConfidentialERC20Burnable - With burning
 * 4. Access control integration
 * 5. Extensions and utilities
 *
 * To Use OpenZeppelin Confidential:
 * ==================================
 * import "@openzeppelin/contracts-confidential/token/ERC20/ConfidentialERC20.sol";
 *
 * contract MyToken is ConfidentialERC20 {
 *   constructor() ConfidentialERC20("MyToken", "MTK") {
 *     // Token initialized
 *   }
 * }
 *
 * Note: This example shows the concept
 * For production, use OpenZeppelin's audited implementation
 */

/**
 * LIMITATIONS AND CONSIDERATIONS
 *
 * 1. Underflow Protection
 *    - Encrypted subtraction doesn't revert on underflow
 *    - Must handle at application level
 *    - Or validate before encryption
 *
 * 2. Overflow Protection
 *    - Encrypted addition may overflow
 *    - euint32 wraps at 2^32 - 1
 *    - Consider using euint64 for larger values
 *
 * 3. Total Supply
 *    - Kept plaintext for transparency
 *    - Alternatively, can be encrypted
 *
 * 4. Gas Costs
 *    - FHE operations more expensive
 *    - Encrypted transfers cost more gas
 *    - Trade privacy for gas efficiency
 *
 * 5. Comparison Operations
 *    - Cannot check balance > amount on-chain
 *    - Must decrypt client-side for validation
 *    - Or accept potential underflow
 */

/**
 * SECURITY BEST PRACTICES
 *
 * 1. Always Validate Input Proofs
 *    ✅ Use FHE.fromExternal(encrypted, proof)
 *    ❌ Never skip proof validation
 *
 * 2. Always Grant Permissions
 *    ✅ FHE.allowThis() for contract
 *    ✅ FHE.allow() for users
 *
 * 3. Update Permissions on Transfer
 *    ✅ Both sender and receiver need permissions
 *
 * 4. Protect Mint/Burn Functions
 *    ✅ Only authorized addresses
 *    ✅ Access control modifiers
 *
 * 5. Validate Addresses
 *    ✅ Check for zero address
 *    ✅ Validate recipient exists
 */
