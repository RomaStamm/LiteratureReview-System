import { ethers } from "hardhat";
import { BlindAuction } from "../../types";

export async function deployBlindAuctionFixture(): Promise<BlindAuction> {
  const blindAuctionFactory = await ethers.getContractFactory("BlindAuction");
  const blindAuction = await blindAuctionFactory.deploy();
  await blindAuction.waitForDeployment();

  return blindAuction as BlindAuction;
}
