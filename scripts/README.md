# FHEVM Automation Scripts

This directory contains TypeScript-based CLI tools for automating FHEVM example repository generation, documentation creation, and development workflows.

## Scripts Overview

### 1. create-fhevm-example.ts

Generates complete standalone FHEVM example repositories with all necessary configuration and supporting files.

**Usage:**
```bash
ts-node scripts/create-fhevm-example.ts <example-name> [output-dir]
npm run create-example <example-name> [output-dir]
```

**Available Examples:**
- `literature-review` - Confidential literature awards platform using FHE

**Example:**
```bash
# Using npm script
npm run create-example literature-review ./my-literature-review

# Or directly with ts-node
ts-node scripts/create-fhevm-example.ts literature-review ../output/my-example

# Navigate to generated repository
cd my-literature-review
npm install
npm run compile
npm run test
```

**Generated Output Structure:**
```
my-literature-review/
├── contracts/
│   └── LiteratureReviewSystem.sol
├── test/
│   └── LiteratureReviewSystem.ts
├── hardhat.config.ts
├── package.json
├── tsconfig.json
├── README.md
└── .gitignore
```

**What It Does:**
1. Creates output directory structure
2. Copies contract source file
3. Copies test file
4. Generates hardhat.config.ts
5. Generates tsconfig.json
6. Generates package.json with dependencies
7. Generates comprehensive README
8. Creates .gitignore

**Output Files:**

- **hardhat.config.ts** - Configured for FHEVM with:
  - Hardhat network setup
  - Sepolia testnet configuration
  - TypeChain integration
  - Solidity 0.8.27 compiler

- **package.json** - Includes:
  - @fhevm/solidity ^0.9.1
  - @fhevm/hardhat-plugin ^0.3.0-1
  - All dev dependencies
  - Useful npm scripts

- **tsconfig.json** - TypeScript configuration:
  - ES2022 target
  - CommonJS modules
  - Strict type checking
  - Proper source mapping

- **README.md** - Generated documentation:
  - Quick start guide
  - Project structure explanation
  - Key concepts
  - Dependencies
  - Resources and links

**Exit Codes:**
- `0` - Success
- `1` - Error (example not found, missing files, permissions, etc.)

### 2. generate-docs.ts

Generates GitBook-compatible markdown documentation from contract and test files.

**Usage:**
```bash
ts-node scripts/generate-docs.ts <example-name> [options]
npm run generate-docs <example-name> [options]
npm run generate-docs --all
```

**Options:**
- `<example-name>` - Name of example to document
- `--all` - Generate documentation for all examples
- `--output <dir>` - Output directory (default: docs/)

**Examples:**
```bash
# Generate documentation for specific example
npm run generate-docs literature-review

# Generate for all examples
npm run generate-docs --all

# Or directly
ts-node scripts/generate-docs.ts --all
```

**Generated Output:**

Creates `.md` files in the `docs/` directory:

```
docs/
├── literature-review.md    # Complete example documentation
└── SUMMARY.md              # Documentation index
```

**Documentation Contents:**

Each generated `.md` file includes:

1. **Overview** - What the example demonstrates
2. **Key Concepts** - FHE and FHEVM fundamentals
3. **Smart Contract Section** - Architecture breakdown
4. **Test Examples** - Test file contents
5. **Critical FHE Patterns**
   - ✅ Correct permission granting
   - ❌ Common mistakes
6. **Common Pitfalls** - Detailed explanations and solutions
7. **Running the Example** - Installation and testing steps
8. **API Reference** - Function descriptions
9. **Resources** - Links to documentation

**Features:**
- Extracts code directly from contracts and tests
- Includes both passing (✅) and failing (❌) test examples
- Explains critical FHE patterns with examples
- Documents common pitfalls with solutions
- Generates SUMMARY.md index automatically

### 3. Configuration Files Created

When scripts run, they create standard configuration files:

**hardhat.config.ts**
- FHEVM hardhat plugin integration
- Hardhat and Sepolia network configuration
- Etherscan verification setup
- TypeChain output configuration

**tsconfig.json**
- ES2022 target
- Strict mode enabled
- Module resolution configured
- Source maps enabled

**package.json**
- Node.js >= 20 requirement
- @fhevm dependencies
- All dev dependencies for development
- Useful npm scripts

## Script Examples

### Generate a Standalone Example

```bash
# Create the example
npm run create-example literature-review ../my-project

# Test the generated example
cd ../my-project
npm install
npm run compile
npm run test
```

### Generate Documentation

```bash
# Generate all documentation
npm run generate-docs --all

# Check generated docs
cat docs/literature-review.md
cat docs/SUMMARY.md
```

### Combined Workflow

```bash
# 1. Generate example
npm run create-example literature-review ./test-output/lit-review

# 2. Navigate to it
cd test-output/lit-review

# 3. Install dependencies
npm install

# 4. Compile contracts
npm run compile

# 5. Run tests
npm run test

# 6. Check coverage
npm run coverage
```

## Error Handling

### Common Issues and Solutions

**Issue: "Unknown example: xyz"**
```bash
# Solution: Check available examples
npm run create-example
# Lists all available examples
```

**Issue: "Contract file not found"**
```bash
# Solution: Ensure you're in project root directory
pwd
# Should show: .../literature-review-system-fhevm
```

**Issue: Permission denied on script files**
```bash
# Solution: Make scripts executable
chmod +x scripts/*.ts
# Then run with ts-node
ts-node scripts/create-fhevm-example.ts literature-review ./output
```

**Issue: TypeScript compilation errors**
```bash
# Solution: Update Node.js
node --version  # Should be >= 20

# If using nvm
nvm install 20
nvm use 20
```

## Development Tips

### Customizing Generated Examples

After generation, you can customize:

1. **Contract** - Modify `contracts/LiteratureReviewSystem.sol`
2. **Tests** - Update `test/LiteratureReviewSystem.ts`
3. **Config** - Adjust `hardhat.config.ts` as needed
4. **README** - Edit generated `README.md`

### Adding New Examples

To add a new example:

1. Create contract in `contracts/` directory
2. Create test in `test/` directory
3. Update EXAMPLES_MAP in `create-fhevm-example.ts`
4. Update EXAMPLES_CONFIG in `generate-docs.ts`
5. Test with both scripts

Example of adding to EXAMPLES_MAP:
```typescript
const EXAMPLES_MAP: Record<string, ExampleConfig> = {
  'literature-review': {
    contract: 'contracts/LiteratureReviewSystem.sol',
    test: 'test/LiteratureReviewSystem.ts',
    description: '...',
    category: 'Advanced',
  },
  'my-new-example': {  // Add new example
    contract: 'contracts/MyContract.sol',
    test: 'test/MyContract.ts',
    description: 'What this example demonstrates',
    category: 'Basic',
  },
};
```

### Debugging Scripts

Enable verbose output:
```bash
# Node debugger
node --inspect-brk scripts/create-fhevm-example.ts literature-review ./debug-output

# Or use ts-node with inspect
ts-node --inspect-brk scripts/create-fhevm-example.ts literature-review ./debug-output
```

## Script Dependencies

Scripts depend on:

- **fs** (Node.js built-in) - File system operations
- **path** (Node.js built-in) - Path utilities
- **child_process** (Node.js built-in) - Execute external commands

All dependencies are available in Node.js by default.

## Output Verification

After running scripts, verify the output:

```bash
# Check generated structure
tree -L 2 my-example/

# Verify compilation
cd my-example
npm run compile

# Verify tests
npm run test

# Check code quality
npm run lint
npm run prettier:check
```

## Maintenance

### Updating Scripts

When updating scripts:

1. Update version in script header comments
2. Test both positive and negative cases
3. Test with real examples
4. Update this documentation
5. Generate fresh examples to verify

### Testing Changes

```bash
# Test creating an example
npm run create-example literature-review ./test-gen

# Test compilation
cd test-gen && npm install && npm run compile

# Test execution
npm run test

# Verify documentation
npm run generate-docs literature-review

# Check generated docs
cat ../docs/literature-review.md
```

## Tips and Best Practices

1. **Always test generated examples** - Run compile and test before deployment
2. **Keep scripts in sync** - Both create and generate scripts need matching example names
3. **Document examples well** - Good comments help with auto-documentation
4. **Use consistent naming** - Use kebab-case for example names (e.g., `my-example`)
5. **Version control generated files** - Commit generated examples for reproducibility

## Troubleshooting

### Script Won't Run

```bash
# Check Node.js version
node --version  # Requires >= 20

# Check ts-node installation
npm install -D ts-node

# Try running with explicit path
npx ts-node scripts/create-fhevm-example.ts literature-review ./output
```

### Generated Files Have Issues

```bash
# Verify source files exist
ls -la contracts/
ls -la test/

# Check file permissions
chmod 644 contracts/*.sol
chmod 644 test/*.ts

# Regenerate with verbose error output
npm run create-example literature-review ./output 2>&1 | tee create.log
```

### Documentation Generation Issues

```bash
# Verify docs directory
mkdir -p docs/

# Check input files
head contracts/LiteratureReviewSystem.sol
head test/LiteratureReviewSystem.ts

# Generate with error catching
npm run generate-docs --all 2>&1 | tee docs-gen.log
```

## Performance Considerations

- **File I/O** - Scripts copy files, optimized for typical project sizes
- **Memory** - Scripts load files into memory, suitable for normal contracts
- **Disk Space** - Generated examples include full node_modules dependency structures

## Security Notes

- Scripts do not execute arbitrary code
- Only copy and generate files
- No external API calls or downloads
- All file operations are local

## Future Enhancements

Potential improvements:

1. Support for monorepo generation
2. Custom template variables
3. Automated linting of generated examples
4. Integration with GitHub API for auto-publishing
5. Category-based batch generation
6. Interactive CLI menu system

## Support

For issues or questions:

1. Check example files are present
2. Verify Node.js version >= 20
3. Check file permissions
4. Review error messages carefully
5. Try regenerating with explicit paths
6. Check the Zama documentation

---

**Built for FHEVM Example Hub | Zama**
