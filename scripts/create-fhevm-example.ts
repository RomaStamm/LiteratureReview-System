#!/usr/bin/env ts-node

/**
 * create-fhevm-example - CLI tool to generate standalone FHEVM example repositories
 *
 * Usage: ts-node scripts/create-fhevm-example.ts <example-name> [output-dir]
 *
 * Example: ts-node scripts/create-fhevm-example.ts literature-review ./my-literature-review
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

// Color codes for terminal output
enum Color {
  Reset = "\x1b[0m",
  Green = "\x1b[32m",
  Blue = "\x1b[34m",
  Yellow = "\x1b[33m",
  Red = "\x1b[31m",
  Cyan = "\x1b[36m",
}

function log(message: string, color: Color = Color.Reset): void {
  console.log(`${color}${message}${Color.Reset}`);
}

function error(message: string): never {
  log(`❌ Error: ${message}`, Color.Red);
  process.exit(1);
}

function success(message: string): void {
  log(`✅ ${message}`, Color.Green);
}

function info(message: string): void {
  log(`ℹ️  ${message}`, Color.Blue);
}

// Example configuration interface
interface ExampleConfig {
  contract: string;
  test: string;
  description: string;
  category: string;
}

// Map of example names to their contract and test paths
const EXAMPLES_MAP: Record<string, ExampleConfig> = {
  // Basic Examples
  "fhe-add": {
    contract: "contracts/basic/FHEAdd.sol",
    test: "test/basic/FHEAdd.ts",
    description: "Demonstrates FHE addition operations on encrypted values.",
    category: "Basic",
  },
  "fhe-subtract": {
    contract: "contracts/basic/FHESubtract.sol",
    test: "test/basic/FHESubtract.ts",
    description: "Shows how to perform subtraction on encrypted values with underflow protection.",
    category: "Basic",
  },
  "fhe-equality": {
    contract: "contracts/basic/FHEEquality.sol",
    test: "test/basic/FHEEquality.ts",
    description: "Compares encrypted values for equality returning encrypted boolean.",
    category: "Basic",
  },

  // Encryption Examples
  "encrypt-single": {
    contract: "contracts/encryption/EncryptSingleValue.sol",
    test: "test/encryption/EncryptSingleValue.ts",
    description: "Demonstrates receiving and storing a single encrypted value with input proofs.",
    category: "Encryption",
  },
  "encrypt-multiple": {
    contract: "contracts/encryption/EncryptMultipleValues.sol",
    test: "test/encryption/EncryptMultipleValues.ts",
    description: "Shows how to handle multiple encrypted values and permission management.",
    category: "Encryption",
  },

  // Decryption Examples
  "user-decrypt": {
    contract: "contracts/decryption/UserDecryptSingleValue.sol",
    test: "test/decryption/UserDecryptSingleValue.ts",
    description: "Demonstrates user decryption mechanism and permission requirements.",
    category: "Decryption",
  },
  "public-decrypt": {
    contract: "contracts/decryption/PublicDecryptSingleValue.sol",
    test: "test/decryption/PublicDecryptSingleValue.ts",
    description: "Shows public decryption for revealing encrypted values to everyone.",
    category: "Decryption",
  },

  // Advanced Examples
  "blind-auction": {
    contract: "contracts/advanced/BlindAuction.sol",
    test: "test/advanced/BlindAuction.ts",
    description: "Sealed-bid auction where bids remain encrypted during bidding phase.",
    category: "Advanced",
  },
  "access-control": {
    contract: "contracts/advanced/AccessControlExample.sol",
    test: "test/advanced/AccessControlExample.ts",
    description: "Complete guide to FHE permission system: allowThis, allow, and allowTransient.",
    category: "Advanced",
  },
  "literature-review": {
    contract: "contracts/LiteratureReviewSystem.sol",
    test: "test/LiteratureReviewSystem.ts",
    description: "A confidential literature awards platform using FHE to enable encrypted submissions, reviews, and winner selection.",
    category: "Advanced",
  },

  // Anti-Patterns and Education
  "common-mistakes": {
    contract: "contracts/antipatterns/CommonMistakes.sol",
    test: "test/antipatterns/CommonMistakes.ts",
    description: "Educational examples showing common mistakes and anti-patterns to avoid.",
    category: "Education",
  },
  "handles-and-proofs": {
    contract: "contracts/education/HandlesAndProofs.sol",
    test: "test/education/HandlesAndProofs.ts",
    description: "Complete explanation of FHE handles, input proofs, and symbolic execution.",
    category: "Education",
  },

  // Decryption - Multiple Values
  "user-decrypt-multiple": {
    contract: "contracts/decryption/UserDecryptMultipleValues.sol",
    test: "test/decryption/UserDecryptMultipleValues.ts",
    description: "User decryption mechanism for multiple encrypted values.",
    category: "Decryption",
  },
  "public-decrypt-multiple": {
    contract: "contracts/decryption/PublicDecryptMultipleValues.sol",
    test: "test/decryption/PublicDecryptMultipleValues.ts",
    description: "Public decryption for multiple encrypted values.",
    category: "Decryption",
  },

  // OpenZeppelin Integration
  "confidential-erc20": {
    contract: "contracts/openzeppelin/ConfidentialERC20.sol",
    test: "test/openzeppelin/ConfidentialERC20.ts",
    description: "Confidential ERC20 token with encrypted balances and transfers.",
    category: "OpenZeppelin",
  },
};

function copyRecursive(src: string, dest: string): void {
  if (!fs.existsSync(src)) {
    throw new Error(`Source path does not exist: ${src}`);
  }

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const files = fs.readdirSync(src);

  for (const file of files) {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);

    if (fs.lstatSync(srcPath).isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function generateReadme(
  exampleName: string,
  exampleConfig: ExampleConfig,
  outputDir: string
): void {
  const readmeContent = `# ${exampleName.replace(/-/g, " ")} - FHEVM Example

${exampleConfig.description}

## Quick Start

### Installation

\`\`\`bash
npm install
\`\`\`

### Compilation

\`\`\`bash
npm run compile
\`\`\`

### Running Tests

\`\`\`bash
npm run test
\`\`\`

## Project Structure

\`\`\`
.
├── contracts/
│   └── ${path.basename(exampleConfig.contract)}
├── test/
│   └── ${path.basename(exampleConfig.test)}
├── hardhat.config.ts
├── package.json
└── tsconfig.json
\`\`\`

## Key Concepts

This example demonstrates:
- FHE (Fully Homomorphic Encryption) implementation using FHEVM
- Privacy-preserving smart contract operations
- Encrypted data handling on blockchain
- Zero-knowledge proof validation

## Dependencies

- **@fhevm/solidity** - Core FHEVM Solidity library for FHE operations
- **@fhevm/hardhat-plugin** - Hardhat integration for FHEVM testing
- **Hardhat** - Development environment for smart contracts
- **TypeScript** - Type-safe development

## Resources

- [FHEVM Documentation](https://docs.zama.ai/fhevm)
- [Zama GitHub](https://github.com/zama-ai)
- [FHEVM Examples](https://github.com/zama-ai/fhevm-hardhat-template)

## License

BSD-3-Clause-Clear

---

Built with FHEVM by Zama
`;

  fs.writeFileSync(path.join(outputDir, "README.md"), readmeContent);
}

function generatePackageJson(
  exampleName: string,
  outputDir: string
): void {
  const packageJson = {
    name: `fhevm-example-${exampleName}`,
    version: "1.0.0",
    description: `FHEVM Example: ${exampleName}`,
    engines: {
      node: ">=20",
      "npm": ">=7.0.0",
    },
    license: "BSD-3-Clause-Clear",
    keywords: [
      "fhevm",
      "zama",
      "fhe",
      "privacy",
      "blockchain",
      "ethereum",
    ],
    dependencies: {
      "encrypted-types": "^0.0.4",
      "@fhevm/solidity": "^0.9.1",
    },
    devDependencies: {
      "@fhevm/hardhat-plugin": "^0.3.0-1",
      "@nomicfoundation/hardhat-chai-matchers": "^2.1.0",
      "@nomicfoundation/hardhat-ethers": "^3.1.0",
      "@types/chai": "^4.3.20",
      "@types/mocha": "^10.0.10",
      "@types/node": "^20.19.8",
      chai: "^4.5.0",
      "chai-as-promised": "^8.0.1",
      "cross-env": "^7.0.3",
      ethers: "^6.15.0",
      hardhat: "^2.26.0",
      "hardhat-deploy": "^0.11.45",
      mocha: "^11.7.1",
      "ts-node": "^10.9.2",
      typescript: "^5.8.3",
    },
    scripts: {
      compile: "cross-env TS_NODE_TRANSPILE_ONLY=true hardhat compile",
      test: "hardhat test",
      "test:sepolia": "hardhat test --network sepolia",
      "build:ts": "tsc --project tsconfig.json",
      typechain: "cross-env TS_NODE_TRANSPILE_ONLY=true hardhat typechain",
      clean: "rimraf ./fhevmTemp ./artifacts ./cache ./coverage ./types",
    },
  };

  fs.writeFileSync(
    path.join(outputDir, "package.json"),
    JSON.stringify(packageJson, null, 2)
  );
}

function generateHardhatConfig(outputDir: string): void {
  const configContent = `import "@fhevm/hardhat-plugin";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import type { HardhatUserConfig } from "hardhat/config";
import { vars } from "hardhat/config";

const MNEMONIC: string = vars.get("MNEMONIC", "test test test test test test test test test test test junk");
const INFURA_API_KEY: string = vars.get("INFURA_API_KEY", "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz");

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  etherscan: {
    apiKey: {
      sepolia: vars.get("ETHERSCAN_API_KEY", ""),
    },
  },
  networks: {
    hardhat: {
      accounts: {
        mnemonic: MNEMONIC,
      },
      chainId: 31337,
    },
    sepolia: {
      accounts: {
        mnemonic: MNEMONIC,
        path: "m/44'/60'/0'/0/",
        count: 10,
      },
      chainId: 11155111,
      url: \`https://sepolia.infura.io/v3/\${INFURA_API_KEY}\`,
    },
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: {
    version: "0.8.27",
    settings: {
      metadata: {
        bytecodeHash: "none",
      },
      optimizer: {
        enabled: true,
        runs: 800,
      },
      evmVersion: "cancun",
    },
  },
  typechain: {
    outDir: "types",
    target: "ethers-v6",
  },
};

export default config;
`;

  fs.writeFileSync(path.join(outputDir, "hardhat.config.ts"), configContent);
}

function generateTsConfig(outputDir: string): void {
  const tsConfig = {
    compilerOptions: {
      target: "ES2022",
      module: "commonjs",
      lib: ["ES2022"],
      moduleResolution: "node",
      esModuleInterop: true,
      skipLibCheck: true,
      strict: true,
      resolveJsonModule: true,
      outDir: "./dist",
      declaration: true,
      declarationMap: true,
      sourceMap: true,
      forceConsistentCasingInFileNames: true,
      typeRoots: ["./node_modules/@types", "./types"],
    },
    include: ["./test", "./types"],
    exclude: [
      "./node_modules",
      "./dist",
      "./cache",
      "./artifacts",
      "./coverage",
    ],
  };

  fs.writeFileSync(
    path.join(outputDir, "tsconfig.json"),
    JSON.stringify(tsConfig, null, 2)
  );
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    log("Available examples:", Color.Cyan);
    Object.keys(EXAMPLES_MAP).forEach((name) => {
      log(`  - ${name}`);
    });
    error("Please specify an example name");
  }

  const exampleName = args[0];
  const outputDir = args[1] || `./${exampleName}`;

  if (!EXAMPLES_MAP[exampleName]) {
    error(`Unknown example: ${exampleName}`);
  }

  const exampleConfig = EXAMPLES_MAP[exampleName];

  info(`Creating example: ${exampleName}`);
  info(`Output directory: ${outputDir}`);

  try {
    // Create directory structure
    fs.mkdirSync(path.join(outputDir, "contracts"), { recursive: true });
    fs.mkdirSync(path.join(outputDir, "test"), { recursive: true });

    // Copy contract file
    const contractPath = path.join(process.cwd(), exampleConfig.contract);
    if (!fs.existsSync(contractPath)) {
      error(`Contract file not found: ${contractPath}`);
    }
    fs.copyFileSync(
      contractPath,
      path.join(outputDir, "contracts", path.basename(exampleConfig.contract))
    );

    // Copy test file
    const testPath = path.join(process.cwd(), exampleConfig.test);
    if (!fs.existsSync(testPath)) {
      error(`Test file not found: ${testPath}`);
    }
    fs.copyFileSync(
      testPath,
      path.join(outputDir, "test", path.basename(exampleConfig.test))
    );

    // Generate supporting files
    generateReadme(exampleName, exampleConfig, outputDir);
    generatePackageJson(exampleName, outputDir);
    generateHardhatConfig(outputDir);
    generateTsConfig(outputDir);

    success(`Example created successfully!`);
    log("\nNext steps:", Color.Yellow);
    log(`1. cd ${outputDir}`);
    log(`2. npm install`);
    log(`3. npm run compile`);
    log(`4. npm run test`);
  } catch (err) {
    error(`Failed to create example: ${(err as Error).message}`);
  }
}

main();
