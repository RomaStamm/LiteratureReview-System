# FHEVM Hardhat Base Template

A minimal, clean Hardhat template for developing FHEVM (Fully Homomorphic Encryption Virtual Machine) smart contracts.

This template provides:
- Pre-configured Hardhat setup for FHEVM
- Proper TypeScript configuration
- All necessary dependencies
- Ready to clone and customize

## Quick Start

### Installation

```bash
npm install
```

### Compile Contracts

```bash
npm run compile
```

### Run Tests

```bash
npm run test
```

### Deploy to Sepolia

```bash
export MNEMONIC="your twelve word mnemonic"
export INFURA_API_KEY="your infura api key"
npm run deploy:sepolia
```

## Project Structure

```
.
├── contracts/       # Solidity smart contracts
├── test/           # TypeScript tests
├── deploy/         # Deployment scripts
├── types/          # TypeChain generated types
├── hardhat.config.ts
├── tsconfig.json
└── package.json
```

## Key Dependencies

- `@fhevm/solidity` - FHE Solidity library
- `@fhevm/hardhat-plugin` - Hardhat integration
- `@zama-fhe/relayer-sdk` - Decryption relayer SDK
- `ethers` - Ethereum library
- `typescript` - Type safety

## Available Commands

```bash
npm run compile          # Compile smart contracts
npm run test           # Run tests
npm run test:sepolia   # Run tests on Sepolia
npm run coverage       # Coverage report
npm run lint           # Lint Solidity and TypeScript
npm run prettier:write # Format code
npm run clean          # Clean artifacts
npm run deploy:sepolia # Deploy to Sepolia network
npm run verify:sepolia # Verify on Etherscan
```

## Documentation

See the main project README for:
- FHEVM concepts and patterns
- Complete example documentation
- Common pitfalls and solutions
- Integration guides

## License

BSD-3-Clause-Clear

Built with FHEVM by Zama
