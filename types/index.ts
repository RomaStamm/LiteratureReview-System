import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

export interface Signers {
  [key: number]: SignerWithAddress;
}

// Re-export typechain types when they're generated
export * from "./typechain-types";
