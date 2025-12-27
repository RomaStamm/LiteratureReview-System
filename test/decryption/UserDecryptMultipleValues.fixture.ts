import { ethers } from "hardhat";
import { UserDecryptMultipleValues } from "../../types";

export async function deployUserDecryptMultipleValuesFixture(): Promise<UserDecryptMultipleValues> {
  const userDecryptFactory = await ethers.getContractFactory("UserDecryptMultipleValues");
  const userDecrypt = await userDecryptFactory.deploy();
  await userDecrypt.waitForDeployment();

  return userDecrypt as UserDecryptMultipleValues;
}
