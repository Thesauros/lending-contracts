import { ethers } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import {
  VaultRebalancerV2,
  AaveV3Arbitrum__factory,
  AaveV3Arbitrum,
  IWETH,
} from '../../../typechain-types';
import {
  deployVault,
  deposit,
  arbTokenAddresses,
  DEPOSIT_AMOUNT,
  PRECISION_CONSTANT,
  WITHDRAW_FEE_PERCENT,
} from '../../../utils/test-config';
import { moveTime } from '../../../utils/move-time';
import { moveBlocks } from '../../../utils/move-blocks';

describe('AaveV3Arbitrum', async () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let wethAddress: string;

  let wethContract: IWETH;
  let aaveV3Provider: AaveV3Arbitrum;
  let wethRebalancer: VaultRebalancerV2;

  let minAmount: bigint;

  before(async () => {
    [deployer, alice, bob] = await ethers.getSigners();

    wethAddress = arbTokenAddresses.weth;

    minAmount = ethers.parseUnits('1', 6);
  });

  beforeEach(async () => {
    wethContract = await ethers.getContractAt('IWETH', wethAddress);
    // Set up WETH balances for deployer, alice and bob
    await Promise.all([
      wethContract.connect(deployer).deposit({ value: minAmount }),
      wethContract.connect(alice).deposit({ value: DEPOSIT_AMOUNT }),
      wethContract.connect(bob).deposit({ value: DEPOSIT_AMOUNT }),
    ]);

    aaveV3Provider = await new AaveV3Arbitrum__factory(deployer).deploy();

    wethRebalancer = await deployVault(
      deployer,
      wethAddress,
      'Rebalance tWETH',
      'rtWETH',
      [await aaveV3Provider.getAddress()]
    );

    await Promise.all([
      wethContract
        .connect(deployer)
        .approve(await wethRebalancer.getAddress(), ethers.MaxUint256),
      wethContract
        .connect(alice)
        .approve(await wethRebalancer.getAddress(), ethers.MaxUint256),
      wethContract
        .connect(bob)
        .approve(await wethRebalancer.getAddress(), ethers.MaxUint256),
    ]);

    await wethRebalancer.connect(deployer).initializeVaultShares(minAmount);
  });

  describe('getProviderName', async () => {
    it('Should get the provider name', async () => {
      expect(await aaveV3Provider.getProviderName()).to.equal(
        'Aave_V3_Arbitrum'
      );
    });
  });

  describe('deposit', async () => {
    it('Should deposit assets', async () => {
      let mintedSharesAliceBefore = await wethRebalancer.balanceOf(
        alice.address
      );
      let assetBalanceAliceBefore = await wethRebalancer.convertToAssets(
        mintedSharesAliceBefore
      );
      let mintedSharesBobBefore = await wethRebalancer.balanceOf(bob.address);
      let assetBalanceBobBefore = await wethRebalancer.convertToAssets(
        mintedSharesBobBefore
      );

      await deposit(alice, wethRebalancer, DEPOSIT_AMOUNT);
      await deposit(bob, wethRebalancer, DEPOSIT_AMOUNT);

      let mintedSharesAliceAfter = await wethRebalancer.balanceOf(
        alice.address
      );
      let assetBalanceAliceAfter = await wethRebalancer.convertToAssets(
        mintedSharesAliceAfter
      );
      let mintedSharesBobAfter = await wethRebalancer.balanceOf(bob.address);
      let assetBalanceBobAfter = await wethRebalancer.convertToAssets(
        mintedSharesBobAfter
      );

      expect(assetBalanceAliceAfter - assetBalanceAliceBefore).to.be.closeTo(
        DEPOSIT_AMOUNT,
        DEPOSIT_AMOUNT / 1000n
      );
      expect(assetBalanceBobAfter - assetBalanceBobBefore).to.be.closeTo(
        DEPOSIT_AMOUNT,
        DEPOSIT_AMOUNT / 1000n
      );
    });
  });

  describe('withdraw', async () => {
    it('Should withdraw assets', async () => {
      await deposit(alice, wethRebalancer, DEPOSIT_AMOUNT);

      await moveTime(60); // Move 60 seconds
      await moveBlocks(3); // Move 3 blocks

      let maxWithdrawable = await wethRebalancer.maxWithdraw(alice.address);
      let previousBalanceAlice = await wethContract.balanceOf(alice.address);
      await wethRebalancer
        .connect(alice)
        .withdraw(maxWithdrawable, alice.address, alice.address);

      let afterBalanceAlice =
        previousBalanceAlice +
        maxWithdrawable -
        (maxWithdrawable * WITHDRAW_FEE_PERCENT) / PRECISION_CONSTANT;

      expect(await wethContract.balanceOf(alice.address)).to.equal(
        afterBalanceAlice
      );
    });
  });

  describe('balances', async () => {
    it('Should get balances', async () => {
      await deposit(alice, wethRebalancer, DEPOSIT_AMOUNT);
      expect(await wethRebalancer.totalAssets()).to.be.closeTo(
        DEPOSIT_AMOUNT + minAmount,
        DEPOSIT_AMOUNT / 1000n
      );
    });
  });

  describe('interest rates', async () => {
    it('Should get interest rates', async () => {
      await deposit(alice, wethRebalancer, DEPOSIT_AMOUNT);
      let depositRate = await aaveV3Provider.getDepositRateFor(
        await wethRebalancer.getAddress()
      );
      expect(depositRate).to.be.greaterThan(0);
    });
  });
});
