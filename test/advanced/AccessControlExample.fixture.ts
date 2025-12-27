import { ethers } from "hardhat";
import { AccessControlExample } from "../../types";

export async function deployAccessControlExampleFixture(): Promise<AccessControlExample> {
  const accessControlFactory = await ethers.getContractFactory("AccessControlExample");
  const accessControl = await accessControlFactory.deploy();
  await accessControl.waitForDeployment();

  return accessControl as AccessControlExample;
}
