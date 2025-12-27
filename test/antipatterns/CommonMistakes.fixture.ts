import { ethers } from "hardhat";
import { CommonMistakes } from "../../types";

export async function deployCommonMistakesFixture(): Promise<CommonMistakes> {
  const commonMistakesFactory = await ethers.getContractFactory("CommonMistakes");
  const commonMistakes = await commonMistakesFactory.deploy();
  await commonMistakes.waitForDeployment();

  return commonMistakes as CommonMistakes;
}
