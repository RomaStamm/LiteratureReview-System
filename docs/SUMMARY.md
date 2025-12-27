# FHEVM Examples Documentation

## Table of Contents

- [Literature Review System](literature-review.md)

## Overview

This documentation provides comprehensive guides for FHEVM examples, covering:

- FHE (Fully Homomorphic Encryption) concepts
- FHEVM integration patterns
- Practical smart contract examples
- Test implementations
- Common pitfalls and best practices

## What is FHEVM?

FHEVM (Fully Homomorphic Encryption Virtual Machine) by Zama enables computation on encrypted data without decryption. This allows smart contracts to:

- Process sensitive information confidentially
- Maintain user privacy while ensuring security
- Provide transparent yet private execution
- Enable novel privacy-preserving applications

## Key Concepts

### Encryption Binding

FHEVM values are bound to a `[contract, user]` pair:

1. **Client-side encryption**: Users encrypt data locally
2. **Input proofs**: Zero-knowledge proofs verify correct binding
3. **On-chain computation**: Contract performs operations on encrypted values
4. **Selective decryption**: Only authorized parties can decrypt results

### Permission System

Two types of permissions control access to encrypted values:

- **Contract Permission**: `FHE.allowThis(value)` - allows contract to access
- **User Permission**: `FHE.allow(value, user)` - allows user to decrypt

Both permissions must be granted for successful decryption!

### Critical Pattern

```solidity
// ALWAYS grant both permissions:
FHE.allowThis(encryptedValue);         // Step 1: Contract permission
FHE.allow(encryptedValue, msg.sender);  // Step 2: User permission
```

## Example Categories

### Basic Examples
- Simple operations on encrypted values
- Encryption and decryption mechanisms
- Permission and access control
- Input proof handling

### Advanced Examples
- Confidential auctions
- Privacy-preserving evaluations
- Multi-party confidential computation

## Getting Started

Each example includes:

1. **Solidity Smart Contract** - FHE logic and operations
2. **TypeScript Tests** - Demonstrating correct usage
3. **Documentation** - Explaining concepts and patterns
4. **Automation Scripts** - Generate standalone repositories

### Quick Start

```bash
# Install dependencies
npm install

# Compile contracts
npm run compile

# Run tests
npm run test

# Generate standalone example
npm run create-example literature-review ./my-example
```

## Common Pitfalls

1. **Missing FHE.allowThis()** - Always grant both permissions
2. **Mismatched signers** - Encryption signer must match caller
3. **View functions with encrypted data** - Not supported
4. **Forgetting input proofs** - Required for security

## Development Workflow

1. Write Solidity contract with FHE operations
2. Create TypeScript tests demonstrating usage
3. Include JSDoc comments explaining patterns
4. Generate documentation from annotations
5. Test standalone repository generation
6. Verify all patterns are correct

## Resources

- [FHEVM Docs](https://docs.zama.ai/fhevm)
- [Zama GitHub](https://github.com/zama-ai)
- [Hardhat Template](https://github.com/zama-ai/fhevm-hardhat-template)
- [Community Forum](https://www.zama.ai/community)
- [Discord Server](https://discord.com/invite/zama)

## License

All examples are licensed under BSD-3-Clause-Clear

---

Built with FHEVM by Zama
