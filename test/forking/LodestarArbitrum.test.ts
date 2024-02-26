// import { ethers } from "hardhat";
// import { expect } from "chai";
// import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
// import {
//   VaultRebalancer__factory,
//   VaultRebalancer,
//   ProviderManager__factory,
//   ProviderManager,
//   LodestarArbitrum__factory,
//   LodestarArbitrum,
//   IWETH,
// } from "../../typechain-types";
// import { moveTime } from "../../utils/move-time";
// import { moveBlocks } from "../../utils/move-blocks";

// describe("LodestarArbitrum", async () => {
//   let deployer: SignerWithAddress;
//   let alice: SignerWithAddress;
//   let bob: SignerWithAddress;

//   let PRECISION_CONSTANT: bigint;

//   let initAmount: bigint;
//   let withdrawFeePercent: bigint;
//   let depositAmount: bigint;
//   let mintAmount: bigint;

//   let userDepositLimit: bigint;
//   let vaultDepositLimit: bigint;

//   let mainAsset: IWETH; // WETH contract on Arbitrum mainnet

//   let providerManager: ProviderManager;
//   let lodestarProvider: LodestarArbitrum;

//   let vaultRebalancer: VaultRebalancer;

//   let WETH: string; // WETH address on Arbitrum mainnet
//   let iETH: string; // Lodestar iETH address on Arbitrum mainnet

//   before(async () => {
//     [deployer, alice, bob] = await ethers.getSigners();

//     PRECISION_CONSTANT = ethers.parseEther("1");

//     WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
//     iETH = "0x2193c45244AF12C280941281c8aa67dD08be0a64";

//     initAmount = ethers.parseUnits("1", 6);
//     withdrawFeePercent = ethers.parseEther("0.1"); // 10%
//     depositAmount = ethers.parseEther("0.0001");
//     mintAmount = ethers.parseEther("10");

//     userDepositLimit = ethers.parseEther("1");
//     vaultDepositLimit = ethers.parseEther("2") + initAmount;
//   });

//   beforeEach(async () => {
//     mainAsset = await ethers.getContractAt("IWETH", WETH);

//     // Set up WETH balances for deployer, alice and bob
//     await mainAsset.connect(deployer).deposit({ value: mintAmount });
//     await mainAsset.connect(alice).deposit({ value: mintAmount });
//     await mainAsset.connect(bob).deposit({ value: mintAmount });

//     providerManager = await new ProviderManager__factory(deployer).deploy();

//     // Set up providerManager
//     await providerManager.setProtocolToken(
//       "Lodestar_Arbitrum",
//       await mainAsset.getAddress(),
//       iETH
//     );

//     lodestarProvider = await new LodestarArbitrum__factory(deployer).deploy(
//       await providerManager.getAddress()
//     );

//     // Treasury and Rebalancer is the deployer for testing purposes.

//     vaultRebalancer = await new VaultRebalancer__factory(deployer).deploy(
//       WETH,
//       deployer.address,
//       "Rebalance tWETH",
//       "rtWETH",
//       [await lodestarProvider.getAddress()],
//       userDepositLimit,
//       vaultDepositLimit,
//       withdrawFeePercent,
//       deployer.address
//     );

//     await mainAsset
//       .connect(deployer)
//       .approve(await vaultRebalancer.getAddress(), initAmount);
//     await mainAsset
//       .connect(alice)
//       .approve(await vaultRebalancer.getAddress(), depositAmount);
//     await mainAsset
//       .connect(bob)
//       .approve(await vaultRebalancer.getAddress(), depositAmount);

//     await vaultRebalancer.connect(deployer).initializeVaultShares(initAmount);
//   });

//   describe("getProviderName", async () => {
//     it("Should get the provider name", async () => {
//       expect(await lodestarProvider.getProviderName()).to.equal(
//         "DForce_Arbitrum"
//       );
//     });
//   });

//   describe("getProviderManager", async () => {
//     it("Should get the provider manager", async () => {
//       expect(await lodestarProvider.getProviderManager()).to.equal(
//         await providerManager.getAddress()
//       );
//     });
//   });

//   xdescribe("deposit", async () => {
//     it("Should deposit assets", async () => {
//       let mintedSharesAliceBefore = await vaultRebalancer.balanceOf(
//         alice.address
//       );
//       let assetBalanceAliceBefore = await vaultRebalancer.convertToAssets(
//         mintedSharesAliceBefore
//       );
//       let mintedSharesBobBefore = await vaultRebalancer.balanceOf(bob.address);
//       let assetBalanceBobBefore = await vaultRebalancer.convertToAssets(
//         mintedSharesBobBefore
//       );
//       await vaultRebalancer
//         .connect(alice)
//         .deposit(depositAmount, alice.address);
//       await vaultRebalancer.connect(bob).deposit(depositAmount, bob.address);

//       let mintedSharesAliceAfter = await vaultRebalancer.balanceOf(
//         alice.address
//       );
//       let assetBalanceAliceAfter = await vaultRebalancer.convertToAssets(
//         mintedSharesAliceAfter
//       );

//       let mintedSharesBobAfter = await vaultRebalancer.balanceOf(bob.address);
//       let assetBalanceBobAfter = await vaultRebalancer.convertToAssets(
//         mintedSharesBobAfter
//       );

//       expect(assetBalanceAliceAfter - assetBalanceAliceBefore).to.be.closeTo(
//         depositAmount,
//         depositAmount / 1000n
//       );
//       expect(assetBalanceBobAfter - assetBalanceBobBefore).to.be.closeTo(
//         depositAmount,
//         depositAmount / 1000n
//       );
//     });
//   });

//   describe("withdraw", async () => {
//     it("Should withdraw assets", async () => {
//       await vaultRebalancer
//         .connect(alice)
//         .deposit(depositAmount, alice.address);

//       await moveTime(60); // Move 60 seconds
//       await moveBlocks(3); // Move 3 blocks

//       let maxWithdrawable = await vaultRebalancer.maxWithdraw(alice.address);
//       let previousBalanceAlice = await mainAsset.balanceOf(alice.address);
//       await vaultRebalancer
//         .connect(alice)
//         .withdraw(maxWithdrawable, alice.address, alice.address);

//       let afterBalanceAlice =
//         previousBalanceAlice +
//         maxWithdrawable -
//         (maxWithdrawable * withdrawFeePercent) / PRECISION_CONSTANT;

//       expect(await mainAsset.balanceOf(alice.address)).to.equal(
//         afterBalanceAlice
//       );
//     });
//   });

//   describe("balances", async () => {
//     it("Should get balances", async () => {
//       await vaultRebalancer
//         .connect(alice)
//         .deposit(depositAmount, alice.address);
//       expect(await vaultRebalancer.totalAssets()).to.be.closeTo(
//         depositAmount + initAmount,
//         depositAmount / 1000n
//       );
//     });
//   });

//   describe("interest rates", async () => {
//     it("Should get interest rates", async () => {
//       await vaultRebalancer
//         .connect(alice)
//         .deposit(depositAmount, alice.address);
//       let depositRate = await lodestarProvider.getDepositRateFor(
//         await vaultRebalancer.getAddress()
//       );
//       expect(depositRate).to.be.greaterThan(0);
//     });
//   });
// });
