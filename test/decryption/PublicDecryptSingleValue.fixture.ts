import { ethers } from "hardhat";
import { PublicDecryptSingleValue } from "../../types";

export async function deployPublicDecryptSingleValueFixture(): Promise<PublicDecryptSingleValue> {
  const publicDecryptFactory = await ethers.getContractFactory("PublicDecryptSingleValue");
  const publicDecrypt = await publicDecryptFactory.deploy();
  await publicDecrypt.waitForDeployment();

  return publicDecrypt as PublicDecryptSingleValue;
}
