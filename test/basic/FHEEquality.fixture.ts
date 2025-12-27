import { ethers } from "hardhat";
import { FHEEquality } from "../../types";

export async function deployFHEEqualityFixture(): Promise<FHEEquality> {
  const fheEqualityFactory = await ethers.getContractFactory("FHEEquality");
  const fheEquality = await fheEqualityFactory.deploy();
  await fheEquality.waitForDeployment();

  return fheEquality as FHEEquality;
}
