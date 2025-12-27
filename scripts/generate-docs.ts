#!/usr/bin/env ts-node

/**
 * generate-docs - Generates GitBook-formatted documentation from contracts and tests
 *
 * Usage: ts-node scripts/generate-docs.ts <example-name> [options]
 *
 * Example: ts-node scripts/generate-docs.ts literature-review --output docs/
 */

import * as fs from "fs";
import * as path from "path";

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

function success(message: string): void {
  log(`✅ ${message}`, Color.Green);
}

function info(message: string): void {
  log(`ℹ️  ${message}`, Color.Blue);
}

function error(message: string): never {
  log(`❌ Error: ${message}`, Color.Red);
  process.exit(1);
}

// Documentation configuration interface
interface DocsConfig {
  title: string;
  description: string;
  contract: string;
  test: string;
  output: string;
  category: string;
}

// Example configurations
const EXAMPLES_CONFIG: Record<string, DocsConfig> = {
  // Basic Examples
  "fhe-add": {
    title: "FHE Addition Operations",
    description: "This example demonstrates how to perform addition on encrypted values using FHE.add().",
    contract: "contracts/basic/FHEAdd.sol",
    test: "test/basic/FHEAdd.ts",
    output: "docs/fhe-add.md",
    category: "Basic",
  },
  "fhe-subtract": {
    title: "FHE Subtraction Operations",
    description: "This example shows how to perform subtraction on encrypted values with underflow considerations.",
    contract: "contracts/basic/FHESubtract.sol",
    test: "test/basic/FHESubtract.ts",
    output: "docs/fhe-subtract.md",
    category: "Basic",
  },
  "fhe-equality": {
    title: "FHE Equality Comparisons",
    description: "This example demonstrates how to compare encrypted values for equality using FHE.eq().",
    contract: "contracts/basic/FHEEquality.sol",
    test: "test/basic/FHEEquality.ts",
    output: "docs/fhe-equality.md",
    category: "Basic",
  },

  // Encryption Examples
  "encrypt-single": {
    title: "Encrypt Single Value",
    description: "This example demonstrates the FHE encryption mechanism for single values and common pitfalls.",
    contract: "contracts/encryption/EncryptSingleValue.sol",
    test: "test/encryption/EncryptSingleValue.ts",
    output: "docs/encrypt-single.md",
    category: "Encryption",
  },
  "encrypt-multiple": {
    title: "Encrypt Multiple Values",
    description: "This example shows how to encrypt and handle multiple values in a single transaction.",
    contract: "contracts/encryption/EncryptMultipleValues.sol",
    test: "test/encryption/EncryptMultipleValues.ts",
    output: "docs/encrypt-multiple.md",
    category: "Encryption",
  },

  // Decryption Examples
  "user-decrypt": {
    title: "User Decryption",
    description: "This example demonstrates the user decryption mechanism and permission requirements.",
    contract: "contracts/decryption/UserDecryptSingleValue.sol",
    test: "test/decryption/UserDecryptSingleValue.ts",
    output: "docs/user-decrypt.md",
    category: "Decryption",
  },
  "public-decrypt": {
    title: "Public Decryption",
    description: "This example shows public decryption for revealing encrypted values to everyone.",
    contract: "contracts/decryption/PublicDecryptSingleValue.sol",
    test: "test/decryption/PublicDecryptSingleValue.ts",
    output: "docs/public-decrypt.md",
    category: "Decryption",
  },

  // Advanced Examples
  "blind-auction": {
    title: "Blind Auction",
    description: "This example demonstrates a sealed-bid auction where bids remain encrypted during the bidding phase.",
    contract: "contracts/advanced/BlindAuction.sol",
    test: "test/advanced/BlindAuction.ts",
    output: "docs/blind-auction.md",
    category: "Advanced",
  },
  "access-control": {
    title: "Access Control with FHE",
    description: "This example provides a complete guide to FHEVM permission system: allowThis, allow, and allowTransient.",
    contract: "contracts/advanced/AccessControlExample.sol",
    test: "test/advanced/AccessControlExample.ts",
    output: "docs/access-control.md",
    category: "Advanced",
  },
  "literature-review": {
    title: "Literature Review System",
    description: "This example demonstrates how to build a confidential literature awards platform using FHE, enabling encrypted submissions, confidential reviews, and fair winner selection.",
    contract: "contracts/LiteratureReviewSystem.sol",
    test: "test/LiteratureReviewSystem.ts",
    output: "docs/literature-review.md",
    category: "Advanced",
  },

  // Anti-Patterns and Education
  "common-mistakes": {
    title: "Common Mistakes and Anti-Patterns",
    description: "This educational example shows common mistakes developers make when working with FHEVM and how to avoid them.",
    contract: "contracts/antipatterns/CommonMistakes.sol",
    test: "test/antipatterns/CommonMistakes.ts",
    output: "docs/common-mistakes.md",
    category: "Education",
  },
  "handles-and-proofs": {
    title: "Handles, Input Proofs, and Symbolic Execution",
    description: "This guide explains how FHE handles work, what input proofs validate, and how symbolic execution ensures correctness.",
    contract: "contracts/education/HandlesAndProofs.sol",
    test: "test/education/HandlesAndProofs.ts",
    output: "docs/handles-and-proofs.md",
    category: "Education",
  },

  // Decryption - Multiple Values
  "user-decrypt-multiple": {
    title: "User Decrypt Multiple Values",
    description: "This example demonstrates how users can decrypt multiple encrypted values with proper permission management.",
    contract: "contracts/decryption/UserDecryptMultipleValues.sol",
    test: "test/decryption/UserDecryptMultipleValues.ts",
    output: "docs/user-decrypt-multiple.md",
    category: "Decryption",
  },
  "public-decrypt-multiple": {
    title: "Public Decrypt Multiple Values",
    description: "This example shows public decryption for multiple values, useful for leaderboards and results.",
    contract: "contracts/decryption/PublicDecryptMultipleValues.sol",
    test: "test/decryption/PublicDecryptMultipleValues.ts",
    output: "docs/public-decrypt-multiple.md",
    category: "Decryption",
  },

  // OpenZeppelin Integration
  "confidential-erc20": {
    title: "Confidential ERC20 Token",
    description: "This example demonstrates a confidential ERC20 token with encrypted balances and transfers, inspired by OpenZeppelin.",
    contract: "contracts/openzeppelin/ConfidentialERC20.sol",
    test: "test/openzeppelin/ConfidentialERC20.ts",
    output: "docs/confidential-erc20.md",
    category: "OpenZeppelin",
  },
};

function readFileContent(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return `File not found: ${filePath}`;
  }
}

function generateDocumentation(
  exampleName: string,
  config: DocsConfig
): string {
  const contractContent = readFileContent(config.contract);
  const testContent = readFileContent(config.test);

  let doc = `# ${config.title}\n\n`;
  doc += `**Category:** ${config.category}\n\n`;
  doc += `## Overview\n\n`;
  doc += `${config.description}\n\n`;

  doc += `## Key Concepts\n\n`;
  doc += `### What is FHE (Fully Homomorphic Encryption)?\n\n`;
  doc += `FHE allows computation on encrypted data without decryption. This enables:\n\n`;
  doc += `- **Privacy:** Data remains encrypted throughout computation\n`;
  doc += `- **Confidentiality:** Smart contract logic operates on encrypted values\n`;
  doc += `- **Zero-Knowledge:** Proofs verify correct encryption binding\n\n`;

  doc += `### FHEVM Integration\n\n`;
  doc += `This example uses FHEVM from Zama to:\n\n`;
  doc += `- Encrypt user inputs with zero-knowledge proofs\n`;
  doc += `- Perform operations on encrypted values\n`;
  doc += `- Control access to encrypted data\n`;
  doc += `- Decrypt results through relayers\n\n`;

  doc += `## Smart Contract\n\n`;
  doc += `### Contract Code\n\n`;
  doc += `\`\`\`solidity\n`;
  doc += contractContent;
  doc += `\n\`\`\`\n\n`;

  doc += `## Test Examples\n\n`;
  doc += `### Test File\n\n`;
  doc += `\`\`\`typescript\n`;
  doc += testContent;
  doc += `\n\`\`\`\n\n`;

  doc += `## Critical Patterns\n\n`;
  doc += `### ✅ Correct: Grant Both Permissions\n\n`;
  doc += `\`\`\`solidity\n`;
  doc += `FHE.allowThis(encryptedValue);        // Contract permission\n`;
  doc += `FHE.allow(encryptedValue, msg.sender); // User permission\n`;
  doc += `\`\`\`\n\n`;

  doc += `### ❌ Incorrect: Missing allowThis\n\n`;
  doc += `\`\`\`solidity\n`;
  doc += `FHE.allow(encryptedValue, msg.sender); // Missing allowThis - will fail!\n`;
  doc += `\`\`\`\n\n`;

  doc += `### ✅ Correct: Match Encryption Signer\n\n`;
  doc += `\`\`\`typescript\n`;
  doc += `const enc = await fhevm.createEncryptedInput(contractAddr, alice.address)\n`;
  doc += `    .add32(123).encrypt();\n`;
  doc += `await contract.connect(alice).operate(enc.handles[0], enc.inputProof);\n`;
  doc += `\`\`\`\n\n`;

  doc += `### ❌ Incorrect: Mismatched Signer\n\n`;
  doc += `\`\`\`typescript\n`;
  doc += `const enc = await fhevm.createEncryptedInput(contractAddr, alice.address)\n`;
  doc += `    .add32(123).encrypt();\n`;
  doc += `await contract.connect(bob).operate(enc.handles[0], enc.inputProof); // Fails!\n`;
  doc += `\`\`\`\n\n`;

  doc += `## Running the Example\n\n`;
  doc += `### Installation\n\n`;
  doc += `\`\`\`bash\n`;
  doc += `npm install\n`;
  doc += `\`\`\`\n\n`;

  doc += `### Compilation\n\n`;
  doc += `\`\`\`bash\n`;
  doc += `npm run compile\n`;
  doc += `\`\`\`\n\n`;

  doc += `### Run Tests\n\n`;
  doc += `\`\`\`bash\n`;
  doc += `npm run test\n`;
  doc += `\`\`\`\n\n`;

  doc += `### Deploy to Sepolia\n\n`;
  doc += `\`\`\`bash\n`;
  doc += `npm run deploy:sepolia\n`;
  doc += `\`\`\`\n\n`;

  doc += `## Common Pitfalls\n\n`;
  doc += `### 1. Forgetting FHE.allowThis()\n\n`;
  doc += `Always grant contract permission before user permission:\n`;
  doc += `\`\`\`solidity\n`;
  doc += `FHE.allowThis(encryptedValue);        // Contract permission first\n`;
  doc += `FHE.allow(encryptedValue, msg.sender); // Then user permission\n`;
  doc += `\`\`\`\n\n`;

  doc += `### 2. Using Encrypted Values in View Functions\n\n`;
  doc += `View functions cannot work with encrypted values. They must return\n`;
  doc += `plaintext or handles only:\n`;
  doc += `\`\`\`solidity\n`;
  doc += `// ❌ WRONG - view function with encryption\n`;
  doc += `function getValue() external view returns (euint32) { ... }\n\n`;
  doc += `// ✅ CORRECT - view function returns handles\n`;
  doc += `function getValue() external view returns (string memory) { ... }\n`;
  doc += `\`\`\`\n\n`;

  doc += `### 3. Mismatched Encryption Signers\n\n`;
  doc += `Ensure the encryption signer matches the caller:\n`;
  doc += `\`\`\`typescript\n`;
  doc += `// Encrypt with user's address\n`;
  doc += `const enc = await fhevm.createEncryptedInput(contract.address, userAddress);\n`;
  doc += `// Call with same user\n`;
  doc += `await contract.connect(user).process(enc.handles[0], enc.inputProof);\n`;
  doc += `\`\`\`\n\n`;

  doc += `## Resources\n\n`;
  doc += `- [FHEVM Documentation](https://docs.zama.ai/fhevm)\n`;
  doc += `- [Zama GitHub](https://github.com/zama-ai)\n`;
  doc += `- [FHEVM Hardhat Template](https://github.com/zama-ai/fhevm-hardhat-template)\n`;
  doc += `- [Zama Community](https://www.zama.ai/community)\n\n`;

  doc += `## License\n\n`;
  doc += `BSD-3-Clause-Clear\n\n`;

  doc += `---\n\n`;
  doc += `Built with FHEVM by Zama\n`;

  return doc;
}

function generateSummary(
  examples: string[],
  outputDir: string
): void {
  let summary = `# FHEVM Examples Documentation\n\n`;
  summary += `## Table of Contents\n\n`;

  examples.forEach((exampleName) => {
    const config = EXAMPLES_CONFIG[exampleName];
    if (config) {
      const docPath = config.output.replace("docs/", "").replace(".md", "");
      summary += `- [${config.title}](${docPath}.md)\n`;
    }
  });

  summary += `\n## Overview\n\n`;
  summary += `This documentation provides comprehensive guides for FHEVM examples, covering:\n\n`;
  summary += `- FHE (Fully Homomorphic Encryption) concepts\n`;
  summary += `- FHEVM integration patterns\n`;
  summary += `- Practical smart contract examples\n`;
  summary += `- Test implementations\n`;
  summary += `- Common pitfalls and best practices\n`;

  fs.writeFileSync(
    path.join(outputDir, "SUMMARY.md"),
    summary
  );
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    log("Available examples:", Color.Cyan);
    Object.keys(EXAMPLES_CONFIG).forEach((name) => {
      log(`  - ${name}`);
    });
    error("Please specify an example name or use --all");
  }

  const exampleName = args[0];
  const outputDir = "docs";

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  if (exampleName === "--all") {
    info("Generating documentation for all examples...");

    Object.entries(EXAMPLES_CONFIG).forEach(([name, config]) => {
      info(`Generating ${name}...`);
      const doc = generateDocumentation(name, config);
      fs.writeFileSync(path.join(outputDir, config.output), doc);
      success(`Generated ${config.output}`);
    });

    generateSummary(Object.keys(EXAMPLES_CONFIG), outputDir);
  } else {
    if (!EXAMPLES_CONFIG[exampleName]) {
      error(`Unknown example: ${exampleName}`);
    }

    const config = EXAMPLES_CONFIG[exampleName];
    info(`Generating documentation for ${exampleName}...`);

    const doc = generateDocumentation(exampleName, config);
    fs.writeFileSync(path.join(outputDir, config.output), doc);

    success(`Documentation generated: ${path.join(outputDir, config.output)}`);
  }

  log("\nDocumentation generation completed!", Color.Green);
}

main();
