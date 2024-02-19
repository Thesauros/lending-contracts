import { ethers } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { network } from "hardhat";
import {
  MockERC20__factory,
  MockERC20,
  MockProviderA__factory,
  MockProviderA,
  MockProviderB__factory,
  MockProviderB,
  BaseMockProvider,
  BaseMockProvider__factory,
  VaultRebalancer__factory,
  VaultRebalancer,
} from "../../typechain-types";

describe("VaultRebalancer", async () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let charlie: SignerWithAddress;

  let PRECISION_CONSTANT: bigint;

  let initAmount: bigint;
  let minAmount: bigint;
  let depositAmount: bigint;
  let mintAmount: bigint;

  let withdrawFeePercent: bigint;

  let assetDecimals: bigint;

  let mainAsset: MockERC20; // testUSDC

  let providerA: MockProviderA;
  let providerB: MockProviderB;
  let invalidProvider: BaseMockProvider;

  let vaultRebalancer: VaultRebalancer;

  let DEFAULT_ADMIN_ROLE: string;
  let REBALANCER_ROLE: string;

  before(async () => {
    [deployer, alice, bob, charlie] = await ethers.getSigners();

    PRECISION_CONSTANT = ethers.parseEther("1");

    initAmount = ethers.parseUnits("1", 6);
    minAmount = ethers.parseUnits("1", 6);
    depositAmount = ethers.parseUnits("1000", 6);
    mintAmount = ethers.parseUnits("100000", 6);

    withdrawFeePercent = ethers.parseEther("0.1"); // 10%

    assetDecimals = 6n;
  });

  beforeEach(async () => {
    mainAsset = await new MockERC20__factory(deployer).deploy(
      "testUSDC",
      "tUSDC",
      assetDecimals
    );

    await mainAsset.mint(deployer.address, mintAmount);
    await mainAsset.mint(alice.address, mintAmount);
    await mainAsset.mint(bob.address, mintAmount);
    await mainAsset.mint(charlie.address, mintAmount);

    providerA = await new MockProviderA__factory(deployer).deploy();

    // Rebalancer and Treasury is the deployer for testing purposes

    vaultRebalancer = await new VaultRebalancer__factory(deployer).deploy(
      await mainAsset.getAddress(),
      deployer.address,
      "Glia tUSDC",
      "gtUSDC",
      [await providerA.getAddress()],
      withdrawFeePercent,
      deployer.address
    );

    DEFAULT_ADMIN_ROLE = await vaultRebalancer.DEFAULT_ADMIN_ROLE();
    REBALANCER_ROLE = await vaultRebalancer.REBALANCER_ROLE();

    await mainAsset
      .connect(deployer)
      .approve(await vaultRebalancer.getAddress(), ethers.MaxUint256);
    await mainAsset
      .connect(alice)
      .approve(await vaultRebalancer.getAddress(), ethers.MaxUint256);
    await mainAsset
      .connect(bob)
      .approve(await vaultRebalancer.getAddress(), ethers.MaxUint256);
    await mainAsset
      .connect(charlie)
      .approve(await vaultRebalancer.getAddress(), ethers.MaxUint256);

    await vaultRebalancer.initializeVaultShares(initAmount);
  });

  describe("constructor", async () => {
    it("Should revert when main asset is invalid", async () => {
      await expect(
        new VaultRebalancer__factory(deployer).deploy(
          ethers.ZeroAddress,
          deployer.address,
          "Glia tUSDC",
          "gtUSDC",
          [await providerA.getAddress()],
          withdrawFeePercent,
          deployer.address
        )
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        "InterestVault__InvalidInput"
      );
    });
    it("Should revert when rebalanceProvider is invalid", async () => {
      await expect(
        new VaultRebalancer__factory(deployer).deploy(
          await mainAsset.getAddress(),
          ethers.ZeroAddress,
          "Glia tUSDC",
          "gtUSDC",
          [await providerA.getAddress()],
          withdrawFeePercent,
          deployer.address
        )
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        "InterestVault__InvalidInput"
      );
    });
    it("Should set correct values", async () => {
      expect(
        await vaultRebalancer.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)
      ).to.be.true;
      expect(await vaultRebalancer.hasRole(REBALANCER_ROLE, deployer.address))
        .to.be.true;
      expect(await vaultRebalancer.decimals()).to.equal(
        await mainAsset.decimals()
      );
      expect(await vaultRebalancer.asset()).to.equal(
        await mainAsset.getAddress()
      );
      expect(await vaultRebalancer.minAmount()).to.equal(minAmount);
      expect(await vaultRebalancer.name()).to.equal("Glia tUSDC");
      expect(await vaultRebalancer.symbol()).to.equal("gtUSDC");
      expect((await vaultRebalancer.getProviders())[0]).to.equal(
        await providerA.getAddress()
      );
      expect(await vaultRebalancer.activeProvider()).to.equal(
        await providerA.getAddress()
      );
      expect(await vaultRebalancer.withdrawFeePercent()).to.equal(
        withdrawFeePercent
      );
      expect(await vaultRebalancer.treasury()).to.be.equal(deployer.address);
    });
  });

  describe("initializeVaultShares", async () => {
    let anotherVaultRebalancer: VaultRebalancer;

    beforeEach(async () => {
      anotherVaultRebalancer = await new VaultRebalancer__factory(
        deployer
      ).deploy(
        await mainAsset.getAddress(),
        deployer.address,
        "Glia tUSDC",
        "gtUSDC",
        [await providerA.getAddress()],
        withdrawFeePercent,
        deployer.address
      );
      await mainAsset
        .connect(deployer)
        .approve(await anotherVaultRebalancer.getAddress(), ethers.MaxUint256);
    });
    it("Should revert when called more than once", async () => {
      await anotherVaultRebalancer.initializeVaultShares(initAmount);
      await expect(
        anotherVaultRebalancer.initializeVaultShares(initAmount)
      ).to.be.revertedWithCustomError(
        anotherVaultRebalancer,
        "InterestVault__VaultAlreadyInitialized"
      );
    });
    it("Should revert when initial shares are less than minAmount", async () => {
      await expect(
        anotherVaultRebalancer.initializeVaultShares(minAmount - 1n)
      ).to.be.revertedWithCustomError(
        anotherVaultRebalancer,
        "InterestVault__AmountLessThanMin"
      );
    });
    it("Should initialize the vault", async () => {
      let tx = await anotherVaultRebalancer.initializeVaultShares(initAmount);
      let balanceVault = await anotherVaultRebalancer.balanceOf(
        await anotherVaultRebalancer.getAddress()
      );
      expect(await anotherVaultRebalancer.totalAssets()).to.equal(initAmount);
      expect(balanceVault).to.equal(initAmount);
      // Should emit VaultInitialized event
      await expect(tx)
        .to.emit(anotherVaultRebalancer, "VaultInitialized")
        .withArgs(deployer.address);
    });
  });

  describe("deposit", async () => {
    it("Should revert when receiver is invalid", async () => {
      await expect(
        vaultRebalancer
          .connect(alice)
          .deposit(depositAmount, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        "InterestVault__InvalidInput"
      );
    });
    it("Should revert when deposit amount is invalid", async () => {
      await expect(
        vaultRebalancer.connect(alice).deposit(0, alice.address)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        "InterestVault__InvalidInput"
      );
    });
    it("Should revert when deposit amount is less than minAmount", async () => {
      await expect(
        vaultRebalancer.connect(alice).deposit(1, alice.address)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        "InterestVault__AmountLessThanMin"
      );
    });
    it("Should revert when the vault is paused", async () => {
      await vaultRebalancer.pause(0);
      await expect(
        vaultRebalancer.connect(alice).deposit(depositAmount, alice.address)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        "VaultPausable__ActionPaused"
      );
    });
    it("Should deposit assets", async () => {
      let previousBalance = await vaultRebalancer.balanceOf(alice.address);
      let tx = await vaultRebalancer
        .connect(alice)
        .deposit(depositAmount, alice.address);

      let mintedShares =
        (await vaultRebalancer.balanceOf(alice.address)) - previousBalance;
      let assetBalance = await vaultRebalancer.convertToAssets(mintedShares);
      expect(assetBalance).to.equal(depositAmount);
      expect(await vaultRebalancer.totalAssets()).to.equal(
        depositAmount + initAmount
      );
      // Should emit Deposit event
      await expect(tx)
        .to.emit(vaultRebalancer, "Deposit")
        .withArgs(alice.address, alice.address, depositAmount, mintedShares);
    });
  });

  describe("mint", async () => {
    it("Should mint shares", async () => {
      let assets = await vaultRebalancer.previewMint(depositAmount);

      let tx = await vaultRebalancer
        .connect(alice)
        .mint(depositAmount, alice.address);

      let pulledAssets = await vaultRebalancer
        .connect(alice)
        .mint.staticCall(depositAmount, alice.address);

      let mintedShares = await vaultRebalancer.balanceOf(alice.address);

      expect(depositAmount).to.equal(mintedShares);
      expect(pulledAssets).to.equal(assets);

      // Should emit Deposit event
      await expect(tx)
        .to.emit(vaultRebalancer, "Deposit")
        .withArgs(alice.address, alice.address, assets, depositAmount);
    });
  });

  describe("withdraw", async () => {
    it("Should revert when receiver is invalid", async () => {
      await expect(
        vaultRebalancer
          .connect(alice)
          .withdraw(depositAmount, ethers.ZeroAddress, alice.address)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        "InterestVault__InvalidInput"
      );
    });
    it("Should revert when owner is invalid", async () => {
      await expect(
        vaultRebalancer
          .connect(alice)
          .withdraw(depositAmount, alice.address, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        "InterestVault__InvalidInput"
      );
    });
    it("Should revert when amount to withdraw is invalid", async () => {
      await expect(
        vaultRebalancer.connect(alice).withdraw(0, alice.address, alice.address)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        "InterestVault__InvalidInput"
      );
    });
    it("Should revert when the vault is paused", async () => {
      await vaultRebalancer.pause(1);
      await vaultRebalancer
        .connect(alice)
        .deposit(depositAmount, alice.address);
      await expect(
        vaultRebalancer
          .connect(alice)
          .withdraw(depositAmount, alice.address, alice.address)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        "VaultPausable__ActionPaused"
      );
    });
    it("Should withdraw max possible when withdraw amount is more than available", async () => {
      let moreThanAvailable = depositAmount * 2n;
      await vaultRebalancer
        .connect(alice)
        .deposit(depositAmount, alice.address);

      let previousBalance = await mainAsset.balanceOf(alice.address);
      await vaultRebalancer
        .connect(alice)
        .withdraw(moreThanAvailable, alice.address, alice.address);

      let newBalance =
        previousBalance +
        depositAmount -
        (depositAmount * withdrawFeePercent) / PRECISION_CONSTANT;
      expect(await mainAsset.balanceOf(alice.address)).to.equal(newBalance);
      expect(await vaultRebalancer.balanceOf(alice.address)).to.equal(0);
    });
    it("Should withdraw assets", async () => {
      let shares = await vaultRebalancer.previewWithdraw(depositAmount);
      let feeAmount = (depositAmount * withdrawFeePercent) / PRECISION_CONSTANT;
      let withdrawAmount = depositAmount - feeAmount;

      await vaultRebalancer
        .connect(alice)
        .deposit(depositAmount, alice.address);
      let previousBalanceAlice = await mainAsset.balanceOf(alice.address);
      let previousBalanceTreasury = await mainAsset.balanceOf(deployer.address);

      let tx = await vaultRebalancer
        .connect(alice)
        .withdraw(depositAmount, alice.address, alice.address);

      expect(await mainAsset.balanceOf(alice.address)).to.equal(
        previousBalanceAlice + withdrawAmount
      );
      expect(await mainAsset.balanceOf(deployer.address)).to.equal(
        previousBalanceTreasury + feeAmount
      );
      expect(await vaultRebalancer.balanceOf(alice.address)).to.equal(0);
      expect(await vaultRebalancer.totalAssets()).to.equal(initAmount);

      // Should emit Withdraw event
      await expect(tx)
        .to.emit(vaultRebalancer, "Withdraw")
        .withArgs(
          alice.address,
          alice.address,
          alice.address,
          withdrawAmount,
          shares
        );
      // Should emit FeesCharged event
      await expect(tx)
        .to.emit(vaultRebalancer, "FeesCharged")
        .withArgs(deployer.address, feeAmount);
    });
  });

  describe("redeem", async () => {
    it("Should redeem max possible when redeem amount is more than available", async () => {
      let moreThanAvailable = depositAmount * 2n;

      await vaultRebalancer.connect(alice).mint(depositAmount, alice.address);

      let assets = await vaultRebalancer.previewRedeem(depositAmount);
      let previousBalance = await mainAsset.balanceOf(alice.address);

      let newBalance =
        previousBalance +
        assets -
        (assets * withdrawFeePercent) / PRECISION_CONSTANT;

      await vaultRebalancer
        .connect(alice)
        .redeem(moreThanAvailable, alice.address, alice.address);

      expect(await mainAsset.balanceOf(alice.address)).to.equal(newBalance);
      expect(await vaultRebalancer.balanceOf(alice.address)).to.equal(0);
    });
    it("Should redeem shares", async () => {
      await vaultRebalancer.connect(alice).mint(depositAmount, alice.address);

      let previousBalanceAlice = await mainAsset.balanceOf(alice.address);
      let previousBalanceTreasury = await mainAsset.balanceOf(deployer.address);
      let previousShares = await vaultRebalancer.balanceOf(alice.address);

      let assets = await vaultRebalancer.previewRedeem(depositAmount);
      let feeAmount = (assets * withdrawFeePercent) / PRECISION_CONSTANT;
      let withdrawAmount = assets - feeAmount;

      let tx = await vaultRebalancer
        .connect(alice)
        .redeem(depositAmount, alice.address, alice.address);

      expect(await mainAsset.balanceOf(alice.address)).to.equal(
        previousBalanceAlice + withdrawAmount
      );
      expect(await mainAsset.balanceOf(deployer.address)).to.equal(
        previousBalanceTreasury + feeAmount
      );
      expect(await vaultRebalancer.balanceOf(alice.address)).to.equal(
        previousShares - depositAmount
      );

      // Should emit Withdraw event
      await expect(tx)
        .to.emit(vaultRebalancer, "Withdraw")
        .withArgs(
          alice.address,
          alice.address,
          alice.address,
          withdrawAmount,
          depositAmount
        );
      // Should emit FeesCharged event
      await expect(tx)
        .to.emit(vaultRebalancer, "FeesCharged")
        .withArgs(deployer.address, feeAmount);
    });
  });

  // q: Do we need token transfer restrictions?? (maxRedeem)
  // describe("transfer", async () => {
  //   it("Should revert when amount is more than allowed", async () => {
  //     await depositAndBorrow(alice, depositAmount, borrowAmount);

  //     await expect(
  //       borrowingRefinancer.connect(alice).transfer(bob.address, depositAmount)
  //     ).to.be.revertedWithCustomError(
  //       borrowingRefinancer,
  //       "BorrowingRefinancer__beforeTokenTransfer_moreThanAllowed"
  //     );
  //     });
  //     it("Should transfer max allowed shares", async () => {
  //       await depositAndBorrow(alice, depositAmount, borrowAmount);

  //       let maxTransferable = await borrowingRefinancer.maxRedeem(alice.address);

  //       await borrowingRefinancer
  //         .connect(alice)
  //         .transfer(bob.address, maxTransferable);

  //       expect(await borrowingRefinancer.balanceOf(bob.address)).to.equal(
  //         maxTransferable
  //       );

  //       let nonTransferable = depositAmount - maxTransferable;

  //       await expect(
  //         borrowingRefinancer
  //           .connect(alice)
  //           .transfer(bob.address, nonTransferable)
  //       ).to.be.revertedWithCustomError(
  //         borrowingRefinancer,
  //         "BorrowingRefinancer__beforeTokenTransfer_moreThanAllowed"
  //       );

  //       // Bob's shares haven't changed.
  //       expect(await borrowingRefinancer.balanceOf(bob.address)).to.equal(
  //         maxTransferable
  //       );
  //     });
  //   });

  describe("rebalance", async () => {
    beforeEach(async () => {
      invalidProvider = await new BaseMockProvider__factory(deployer).deploy();
      providerB = await new MockProviderB__factory(deployer).deploy();
      await vaultRebalancer.setProviders([
        await providerA.getAddress(),
        await providerB.getAddress(),
      ]);

      await vaultRebalancer
        .connect(alice)
        .deposit(depositAmount, alice.address);
      await vaultRebalancer.connect(bob).deposit(depositAmount, bob.address);
      await vaultRebalancer
        .connect(charlie)
        .deposit(depositAmount, charlie.address);
    });
    it("Should revert when caller is invalid", async () => {
      await expect(
        vaultRebalancer
          .connect(alice)
          .rebalance(
            depositAmount,
            await providerA.getAddress(),
            await providerB.getAddress(),
            0,
            true
          )
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        "GliaAccessControl__CallerIsNotRebalancer"
      );
    });
    it("Should revert when provider from is invalid", async () => {
      await expect(
        vaultRebalancer.rebalance(
          depositAmount,
          await invalidProvider.getAddress(),
          await providerB.getAddress(),
          0,
          true
        )
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        "VaultRebalancer__InvalidProvider"
      );
    });
    it("Should revert when provider to is invalid", async () => {
      await expect(
        vaultRebalancer.rebalance(
          depositAmount,
          await providerA.getAddress(),
          await invalidProvider.getAddress(),
          0,
          true
        )
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        "VaultRebalancer__InvalidProvider"
      );
    });
    it("Should partially rebalance the vault", async () => {
      let assetsAliceAndBob = 2n * depositAmount;
      // q: do we need convertAssets here??
      let assetsCharlie =
        depositAmount + (await vaultRebalancer.convertToAssets(initAmount));

      await vaultRebalancer.rebalance(
        assetsAliceAndBob,
        await providerA.getAddress(),
        await providerB.getAddress(),
        0,
        false
      );

      expect(
        await providerA.getDepositBalance(
          await vaultRebalancer.getAddress(),
          await vaultRebalancer.getAddress()
        )
      ).to.equal(assetsCharlie);
      expect(
        await providerB.getDepositBalance(
          await vaultRebalancer.getAddress(),
          await vaultRebalancer.getAddress()
        )
      ).to.equal(assetsAliceAndBob);
      // Check the active provider
      expect(await vaultRebalancer.activeProvider()).to.equal(
        await providerA.getAddress()
      );
    });
    it("Should fully rebalance the vault", async () => {
      let assetsAll =
        3n * depositAmount +
        (await vaultRebalancer.convertToAssets(initAmount)); // alice, bob, charlie

      let tx = await vaultRebalancer.rebalance(
        assetsAll,
        await providerA.getAddress(),
        await providerB.getAddress(),
        0,
        true
      );

      expect(
        await providerA.getDepositBalance(
          await vaultRebalancer.getAddress(),
          await vaultRebalancer.getAddress()
        )
      ).to.equal(0);
      expect(
        await providerB.getDepositBalance(
          await vaultRebalancer.getAddress(),
          await vaultRebalancer.getAddress()
        )
      ).to.equal(assetsAll);

      // Check the active provider
      expect(await vaultRebalancer.activeProvider()).to.equal(
        await providerB.getAddress()
      );
      // Should emit VaultRefinance event
      await expect(tx)
        .to.emit(vaultRebalancer, "VaultRebalance")
        .withArgs(
          assetsAll,
          await providerA.getAddress(),
          await providerB.getAddress()
        );
    });
  });

  describe("setProviders", async () => {
    beforeEach(async () => {
      providerB = await new MockProviderB__factory(deployer).deploy();
    });

    it("Should revert when called by non-admin", async () => {
      await expect(
        vaultRebalancer
          .connect(alice)
          .setProviders([await providerB.getAddress()])
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        "GliaAccessControl__CallerIsNotAdmin"
      );
    });
    it("Should revert when provider is invalid", async () => {
      await expect(
        vaultRebalancer.setProviders([ethers.ZeroAddress])
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        "InterestVault__InvalidInput"
      );
    });
    it("Should set providers", async () => {
      let tx = await vaultRebalancer.setProviders([
        await providerA.getAddress(),
        await providerB.getAddress(),
      ]);
      expect((await vaultRebalancer.getProviders())[1]).to.equal(
        await providerB.getAddress()
      );

      // Should emit ProvidersChanged event
      await expect(tx)
        .to.emit(vaultRebalancer, "ProvidersChanged")
        .withArgs([await providerA.getAddress(), await providerB.getAddress()]);
    });
  });

  describe("setActiveProvider", async () => {
    beforeEach(async () => {
      providerA = await new MockProviderA__factory(deployer).deploy();
      providerB = await new MockProviderB__factory(deployer).deploy();
    });
    it("Should revert when called by non-admin", async () => {
      await expect(
        vaultRebalancer
          .connect(alice)
          .setActiveProvider(await providerB.getAddress())
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        "GliaAccessControl__CallerIsNotAdmin"
      );
    });
    it("Should revert when the active provider is invalid", async () => {
      await expect(
        vaultRebalancer.setActiveProvider(await providerB.getAddress())
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        "InterestVault__InvalidInput"
      );
      await vaultRebalancer.setProviders([
        await providerA.getAddress(),
        await providerB.getAddress(),
      ]);
      await expect(
        vaultRebalancer.setActiveProvider(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        "InterestVault__InvalidInput"
      );
    });
    it("Should set the active provider", async () => {
      await vaultRebalancer.setProviders([
        await providerA.getAddress(),
        await providerB.getAddress(),
      ]);
      let tx = await vaultRebalancer.setActiveProvider(
        await providerB.getAddress()
      );
      expect(await vaultRebalancer.activeProvider()).to.equal(
        await providerB.getAddress()
      );
      // Should emit ActiveProviderChanged event
      await expect(tx)
        .to.emit(vaultRebalancer, "ActiveProviderChanged")
        .withArgs(await providerB.getAddress());
    });
  });

  describe("setTreasury", async () => {
    it("Should revert when called by non-admin", async () => {
      await expect(
        vaultRebalancer.connect(alice).setTreasury(alice.address)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        "GliaAccessControl__CallerIsNotAdmin"
      );
    });
    it("Should set the treasury", async () => {
      let tx = await vaultRebalancer.setTreasury(alice.address);
      expect(await vaultRebalancer.treasury()).to.equal(alice.address);
      // Should emit TreasuryChanged event
      await expect(tx)
        .to.emit(vaultRebalancer, "TreasuryChanged")
        .withArgs(alice.address);
    });
  });

  describe("setFees", async () => {
    beforeEach(async () => {
      withdrawFeePercent = ethers.parseEther("0.2");
    });
    it("Should revert when called by non-admin", async () => {
      await expect(
        vaultRebalancer.connect(alice).setFees(withdrawFeePercent)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        "GliaAccessControl__CallerIsNotAdmin"
      );
    });
    it("Should set fee percents", async () => {
      let tx = await vaultRebalancer.setFees(withdrawFeePercent);
      expect(await vaultRebalancer.withdrawFeePercent()).to.equal(
        withdrawFeePercent
      );
      // Should emit FeesChanged event
      await expect(tx)
        .to.emit(vaultRebalancer, "FeesChanged")
        .withArgs(withdrawFeePercent);
    });
  });

  describe("setMinAmount", async () => {
    it("Should revert when called by non-admin", async () => {
      await expect(
        vaultRebalancer.connect(alice).setMinAmount(PRECISION_CONSTANT)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        "GliaAccessControl__CallerIsNotAdmin"
      );
    });
    it("Should set the minAmount", async () => {
      let tx = await vaultRebalancer.setMinAmount(PRECISION_CONSTANT);
      expect(await vaultRebalancer.minAmount()).to.equal(PRECISION_CONSTANT);
      // Should emit MinAmountChanged event
      await expect(tx)
        .to.emit(vaultRebalancer, "MinAmountChanged")
        .withArgs(PRECISION_CONSTANT);
    });
  });

  describe("maxDeposit", async () => {
    it("Should return 0 when deposits are paused", async () => {
      await vaultRebalancer.pause(0);
      expect(await vaultRebalancer.maxDeposit(alice.address)).to.equal(0);
    });
    it("Should return maxDeposit", async () => {
      expect(await vaultRebalancer.maxDeposit(alice.address)).to.equal(
        ethers.MaxUint256
      );
    });
  });

  describe("maxMint", async () => {
    it("Should return 0 when deposits are paused", async () => {
      await vaultRebalancer.pause(0);
      expect(await vaultRebalancer.maxMint(alice.address)).to.equal(0);
    });
    it("Should return maxMint", async () => {
      expect(await vaultRebalancer.maxMint(alice.address)).to.equal(
        ethers.MaxUint256
      );
    });
  });

  describe("maxWithdraw", async () => {
    it("Should return 0 when withdraws are paused", async () => {
      await vaultRebalancer
        .connect(alice)
        .deposit(depositAmount, alice.address);
      await vaultRebalancer.pause(1);
      expect(await vaultRebalancer.maxWithdraw(alice.address)).to.equal(0);
    });
    it("Should return maxWithdraw", async () => {
      await vaultRebalancer
        .connect(alice)
        .deposit(depositAmount, alice.address);
      expect(await vaultRebalancer.maxWithdraw(alice.address)).to.equal(
        depositAmount
      );
    });
  });

  describe("maxRedeem", async () => {
    it("Should return 0 when withdraws are paused", async () => {
      await vaultRebalancer
        .connect(alice)
        .deposit(depositAmount, alice.address);
      await vaultRebalancer.pause(1);
      expect(await vaultRebalancer.maxRedeem(alice.address)).to.equal(0);
    });
    it("Should return maxRedeem", async () => {
      await vaultRebalancer
        .connect(alice)
        .deposit(depositAmount, alice.address);
      let maxRedeem = await vaultRebalancer.previewWithdraw(depositAmount);
      expect(await vaultRebalancer.maxRedeem(alice.address)).to.equal(
        maxRedeem
      );
    });
  });
});
