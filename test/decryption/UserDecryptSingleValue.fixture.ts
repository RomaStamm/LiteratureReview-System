import { ethers } from "hardhat";
import { UserDecryptSingleValue } from "../../types";

export async function deployUserDecryptSingleValueFixture(): Promise<UserDecryptSingleValue> {
  const userDecryptFactory = await ethers.getContractFactory("UserDecryptSingleValue");
  const userDecrypt = await userDecryptFactory.deploy();
  await userDecrypt.waitForDeployment();

  return userDecrypt as UserDecryptSingleValue;
}
