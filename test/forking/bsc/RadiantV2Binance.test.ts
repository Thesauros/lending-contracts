import { ethers } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import {
  VaultRebalancerV2,
  RadiantV2Binance__factory,
  RadiantV2Binance,
  IWETH,
} from '../../../typechain-types';
import {
  deployVault,
  deposit,
  withdraw,
  tokenAddresses,
  DEPOSIT_AMOUNT,
  PRECISION_CONSTANT,
  WITHDRAW_FEE_PERCENT,
} from '../../../utils/helper';
import { setForkToBinance } from '../../../utils/set-fork';
import { moveTime } from '../../../utils/move-time';
import { moveBlocks } from '../../../utils/move-blocks';

describe('RadiantV2Binance', async () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let wbnbAddress: string;

  let wbnbContract: IWETH;
  let radiantProvider: RadiantV2Binance;
  let wbnbRebalancer: VaultRebalancerV2;

  let minAmount: bigint;

  before(async () => {
    [deployer, alice, bob] = await ethers.getSigners();

    wbnbAddress = tokenAddresses.bsc.WBNB;

    minAmount = ethers.parseUnits('1', 6);
  });

  beforeEach(async () => {
    await setForkToBinance();

    wbnbContract = await ethers.getContractAt('IWETH', wbnbAddress);

    // Set up WETH balances for deployer, alice and bob
    Promise.all([
      wbnbContract.connect(deployer).deposit({ value: minAmount }),
      wbnbContract.connect(alice).deposit({ value: DEPOSIT_AMOUNT }),
      wbnbContract.connect(bob).deposit({ value: DEPOSIT_AMOUNT }),
    ]);

    radiantProvider = await new RadiantV2Binance__factory(deployer).deploy();

    wbnbRebalancer = await deployVault(
      deployer,
      wbnbAddress,
      'Rebalance tWBNB',
      'rtWBNB',
      [await radiantProvider.getAddress()]
    );

    Promise.all([
      wbnbContract
        .connect(deployer)
        .approve(await wbnbRebalancer.getAddress(), ethers.MaxUint256),
      wbnbContract
        .connect(alice)
        .approve(await wbnbRebalancer.getAddress(), ethers.MaxUint256),
      wbnbContract
        .connect(bob)
        .approve(await wbnbRebalancer.getAddress(), ethers.MaxUint256),
    ]);

    await wbnbRebalancer.connect(deployer).initializeVaultShares(minAmount);
  });

  describe('getProviderName', async () => {
    it('Should get the provider name', async () => {
      expect(await radiantProvider.getProviderName()).to.equal(
        'Radiant_V2_Binance'
      );
    });
  });

  describe('deposit', async () => {
    it('Should deposit assets', async () => {
      let sharesAliceBefore = await wbnbRebalancer.balanceOf(alice.address);
      let assetsAliceBefore = await wbnbRebalancer.convertToAssets(
        sharesAliceBefore
      );
      let sharesBobBefore = await wbnbRebalancer.balanceOf(bob.address);
      let assetsBobBefore = await wbnbRebalancer.convertToAssets(
        sharesBobBefore
      );

      await deposit(alice, wbnbRebalancer, DEPOSIT_AMOUNT);
      await deposit(bob, wbnbRebalancer, DEPOSIT_AMOUNT);

      let sharesAliceAfter = await wbnbRebalancer.balanceOf(alice.address);
      let assetsAliceAfter = await wbnbRebalancer.convertToAssets(
        sharesAliceAfter
      );

      let sharesBobAfter = await wbnbRebalancer.balanceOf(bob.address);
      let assetsBobAfter = await wbnbRebalancer.convertToAssets(sharesBobAfter);

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
      await deposit(alice, wbnbRebalancer, DEPOSIT_AMOUNT);

      await moveTime(60); // Move 60 seconds
      await moveBlocks(3); // Move 3 blocks

      let maxWithdrawable = await wbnbRebalancer.maxWithdraw(alice.address);
      let previousBalanceAlice = await wbnbContract.balanceOf(alice.address);

      await withdraw(alice, wbnbRebalancer, maxWithdrawable);

      let afterBalanceAlice =
        previousBalanceAlice +
        maxWithdrawable -
        (maxWithdrawable * WITHDRAW_FEE_PERCENT) / PRECISION_CONSTANT;

      expect(await wbnbContract.balanceOf(alice.address)).to.equal(
        afterBalanceAlice
      );
    });
  });

  describe('balances', async () => {
    it('Should get balances', async () => {
      await deposit(alice, wbnbRebalancer, DEPOSIT_AMOUNT);
      expect(await wbnbRebalancer.totalAssets()).to.be.closeTo(
        DEPOSIT_AMOUNT + minAmount,
        DEPOSIT_AMOUNT / 1000n
      );
    });
  });

  describe('interest rates', async () => {
    it('Should get interest rates', async () => {
      await deposit(alice, wbnbRebalancer, DEPOSIT_AMOUNT);
      let depositRate = await radiantProvider.getDepositRateFor(
        await wbnbRebalancer.getAddress()
      );
      expect(depositRate).to.be.greaterThan(0);
    });
  });
});
