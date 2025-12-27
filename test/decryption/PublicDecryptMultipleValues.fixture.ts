import { ethers } from "hardhat";
import { PublicDecryptMultipleValues } from "../../types";

export async function deployPublicDecryptMultipleValuesFixture(): Promise<PublicDecryptMultipleValues> {
  const publicDecryptFactory = await ethers.getContractFactory("PublicDecryptMultipleValues");
  const publicDecrypt = await publicDecryptFactory.deploy();
  await publicDecrypt.waitForDeployment();

  return publicDecrypt as PublicDecryptMultipleValues;
}
