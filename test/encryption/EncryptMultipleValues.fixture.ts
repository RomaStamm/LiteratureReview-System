import { ethers } from "hardhat";
import { EncryptMultipleValues } from "../../types";

export async function deployEncryptMultipleValuesFixture(): Promise<EncryptMultipleValues> {
  const encryptMultipleFactory = await ethers.getContractFactory("EncryptMultipleValues");
  const encryptMultiple = await encryptMultipleFactory.deploy();
  await encryptMultiple.waitForDeployment();

  return encryptMultiple as EncryptMultipleValues;
}
