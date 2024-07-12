import { ethers } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import {
  VaultRebalancerV2__factory,
  VaultRebalancerV2,
  SiloArbitrum__factory,
  SiloArbitrum,
  IWETH,
} from '../../../typechain-types';
import { moveTime } from '../../../utils/move-time';
import { moveBlocks } from '../../../utils/move-blocks';

describe('SiloArbitrum', async () => {
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

  let mainAsset: IWETH; // Wrapped native token contract on Arbitrum mainnet

  let siloProvider: SiloArbitrum;
  let vaultRebalancer: VaultRebalancerV2;

  let WETH: string; // WETH address on Arbitrum mainnet

  before(async () => {
    [deployer, alice, bob] = await ethers.getSigners();

    PRECISION_CONSTANT = ethers.parseEther('1');

    WETH = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';

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
    await Promise.all([
      mainAsset.connect(deployer).deposit({ value: mintAmount }),
      mainAsset.connect(alice).deposit({ value: mintAmount }),
      mainAsset.connect(bob).deposit({ value: mintAmount }),
    ]);

    siloProvider = await new SiloArbitrum__factory(deployer).deploy();

    // Treasury and Rebalancer is the deployer for testing purposes.

    vaultRebalancer = await new VaultRebalancerV2__factory(deployer).deploy(
      deployer.address,
      WETH,
      'Rebalance tWETH',
      'rtWETH',
      [await siloProvider.getAddress()],
      userDepositLimit,
      vaultDepositLimit,
      withdrawFeePercent,
      deployer.address
    );

    await Promise.all([
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
      expect(await siloProvider.getProviderName()).to.equal('Silo_Arbitrum');
    });
  });

  describe('deposit', async () => {
    it('Should deposit assets', async () => {
      let mintedSharesAliceBefore = await vaultRebalancer.balanceOf(
        alice.address
      );
      let assetBalanceAliceBefore = await vaultRebalancer.convertToAssets(
        mintedSharesAliceBefore
      );
      let mintedSharesBobBefore = await vaultRebalancer.balanceOf(bob.address);
      let assetBalanceBobBefore = await vaultRebalancer.convertToAssets(
        mintedSharesBobBefore
      );
      await vaultRebalancer
        .connect(alice)
        .deposit(depositAmount, alice.address);
      await vaultRebalancer.connect(bob).deposit(depositAmount, bob.address);

      let mintedSharesAliceAfter = await vaultRebalancer.balanceOf(
        alice.address
      );
      let assetBalanceAliceAfter = await vaultRebalancer.convertToAssets(
        mintedSharesAliceAfter
      );
      let mintedSharesBobAfter = await vaultRebalancer.balanceOf(bob.address);
      let assetBalanceBobAfter = await vaultRebalancer.convertToAssets(
        mintedSharesBobAfter
      );

      expect(assetBalanceAliceAfter - assetBalanceAliceBefore).to.be.closeTo(
        depositAmount,
        depositAmount / 1000n
      );
      expect(assetBalanceBobAfter - assetBalanceBobBefore).to.be.closeTo(
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
      await vaultRebalancer.deposit(depositAmount, alice.address);
      expect(await vaultRebalancer.totalAssets()).to.be.closeTo(
        depositAmount + minAmount,
        depositAmount / 1000n
      );
    });
  });

  describe('interest rates', async () => {
    it('Should get interest rates', async () => {
      await vaultRebalancer
        .connect(alice)
        .deposit(depositAmount, alice.address);
      let depositRate = await siloProvider.getDepositRateFor(
        await vaultRebalancer.getAddress()
      );
      expect(depositRate).to.be.greaterThan(0);
    });
  });
});
