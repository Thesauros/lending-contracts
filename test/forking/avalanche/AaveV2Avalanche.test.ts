import { ethers } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import {
  VaultRebalancerV2,
  AaveV2Avalanche__factory,
  AaveV2Avalanche,
  IWETH,
} from '../../../typechain-types';
import { setForkToAvalanche } from '../../../utils/set-fork';
import {
  deployVault,
  deposit,
  withdraw,
  tokenAddresses,
  DEPOSIT_AMOUNT,
  PRECISION_CONSTANT,
  WITHDRAW_FEE_PERCENT,
} from '../../../utils/helper-config';
import { moveTime } from '../../../utils/move-time';
import { moveBlocks } from '../../../utils/move-blocks';

describe('AaveV2Avalanche', async () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let wavaxAddress: string;

  let wavaxContract: IWETH;
  let aaveV2Provider: AaveV2Avalanche;
  let wavaxRebalancer: VaultRebalancerV2;

  let minAmount: bigint;

  before(async () => {
    [deployer, alice, bob] = await ethers.getSigners();

    wavaxAddress = tokenAddresses.avalanche.WAVAX;

    minAmount = ethers.parseUnits('1', 6);
  });

  beforeEach(async () => {
    await setForkToAvalanche();

    wavaxContract = await ethers.getContractAt('IWETH', wavaxAddress);

    // Set up WAVAX balances for deployer, alice and bob
    Promise.all([
      wavaxContract.connect(deployer).deposit({ value: minAmount }),
      wavaxContract.connect(alice).deposit({ value: DEPOSIT_AMOUNT }),
      wavaxContract.connect(bob).deposit({ value: DEPOSIT_AMOUNT }),
    ]);

    aaveV2Provider = await new AaveV2Avalanche__factory(deployer).deploy();

    wavaxRebalancer = await deployVault(
      deployer,
      wavaxAddress,
      'Rebalance tWAVAX',
      'rtWAVAX',
      [await aaveV2Provider.getAddress()]
    );

    Promise.all([
      wavaxContract
        .connect(deployer)
        .approve(await wavaxRebalancer.getAddress(), ethers.MaxUint256),
      wavaxContract
        .connect(alice)
        .approve(await wavaxRebalancer.getAddress(), ethers.MaxUint256),
      wavaxContract
        .connect(bob)
        .approve(await wavaxRebalancer.getAddress(), ethers.MaxUint256),
    ]);

    await wavaxRebalancer.connect(deployer).initializeVaultShares(minAmount);
  });

  describe('getProviderName', async () => {
    it('Should get the provider name', async () => {
      expect(await aaveV2Provider.getProviderName()).to.equal(
        'Aave_V2_Avalanche'
      );
    });
  });

  describe('deposit', async () => {
    it('Should deposit assets', async () => {
      let sharesAliceBefore = await wavaxRebalancer.balanceOf(alice.address);
      let assetsAliceBefore = await wavaxRebalancer.convertToAssets(
        sharesAliceBefore
      );
      let sharesBobBefore = await wavaxRebalancer.balanceOf(bob.address);
      let assetsBobBefore = await wavaxRebalancer.convertToAssets(
        sharesBobBefore
      );

      await deposit(alice, wavaxRebalancer, DEPOSIT_AMOUNT);
      await deposit(bob, wavaxRebalancer, DEPOSIT_AMOUNT);

      let sharesAliceAfter = await wavaxRebalancer.balanceOf(alice.address);
      let assetsAliceAfter = await wavaxRebalancer.convertToAssets(
        sharesAliceAfter
      );

      let sharesBobAfter = await wavaxRebalancer.balanceOf(bob.address);
      let assetsBobAfter = await wavaxRebalancer.convertToAssets(
        sharesBobAfter
      );

      expect(assetsAliceAfter - assetsAliceBefore).to.be.closeTo(
        DEPOSIT_AMOUNT,
        DEPOSIT_AMOUNT / 1000n
      );
      expect(assetsBobAfter - assetsBobBefore).to.be.closeTo(
        DEPOSIT_AMOUNT,
        DEPOSIT_AMOUNT / 1000n
      );
    });
  });

  describe('withdraw', async () => {
    it('Should withdraw assets', async () => {
      await deposit(alice, wavaxRebalancer, DEPOSIT_AMOUNT);

      await moveTime(60); // Move 60 seconds
      await moveBlocks(3); // Move 3 blocks

      let maxWithdrawable = await wavaxRebalancer.maxWithdraw(alice.address);
      let previousBalanceAlice = await wavaxContract.balanceOf(alice.address);

      await withdraw(alice, wavaxRebalancer, maxWithdrawable);

      let afterBalanceAlice =
        previousBalanceAlice +
        maxWithdrawable -
        (maxWithdrawable * WITHDRAW_FEE_PERCENT) / PRECISION_CONSTANT;

      expect(await wavaxContract.balanceOf(alice.address)).to.equal(
        afterBalanceAlice
      );
    });
  });

  describe('balances', async () => {
    it('Should get balances', async () => {
      await deposit(alice, wavaxRebalancer, DEPOSIT_AMOUNT);
      expect(await wavaxRebalancer.totalAssets()).to.be.closeTo(
        DEPOSIT_AMOUNT + minAmount,
        DEPOSIT_AMOUNT / 1000n
      );
    });
  });

  describe('interest rates', async () => {
    it('Should get interest rates', async () => {
      await deposit(alice, wavaxRebalancer, DEPOSIT_AMOUNT);
      let depositRate = await aaveV2Provider.getDepositRateFor(
        await wavaxRebalancer.getAddress()
      );
      expect(depositRate).to.be.greaterThan(0);
    });
  });
});
