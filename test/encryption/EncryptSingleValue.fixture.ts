import { ethers } from "hardhat";
import { EncryptSingleValue } from "../../types";

export async function deployEncryptSingleValueFixture(): Promise<EncryptSingleValue> {
  const encryptSingleFactory = await ethers.getContractFactory("EncryptSingleValue");
  const encryptSingle = await encryptSingleFactory.deploy();
  await encryptSingle.waitForDeployment();

  return encryptSingle as EncryptSingleValue;
}
