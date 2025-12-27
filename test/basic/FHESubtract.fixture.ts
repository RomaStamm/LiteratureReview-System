import { ethers } from "hardhat";
import { FHESubtract } from "../../types";

export async function deployFHESubtractFixture(): Promise<FHESubtract> {
  const fheSubtractFactory = await ethers.getContractFactory("FHESubtract");
  const fheSubtract = await fheSubtractFactory.deploy();
  await fheSubtract.waitForDeployment();

  return fheSubtract as FHESubtract;
}
