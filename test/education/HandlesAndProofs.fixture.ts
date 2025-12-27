import { ethers } from "hardhat";
import { HandlesAndProofs } from "../../types";

export async function deployHandlesAndProofsFixture(): Promise<HandlesAndProofs> {
  const handlesAndProofsFactory = await ethers.getContractFactory("HandlesAndProofs");
  const handlesAndProofs = await handlesAndProofsFactory.deploy();
  await handlesAndProofs.waitForDeployment();

  return handlesAndProofs as HandlesAndProofs;
}
