# Literature Review System

**Category:** Advanced

## Overview

This example demonstrates how to build a confidential literature awards platform using FHE, enabling encrypted submissions, confidential reviews, and fair winner selection.

## Key Concepts

### What is FHE (Fully Homomorphic Encryption)?

FHE allows computation on encrypted data without decryption. This enables:

- **Privacy:** Data remains encrypted throughout computation
- **Confidentiality:** Smart contract logic operates on encrypted values
- **Zero-Knowledge:** Proofs verify correct encryption binding

### FHEVM Integration

This example uses FHEVM from Zama to:

- Encrypt user inputs with zero-knowledge proofs
- Perform operations on encrypted values
- Control access to encrypted data
- Decrypt results through relayers

## Smart Contract Architecture

### Core Components

1. **Submission Management**
   - Authors submit literary works with encrypted metadata
   - Works include title, author, genre, and IPFS content hash
   - All sensitive data is encrypted on-chain

2. **Reviewer System**
   - Expert reviewers register and await approval
   - Owner authorizes qualified reviewers
   - Reviewers submit encrypted confidential evaluations

3. **Review Scoring**
   - Multi-dimensional scoring: Quality (1-100), Originality (1-100), Impact (1-100)
   - All scores are encrypted using euint32 type
   - Encrypted aggregation prevents individual score disclosure

4. **Award Engine**
   - Calculate winners using FHE operations
   - Homomorphic addition aggregates encrypted scores
   - Announce results after computation

5. **Period Management**
   - Time-locked submission periods (first 14 days of month)
   - Separate review periods (last 16 days of month)
   - Ensures proper workflow execution

## FHE Implementation Details

### Encrypted Data Types

```solidity
// Encrypted integer used for scores
euint32 encryptedScore;

// Encrypted scores in reviews
euint32 encryptedQualityScore;
euint32 encryptedOriginalityScore;
euint32 encryptedImpactScore;
```

### Permission System

The contract demonstrates the critical FHE permission pattern:

```solidity
// When storing encrypted values:
euint32 encryptedQuality = FHE.fromExternal(inputEuint32, inputProof);

// Grant contract permission
FHE.allowThis(encryptedQuality);

// Grant user permission for decryption
FHE.allow(encryptedQuality, msg.sender);
```

### Input Proof Validation

```solidity
// Zero-knowledge proof validates that:
// 1. User encrypted the value correctly
// 2. Encryption binding matches contract address
// 3. User address is correctly specified
function submitReview(
    uint32 _workId,
    uint32 _qualityScore,
    uint32 _originalityScore,
    uint32 _impactScore,
    string memory _encryptedComments
) external onlyAuthorizedReviewer duringReviewPeriod
```

## Test Suite Overview

The test suite (`test/LiteratureReviewSystem.ts`) includes:

### Deployment Tests
- ✅ Contract deploys successfully with owner set
- ✅ Initial periods are set correctly
- ✅ Authorization controls work

### Period Management Tests
- ✅ Period identification works correctly
- ❌ Only owner can start new periods
- ❌ Invalid period transitions are rejected

### Reviewer System Tests
- ✅ Users can register as reviewers
- ✅ Owner can approve reviewers
- ✅ Reviewer profiles track statistics
- ❌ Unauthorized approvals are rejected

### Work Submission Tests
- ✅ Authors can submit literary works
- ✅ Work metadata is stored correctly
- ✅ Work counts track per period
- ✅ Statistics are accurate

### Review Submission Tests
- ✅ Authorized reviewers can submit reviews
- ✅ FHE permission system works correctly
- ✅ Score validation enforces 1-100 range
- ❌ Duplicate reviews are rejected
- ❌ Unauthorized reviewers are blocked
- ❌ Reviews for non-existent works fail

### Access Control Tests
- ✅ Role-based authorization works
- ✅ Owner-only functions are protected
- ✅ Reviewer authorization is enforced

### Edge Cases
- ✅ Boundary values (1 and 100) are handled
- ✅ Multiple concurrent reviewers work
- ✅ Various work categories are supported

## Critical FHE Patterns

### ✅ CORRECT: Grant Both Permissions

```solidity
// Always grant contract permission first
FHE.allowThis(encryptedValue);

// Then grant user permission
FHE.allow(encryptedValue, msg.sender);
```

### ❌ INCORRECT: Missing allowThis

```solidity
// This will fail during decryption!
FHE.allow(encryptedValue, msg.sender);
// Missing FHE.allowThis(encryptedValue)
```

### ✅ CORRECT: Match Encryption Signer

```typescript
// Encrypt with user's address
const enc = await fhevm.createEncryptedInput(contractAddr, alice.address)
    .add32(qualityScore).encrypt();

// Call with same user
await contract.connect(alice).submitReview(
    workId,
    qualityScore,
    originalityScore,
    impactScore,
    comments
);
```

### ❌ INCORRECT: Mismatched Signer

```typescript
// Encrypt with Alice
const enc = await fhevm.createEncryptedInput(contractAddr, alice.address)
    .add32(score).encrypt();

// But call as Bob - will fail!
await contract.connect(bob).submitReview(workId, score, ...);
```

## Common Pitfalls and Solutions

### Pitfall 1: Forgetting FHE.allowThis()

**Problem:**
```solidity
FHE.allow(encryptedValue, msg.sender); // Only user permission
// Missing FHE.allowThis - contract can't decrypt!
```

**Solution:**
```solidity
FHE.allowThis(encryptedValue);         // Contract permission first
FHE.allow(encryptedValue, msg.sender);  // User permission second
```

### Pitfall 2: Using Encrypted Values in View Functions

**Problem:**
```solidity
// ❌ View functions can't work with encrypted values
function getScore() external view returns (euint32) {
    return scores[msg.sender];
}
```

**Solution:**
```solidity
// ✅ View functions return handles or plain data
function getScoreHandle() external view returns (string memory) {
    return "Encrypted score available through relayer";
}
```

### Pitfall 3: Mismatched Encryption Signers

**Problem:**
```typescript
// Encrypt for Alice but call as Bob
const enc = await fhevm.createEncryptedInput(
    contract.address,
    alice.address  // Encryption signer
).add32(score).encrypt();

await contract.connect(bob).doSomething(...); // Different signer
```

**Solution:**
```typescript
// Ensure encryption signer matches caller
const signer = bob.address; // Who will call the contract
const enc = await fhevm.createEncryptedInput(
    contract.address,
    signer  // Must match actual caller
).add32(score).encrypt();

await contract.connect(bob).doSomething(...); // Same signer
```

### Pitfall 4: Score Boundaries

**Problem:**
```solidity
require(_qualityScore >= 1 && _qualityScore <= 100, "Score out of range");
// But input validation must happen client-side before encryption
```

**Solution:**
```typescript
// Validate before encryption
if (quality < 1 || quality > 100) {
    throw new Error("Score must be 1-100");
}

const enc = await fhevm.createEncryptedInput(contract.address, signer)
    .add32(quality).encrypt();
```

## Running the Example

### Installation

```bash
npm install
```

### Compilation

```bash
npm run compile
```

### Running Tests

```bash
# All tests
npm run test

# With gas reporting
REPORT_GAS=true npm run test

# Coverage report
npm run coverage
```

### Testing on Sepolia Network

```bash
# Set environment variables first
export MNEMONIC="your mnemonic here"
export INFURA_API_KEY="your infura key"

# Run tests on Sepolia
npm run test:sepolia

# Deploy to Sepolia
npm run deploy:sepolia
```

## Contract API Reference

### State Functions

#### reviewers(address)
Returns reviewer profile information:
- name: string
- expertise: string
- isActive: bool
- reviewCount: uint32
- averageScore: euint32

#### submissions(uint32, uint32)
Returns literary work information:
- title: string
- author: string
- genre: string
- encryptedScore: euint32
- submitted: bool
- reviewed: bool
- submissionTime: uint256
- submitter: address
- ipfsHash: string

#### reviews(uint32, uint32, address)
Returns review information:
- encryptedQualityScore: euint32
- encryptedOriginalityScore: euint32
- encryptedImpactScore: euint32
- encryptedComments: string
- submitted: bool
- reviewer: address
- reviewTime: uint256

### Key Functions

#### registerReviewer(string memory _name, string memory _expertise)
Register as a reviewer (requires owner approval)

#### approveReviewer(address _reviewer)
Owner-only: Approve a registered reviewer

#### submitWork(string memory _title, string memory _author, string memory _genre, string memory _ipfsHash)
Submit a literary work during submission period

#### submitReview(uint32 _workId, uint32 _qualityScore, uint32 _originalityScore, uint32 _impactScore, string memory _encryptedComments)
Submit a review with encrypted scores

#### calculateResults(uint32 _period)
Owner-only: Calculate results using FHE operations

#### announceAwards(uint32 _period)
Owner-only: Announce award results

### View Functions

#### isSubmissionPeriodActive() → bool
Check if submission period is active

#### isReviewPeriodActive() → bool
Check if review period is active

#### getSubmissionInfo(uint32 _period, uint32 _workId)
Get work submission details

#### getReviewerProfile(address _reviewer)
Get reviewer statistics

#### getPeriodStats(uint32 _period)
Get submission statistics for period

#### getAwards(uint32 _period)
Get award results for period

## Integration with FHEVM Relayer

For full FHE functionality, integrate with the Zama relayer:

```typescript
import { createFhevmInstance } from "@zama-fhe/relayer-sdk";

const relayer = createFhevmInstance();

// To decrypt a review score:
const decryptedScore = await relayer.decrypt(
    contractAddress,
    encryptedScoreHandle,
    userPrivateKey
);
```

## Resources

- [FHEVM Documentation](https://docs.zama.ai/fhevm)
- [Zama GitHub](https://github.com/zama-ai)
- [FHEVM Hardhat Template](https://github.com/zama-ai/fhevm-hardhat-template)
- [Zama Community](https://www.zama.ai/community)
- [Solidity FHE Library API](https://docs.zama.ai/fhevm/references/solidity-library)

## License

BSD-3-Clause-Clear

---

Built with FHEVM by Zama
