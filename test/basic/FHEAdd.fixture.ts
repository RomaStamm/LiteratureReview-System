import { ethers } from "hardhat";
import { FHEAdd } from "../../types";

export async function deployFHEAddFixture(): Promise<FHEAdd> {
  const fheAddFactory = await ethers.getContractFactory("FHEAdd");
  const fheAdd = await fheAddFactory.deploy();
  await fheAdd.waitForDeployment();

  return fheAdd as FHEAdd;
}
