import { ethers } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import {
  VaultRebalancerV2__factory,
  VaultRebalancerV2,
  RadiantV2Arbitrum__factory,
  RadiantV2Arbitrum,
  IWETH,
} from '../../typechain-types';
import { moveTime } from '../../utils/move-time';
import { moveBlocks } from '../../utils/move-blocks';

describe('RadiantV2Arbitrum', async () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let PRECISION_CONSTANT: bigint;

  let minAmount: bigint;
  let depositAmount: bigint;
  let mintAmount: bigint;

  let withdrawFeePercent: bigint;

  let userDepositLimit: bigint;
  let vaultDepositLimit: bigint;

  let mainAsset: IWETH; // WETH contract on Arbitrum mainnet

  let radiantProvider: RadiantV2Arbitrum;
  let vaultRebalancer: VaultRebalancerV2;

  let WETH: string; // WETH address on Arbitrum mainnet

  before(async () => {
    [deployer, alice, bob] = await ethers.getSigners();

    WETH = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';

    PRECISION_CONSTANT = ethers.parseEther('1');

    minAmount = ethers.parseUnits('1', 6);
    depositAmount = ethers.parseEther('0.5');
    mintAmount = ethers.parseEther('10');

    withdrawFeePercent = ethers.parseEther('0.001'); // 0.1%

    userDepositLimit = ethers.parseEther('1');
    vaultDepositLimit = ethers.parseEther('2') + minAmount;
  });

  beforeEach(async () => {
    mainAsset = await ethers.getContractAt('IWETH', WETH);

    // Set up WETH balances for deployer, alice and bob
    Promise.all([
      mainAsset.connect(deployer).deposit({ value: mintAmount }),
      mainAsset.connect(alice).deposit({ value: mintAmount }),
      mainAsset.connect(bob).deposit({ value: mintAmount }),
    ]);

    radiantProvider = await new RadiantV2Arbitrum__factory(deployer).deploy();

    // Rebalancer and Treasury is the deployer for testing purposes

    vaultRebalancer = await new VaultRebalancerV2__factory(deployer).deploy(
      deployer.address,
      WETH,
      'Rebalance tWETH',
      'rtWETH',
      [await radiantProvider.getAddress()],
      userDepositLimit,
      vaultDepositLimit,
      withdrawFeePercent,
      deployer.address
    );
    Promise.all([
      mainAsset
        .connect(deployer)
        .approve(await vaultRebalancer.getAddress(), ethers.MaxUint256),
      mainAsset
        .connect(alice)
        .approve(await vaultRebalancer.getAddress(), ethers.MaxUint256),
      mainAsset
        .connect(bob)
        .approve(await vaultRebalancer.getAddress(), ethers.MaxUint256),
    ]);

    await vaultRebalancer.connect(deployer).initializeVaultShares(minAmount);
  });

  describe('getProviderName', async () => {
    it('Should get the provider name', async () => {
      expect(await radiantProvider.getProviderName()).to.equal(
        'Radiant_V2_Arbitrum'
      );
    });
  });

  describe('deposit', async () => {
    it('Should deposit assets', async () => {
      let sharesAliceBefore = await vaultRebalancer.balanceOf(alice.address);
      let assetsAliceBefore = await vaultRebalancer.convertToAssets(
        sharesAliceBefore
      );
      let sharesBobBefore = await vaultRebalancer.balanceOf(bob.address);
      let assetsBobBefore = await vaultRebalancer.convertToAssets(
        sharesBobBefore
      );
      await vaultRebalancer
        .connect(alice)
        .deposit(depositAmount, alice.address);
      await vaultRebalancer.connect(bob).deposit(depositAmount, bob.address);

      let sharesAliceAfter = await vaultRebalancer.balanceOf(alice.address);
      let assetsAliceAfter = await vaultRebalancer.convertToAssets(
        sharesAliceAfter
      );

      let sharesBobAfter = await vaultRebalancer.balanceOf(bob.address);
      let assetsBobAfter = await vaultRebalancer.convertToAssets(
        sharesBobAfter
      );

      expect(assetsAliceAfter - assetsAliceBefore).to.be.closeTo(
        depositAmount,
        depositAmount / 1000n
      );
      expect(assetsBobAfter - assetsBobBefore).to.be.closeTo(
        depositAmount,
        depositAmount / 1000n
      );
    });
  });

  describe('withdraw', async () => {
    it('Should withdraw assets', async () => {
      await vaultRebalancer
        .connect(alice)
        .deposit(depositAmount, alice.address);

      await moveTime(60); // Move 60 seconds
      await moveBlocks(3); // Move 3 blocks

      let maxWithdrawable = await vaultRebalancer.maxWithdraw(alice.address);
      let previousBalanceAlice = await mainAsset.balanceOf(alice.address);
      await vaultRebalancer
        .connect(alice)
        .withdraw(maxWithdrawable, alice.address, alice.address);

      let afterBalanceAlice =
        previousBalanceAlice +
        maxWithdrawable -
        (maxWithdrawable * withdrawFeePercent) / PRECISION_CONSTANT;

      expect(await mainAsset.balanceOf(alice.address)).to.equal(
        afterBalanceAlice
      );
    });
  });

  describe('balances', async () => {
    it('Should get balances', async () => {
      await vaultRebalancer
        .connect(alice)
        .deposit(depositAmount, alice.address);
      await moveTime(60); // Move 60 seconds
      expect(await vaultRebalancer.totalAssets()).to.be.greaterThanOrEqual(
        depositAmount + minAmount
      );
    });
  });

  describe('interest rates', async () => {
    it('Should get interest rates', async () => {
      await vaultRebalancer
        .connect(alice)
        .deposit(depositAmount, alice.address);
      let depositRate = await radiantProvider.getDepositRateFor(
        await vaultRebalancer.getAddress()
      );
      expect(depositRate).to.be.greaterThan(0);
    });
  });
});
