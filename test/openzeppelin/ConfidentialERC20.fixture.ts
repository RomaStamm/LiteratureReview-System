import { ethers } from "hardhat";
import { ConfidentialERC20 } from "../../types";

export async function deployConfidentialERC20Fixture(): Promise<ConfidentialERC20> {
  const tokenFactory = await ethers.getContractFactory("ConfidentialERC20");
  const token = await tokenFactory.deploy("Confidential Token", "CT", 1000000);
  await token.waitForDeployment();

  return token as ConfidentialERC20;
}
