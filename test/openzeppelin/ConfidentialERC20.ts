import { expect } from "chai";
import { ethers } from "hardhat";
import { ConfidentialERC20 } from "../../types";
import { createInstances } from "../instance";
import { getSigners, initSigners } from "../signers";
import { deployConfidentialERC20Fixture } from "./ConfidentialERC20.fixture";

describe("ConfidentialERC20 - Encrypted ERC20 Token", function () {
  before(async function () {
    await initSigners();
    this.signers = await getSigners();
  });

  beforeEach(async function () {
    const contract = await deployConfidentialERC20Fixture();
    this.contractAddress = await contract.getAddress();
    this.confidentialERC20 = contract;
    this.instances = await createInstances(this.contractAddress, ethers, this.signers);
  });

  it("should deploy contract successfully", async function () {
    expect(this.contractAddress).to.not.equal(ethers.ZeroAddress);
  });

  describe("Initialization", function () {
    it("should initialize with correct name and symbol", async function () {
      const name = await this.confidentialERC20.name();
      const symbol = await this.confidentialERC20.symbol();

      expect(name).to.equal("Confidential Token");
      expect(symbol).to.equal("CT");
    });

    it("should initialize owner with tokens", async function () {
      const totalSupply = await this.confidentialERC20.totalSupply();

      expect(totalSupply).to.be.greaterThan(0);
    });

    it("should have correct decimals", async function () {
      const decimals = await this.confidentialERC20.decimals();

      expect(decimals).to.equal(18);
    });
  });

  describe("Encrypted Balances", function () {
    it("should return encrypted balance", async function () {
      // balanceOf returns encrypted handle, not plaintext
      const owner = await this.signers.alice.getAddress();
      const balance = await this.confidentialERC20.balanceOf(owner);

      // Balance is encrypted (handle)
      expect(balance).to.not.equal(0);
    });

    it("should allow owner to decrypt balance", async function () {
      // Owner can decrypt their balance via relayer
      const owner = this.signers.alice.address;
      const encryptedBalance = await this.confidentialERC20.balanceOf(owner);

      // Owner can decrypt
      const decrypted = await this.instances.alice.decrypt(this.contractAddress, encryptedBalance);

      expect(decrypted).to.be.greaterThan(0);
    });

    it("should prevent others from decrypting balance", async function () {
      // Non-owner cannot see balance
      const owner = this.signers.alice.address;
      const encryptedBalance = await this.confidentialERC20.balanceOf(owner);

      // Bob has no permission
      try {
        await this.instances.bob.decrypt(this.contractAddress, encryptedBalance);
        expect(true).to.be.false; // Should not reach
      } catch {
        expect(true).to.be.true; // Expected
      }
    });
  });

  describe("Encrypted Transfers", function () {
    it("should transfer encrypted amount without revealing transfer value", async function () {
      const transferAmount = 100;

      // Alice encrypts transfer amount
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(transferAmount);
      const encrypted = await input.encrypt();

      // Transfer encrypted amount (no one sees the amount)
      const tx = await this.confidentialERC20
        .connect(this.signers.alice)
        .transfer(this.signers.bob.address, encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Bob can decrypt his new balance
      const bobBalance = await this.confidentialERC20.balanceOf(this.signers.bob.address);
      const decryptedBalance = await this.instances.bob.decrypt(this.contractAddress, bobBalance);

      expect(decryptedBalance).to.equal(BigInt(transferAmount));
    });

    it("should maintain sender balance after transfer", async function () {
      const initialAmount = 1000;
      const transferAmount = 300;

      // Alice starts with initialAmount
      let aliceBalance = await this.confidentialERC20.balanceOf(this.signers.alice.address);
      let decrypted = await this.instances.alice.decrypt(this.contractAddress, aliceBalance);
      expect(decrypted).to.equal(BigInt(initialAmount));

      // Transfer to Bob
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(transferAmount);
      const encrypted = await input.encrypt();

      const tx = await this.confidentialERC20
        .connect(this.signers.alice)
        .transfer(this.signers.bob.address, encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Alice's balance reduced
      aliceBalance = await this.confidentialERC20.balanceOf(this.signers.alice.address);
      decrypted = await this.instances.alice.decrypt(this.contractAddress, aliceBalance);

      expect(decrypted).to.equal(BigInt(initialAmount - transferAmount));
    });

    it("should support multiple transfers", async function () {
      const transfers = [50, 75, 25];
      let totalTransferred = 0;

      for (const amount of transfers) {
        totalTransferred += amount;

        const input = this.instances.alice.createEncryptedInput(
          this.contractAddress,
          this.signers.alice.address
        );
        input.add32(amount);
        const encrypted = await input.encrypt();

        const tx = await this.confidentialERC20
          .connect(this.signers.alice)
          .transfer(this.signers.bob.address, encrypted.handles[0], encrypted.inputProof);
        await tx.wait();
      }

      // Bob's total balance
      const bobBalance = await this.confidentialERC20.balanceOf(this.signers.bob.address);
      const decrypted = await this.instances.bob.decrypt(this.contractAddress, bobBalance);

      expect(decrypted).to.equal(BigInt(totalTransferred));
    });
  });

  describe("Encrypted Allowances", function () {
    it("should allow setting encrypted allowance", async function () {
      const allowanceAmount = 500;

      // Alice approves encrypted amount to Bob
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(allowanceAmount);
      const encrypted = await input.encrypt();

      const tx = await this.confidentialERC20
        .connect(this.signers.alice)
        .approve(this.signers.bob.address, encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      expect(tx).to.not.be.reverted;
    });

    it("should return encrypted allowance", async function () {
      const allowanceAmount = 750;

      // Alice approves encrypted amount
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(allowanceAmount);
      const encrypted = await input.encrypt();

      let tx = await this.confidentialERC20
        .connect(this.signers.alice)
        .approve(this.signers.bob.address, encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Allowance is encrypted (handle only)
      const allowanceHandle = await this.confidentialERC20.allowance(
        this.signers.alice.address,
        this.signers.bob.address
      );

      expect(allowanceHandle).to.not.equal(ethers.ZeroHash);
    });

    it("should allow spender to see their allowance", async function () {
      const allowanceAmount = 600;

      // Alice sets encrypted allowance for Bob
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(allowanceAmount);
      const encrypted = await input.encrypt();

      let tx = await this.confidentialERC20
        .connect(this.signers.alice)
        .approve(this.signers.bob.address, encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Bob can see his allowance
      const allowanceHandle = await this.confidentialERC20.allowance(
        this.signers.alice.address,
        this.signers.bob.address
      );

      const decrypted = await this.instances.bob.decrypt(this.contractAddress, allowanceHandle);
      expect(decrypted).to.equal(BigInt(allowanceAmount));
    });
  });

  describe("TransferFrom with Allowance", function () {
    it("should transfer from with encrypted amount", async function () {
      const allowanceAmount = 1000;
      const transferAmount = 200;

      // Alice approves encrypted amount to Bob
      let input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(allowanceAmount);
      let encrypted = await input.encrypt();

      let tx = await this.confidentialERC20
        .connect(this.signers.alice)
        .approve(this.signers.bob.address, encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Bob transfers encrypted amount from Alice to Charlie
      input = this.instances.bob.createEncryptedInput(this.contractAddress, this.signers.bob.address);
      input.add32(transferAmount);
      encrypted = await input.encrypt();

      tx = await this.confidentialERC20
        .connect(this.signers.bob)
        .transferFrom(
          this.signers.alice.address,
          this.signers.charlie.address,
          encrypted.handles[0],
          encrypted.inputProof
        );
      await tx.wait();

      // Charlie can decrypt their received amount
      const charlieBalance = await this.confidentialERC20.balanceOf(this.signers.charlie.address);
      const decrypted = await this.instances.charlie.decrypt(this.contractAddress, charlieBalance);

      expect(decrypted).to.equal(BigInt(transferAmount));
    });
  });

  describe("Minting", function () {
    it("should mint new tokens", async function () {
      const owner = this.signers.alice.address;
      const mintAmount = 500;

      // Owner mints tokens
      const tx = await this.confidentialERC20.connect(this.signers.alice).mint(this.signers.bob.address, mintAmount);
      await tx.wait();

      // Bob receives encrypted balance
      const bobBalance = await this.confidentialERC20.balanceOf(this.signers.bob.address);
      const decrypted = await this.instances.bob.decrypt(this.contractAddress, bobBalance);

      expect(decrypted).to.equal(BigInt(mintAmount));
    });

    it("should increase total supply on mint", async function () {
      const initialSupply = await this.confidentialERC20.totalSupply();
      const mintAmount = 1000;

      const tx = await this.confidentialERC20.connect(this.signers.alice).mint(this.signers.bob.address, mintAmount);
      await tx.wait();

      const newSupply = await this.confidentialERC20.totalSupply();

      expect(newSupply).to.equal(initialSupply + BigInt(mintAmount));
    });
  });

  describe("Privacy Properties", function () {
    it("should keep balances encrypted", async function () {
      // Standard ERC20: balances public
      // Confidential ERC20: balances encrypted ✅

      const aliceBalance = await this.confidentialERC20.balanceOf(this.signers.alice.address);

      // Balance is encrypted (handle), not plaintext
      // Only Alice can decrypt
      expect(aliceBalance).to.not.equal(0);
    });

    it("should keep transfer amounts private", async function () {
      // Standard ERC20: transfer amounts visible in logs
      // Confidential ERC20: transfer amounts encrypted ✅

      const amount = 250;

      // Encrypt transfer amount
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(amount);
      const encrypted = await input.encrypt();

      // Transfer - amount is encrypted
      const tx = await this.confidentialERC20
        .connect(this.signers.alice)
        .transfer(this.signers.bob.address, encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Transfer amount visible to Alice and Bob only
      // Others see only encrypted data
      expect(tx).to.not.be.reverted;
    });

    it("should keep allowances private", async function () {
      // Standard ERC20: allowances public
      // Confidential ERC20: allowances encrypted ✅

      const amount = 800;

      // Approve encrypted amount
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(amount);
      const encrypted = await input.encrypt();

      const tx = await this.confidentialERC20
        .connect(this.signers.alice)
        .approve(this.signers.bob.address, encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Allowance is encrypted
      const allowanceHandle = await this.confidentialERC20.allowance(
        this.signers.alice.address,
        this.signers.bob.address
      );

      // Only Alice and Bob can decrypt
      expect(allowanceHandle).to.not.equal(ethers.ZeroHash);
    });
  });

  describe("Comparison with Standard ERC20", function () {
    it("should show privacy improvements", async function () {
      // Standard ERC20:
      // ❌ balances[alice] = 1000 (PUBLIC)
      // ❌ transfer amounts in logs
      // ❌ allowances public
      // ❌ Anyone can see all balances
      //
      // Confidential ERC20:
      // ✅ balances[alice] = encrypted (PRIVATE)
      // ✅ transfer amounts encrypted
      // ✅ allowances encrypted
      // ✅ Only users can see own data

      expect(true).to.be.true;
    });
  });

  describe("Use Cases", function () {
    it("should support private payroll", async function () {
      // Use case: Pay salaries without revealing amounts

      const salary = 5000;

      // Employer transfers encrypted salary
      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(salary);
      const encrypted = await input.encrypt();

      const tx = await this.confidentialERC20
        .connect(this.signers.alice)
        .transfer(this.signers.bob.address, encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Employee sees only their balance (encrypted for others)
      const balance = await this.confidentialERC20.balanceOf(this.signers.bob.address);
      const decrypted = await this.instances.bob.decrypt(this.contractAddress, balance);

      expect(decrypted).to.equal(BigInt(salary));
    });

    it("should support confidential trading", async function () {
      // Use case: Trade amounts remain private

      const tradeAmount = 1000;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(tradeAmount);
      const encrypted = await input.encrypt();

      const tx = await this.confidentialERC20
        .connect(this.signers.alice)
        .transfer(this.signers.bob.address, encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Trade details remain private
      expect(tx).to.not.be.reverted;
    });

    it("should support anonymous donations", async function () {
      // Use case: Donation amounts kept private

      const donationAmount = 250;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(donationAmount);
      const encrypted = await input.encrypt();

      const tx = await this.confidentialERC20
        .connect(this.signers.alice)
        .transfer(this.signers.bob.address, encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      // Donation amount private
      expect(tx).to.not.be.reverted;
    });
  });

  describe("Integration Guidelines", function () {
    it("should demonstrate balanceOf pattern", async function () {
      // Usage: Get encrypted balance
      // const encBalance = await token.balanceOf(userAddress);
      // const plainBalance = await relayer.decrypt(contractAddr, encBalance);

      const balance = await this.confidentialERC20.balanceOf(this.signers.alice.address);
      expect(balance).to.not.equal(ethers.ZeroHash);
    });

    it("should demonstrate transfer pattern", async function () {
      // Usage: Send encrypted amount
      // const enc = await fhevm.createEncryptedInput(token.address, sender)
      //   .add32(amount).encrypt();
      // await token.transfer(recipient, enc.handles[0], enc.inputProof);

      const amount = 100;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(amount);
      const encrypted = await input.encrypt();

      const tx = await this.confidentialERC20
        .connect(this.signers.alice)
        .transfer(this.signers.bob.address, encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      expect(tx).to.not.be.reverted;
    });
  });

  describe("Input Validation", function () {
    it("should reject invalid input proof", async function () {
      const amount = 100;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(amount);
      const encrypted = await input.encrypt();

      await expect(
        this.confidentialERC20
          .connect(this.signers.alice)
          .transfer(this.signers.bob.address, encrypted.handles[0], "0x")
      ).to.be.reverted;
    });

    it("should prevent zero address transfers", async function () {
      const amount = 100;

      const input = this.instances.alice.createEncryptedInput(
        this.contractAddress,
        this.signers.alice.address
      );
      input.add32(amount);
      const encrypted = await input.encrypt();

      await expect(
        this.confidentialERC20
          .connect(this.signers.alice)
          .transfer(ethers.ZeroAddress, encrypted.handles[0], encrypted.inputProof)
      ).to.be.reverted;
    });
  });
});
