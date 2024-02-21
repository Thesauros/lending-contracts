import { ethers } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  MockERC20__factory,
  MockERC20,
  VaultRebalancer__factory,
  VaultRebalancer,
  MockProviderA__factory,
  MockProviderA,
} from "../../typechain-types";

describe("VaultPausable", async () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;

  let initAmount: bigint;
  let withdrawFeePercent: bigint;
  let assetDecimals: bigint;

  let userDepositLimit: bigint;
  let vaultDepositLimit: bigint;

  let mainAsset: MockERC20; // testUSDC
  let providerA: MockProviderA;
  let vaultRebalancer: VaultRebalancer;

  before(async () => {
    [deployer, alice] = await ethers.getSigners();

    initAmount = ethers.parseUnits("1", 10);
    withdrawFeePercent = ethers.parseEther("0.1"); // 10%

    userDepositLimit = ethers.parseUnits("1000", 6);
    vaultDepositLimit = ethers.parseUnits("3000", 6) + initAmount;

    assetDecimals = 6n;
  });

  beforeEach(async () => {
    mainAsset = await new MockERC20__factory(deployer).deploy(
      "testUSDC",
      "tUSDC",
      assetDecimals
    );

    await mainAsset.mint(deployer.address, initAmount);

    providerA = await new MockProviderA__factory(deployer).deploy();

    // Rebalancer and Treasury is the deployer for testing purposes
    vaultRebalancer = await new VaultRebalancer__factory(deployer).deploy(
      await mainAsset.getAddress(),
      deployer.address,
      "Glia tUSDC",
      "gtUSDC",
      [await providerA.getAddress()],
      userDepositLimit,
      vaultDepositLimit,
      withdrawFeePercent,
      deployer.address
    );
    await mainAsset.approve(await vaultRebalancer.getAddress(), initAmount);
    await vaultRebalancer.initializeVaultShares(initAmount);
  });

  describe("pause", async () => {
    it("Should revert when caller is invalid", async () => {
      await expect(
        vaultRebalancer.connect(alice).pause(0)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        "GliaAccessControl__CallerIsNotAdmin"
      );
    });
    it("Should revert when action is already paused", async () => {
      await vaultRebalancer.pause(0);
      await expect(vaultRebalancer.pause(0)).to.be.revertedWithCustomError(
        vaultRebalancer,
        "VaultPausable__ActionPaused"
      );
    });
    it("Should pause actions", async () => {
      // 0. Deposit
      // 1. Withdraw
      let tx0 = await vaultRebalancer.pause(0);
      let tx1 = await vaultRebalancer.pause(1);

      expect(await vaultRebalancer.paused(0)).to.be.true;
      expect(await vaultRebalancer.paused(1)).to.be.true;

      await expect(tx0)
        .to.emit(vaultRebalancer, "Paused")
        .withArgs(deployer.address, 0);
      await expect(tx1)
        .to.emit(vaultRebalancer, "Paused")
        .withArgs(deployer.address, 1);
    });
  });

  describe("unpause", async () => {
    it("Should revert when caller is invalid", async () => {
      await expect(
        vaultRebalancer.connect(alice).unpause(0)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        "GliaAccessControl__CallerIsNotAdmin"
      );
    });
    it("Should revert when action is not paused", async () => {
      await expect(vaultRebalancer.unpause(0)).to.be.revertedWithCustomError(
        vaultRebalancer,
        "VaultPausable__ActionNotPaused"
      );
    });
    it("Should unpause actions", async () => {
      // 0. Deposit
      // 1. Withdraw
      await vaultRebalancer.pause(0);
      await vaultRebalancer.pause(1);

      let tx0 = await vaultRebalancer.unpause(0);
      let tx1 = await vaultRebalancer.unpause(1);

      expect(await vaultRebalancer.paused(0)).to.be.false;
      expect(await vaultRebalancer.paused(1)).to.be.false;

      await expect(tx0)
        .to.emit(vaultRebalancer, "Unpaused")
        .withArgs(deployer.address, 0);
      await expect(tx1)
        .to.emit(vaultRebalancer, "Unpaused")
        .withArgs(deployer.address, 1);
    });
  });

  describe("pauseForceAll", async () => {
    it("Should revert when caller is invalid", async () => {
      await expect(
        vaultRebalancer.connect(alice).pauseForceAll()
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        "GliaAccessControl__CallerIsNotAdmin"
      );
    });
    it("Should pause actions", async () => {
      // 0. Deposit
      // 1. Withdraw
      let tx = await vaultRebalancer.pauseForceAll();

      expect(await vaultRebalancer.paused(0)).to.be.true;
      expect(await vaultRebalancer.paused(1)).to.be.true;

      await expect(tx)
        .to.emit(vaultRebalancer, "PausedForceAll")
        .withArgs(deployer.address);
    });
  });

  describe("unpauseForceAll", async () => {
    it("Should revert when caller is invalid", async () => {
      await expect(
        vaultRebalancer.connect(alice).unpauseForceAll()
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        "GliaAccessControl__CallerIsNotAdmin"
      );
    });
    it("Should unpause actions", async () => {
      // 0. Deposit
      // 1. Withdraw
      await vaultRebalancer.pauseForceAll();
      let tx = await vaultRebalancer.unpauseForceAll();

      expect(await vaultRebalancer.paused(0)).to.be.false;
      expect(await vaultRebalancer.paused(1)).to.be.false;

      await expect(tx)
        .to.emit(vaultRebalancer, "UnpausedForceAll")
        .withArgs(deployer.address);
    });
  });
});
