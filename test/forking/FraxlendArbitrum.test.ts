import { ethers } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import {
  VaultRebalancerV2,
  FraxlendArbitrum__factory,
  FraxlendArbitrum,
  IERC20,
} from '../../typechain-types';
import {
  deployVault,
  deposit,
  withdraw,
  PRECISION_CONSTANT,
  WITHDRAW_FEE_PERCENT,
  DEPOSIT_AMOUNT,
} from '../../utils/helper';
import { tokenAddresses } from '../../utils/constants';
import { impersonate } from '../../utils/impersonate-account';
import { moveTime } from '../../utils/move-time';
import { moveBlocks } from '../../utils/move-blocks';

describe('FraxlendArbitrum', async () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let holder: SignerWithAddress;

  let holderAddress: string;
  let fraxAddress: string;

  let fraxContract: IERC20;
  let fraxlendProvider: FraxlendArbitrum;
  let fraxRebalancer: VaultRebalancerV2;

  let minAmount: bigint;

  before(async () => {
    [deployer, alice, bob] = await ethers.getSigners();

    holderAddress = '0xbbb5008Da7eF90A416a4389fdad3872D6896CFf9';

    fraxAddress = tokenAddresses.FRAX;

    minAmount = ethers.parseEther('0.0001');
  });

  beforeEach(async () => {
    holder = await impersonate(holderAddress);

    fraxContract = await ethers.getContractAt('IERC20', fraxAddress);

    // Set up token balances for deployer, alice and bob
    Promise.all([
      fraxContract.connect(holder).transfer(deployer.address, minAmount),
      fraxContract.connect(holder).transfer(alice.address, DEPOSIT_AMOUNT),
      fraxContract.connect(holder).transfer(bob.address, DEPOSIT_AMOUNT),
    ]);

    fraxlendProvider = await new FraxlendArbitrum__factory(deployer).deploy();

    fraxRebalancer = await deployVault(
      deployer,
      fraxAddress,
      'Rebalance tFRAX',
      'rtFRAX',
      [await fraxlendProvider.getAddress()]
    );

    Promise.all([
      fraxContract
        .connect(deployer)
        .approve(await fraxRebalancer.getAddress(), minAmount),
      fraxContract
        .connect(alice)
        .approve(await fraxRebalancer.getAddress(), DEPOSIT_AMOUNT),
      fraxContract
        .connect(bob)
        .approve(await fraxRebalancer.getAddress(), DEPOSIT_AMOUNT),
    ]);

    await fraxRebalancer.connect(deployer).initializeVaultShares(minAmount);
  });

  describe('getProviderName', async () => {
    it('Should get the provider name', async () => {
      expect(await fraxlendProvider.getProviderName()).to.equal(
        'Fraxlend_Arbitrum'
      );
    });
  });

  describe('deposit', async () => {
    it('Should deposit assets', async () => {
      let mintedSharesAliceBefore = await fraxRebalancer.balanceOf(
        alice.address
      );
      let assetBalanceAliceBefore = await fraxRebalancer.convertToAssets(
        mintedSharesAliceBefore
      );
      let mintedSharesBobBefore = await fraxRebalancer.balanceOf(bob.address);
      let assetBalanceBobBefore = await fraxRebalancer.convertToAssets(
        mintedSharesBobBefore
      );

      await deposit(alice, fraxRebalancer, DEPOSIT_AMOUNT);
      await deposit(bob, fraxRebalancer, DEPOSIT_AMOUNT);

      let mintedSharesAliceAfter = await fraxRebalancer.balanceOf(
        alice.address
      );
      let assetBalanceAliceAfter = await fraxRebalancer.convertToAssets(
        mintedSharesAliceAfter
      );
      let mintedSharesBobAfter = await fraxRebalancer.balanceOf(bob.address);
      let assetBalanceBobAfter = await fraxRebalancer.convertToAssets(
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
      await deposit(alice, fraxRebalancer, DEPOSIT_AMOUNT);

      await moveTime(60); // Move 60 seconds
      await moveBlocks(3); // Move 3 blocks

      let maxWithdrawable = await fraxRebalancer.maxWithdraw(alice.address);
      let previousBalanceAlice = await fraxContract.balanceOf(alice.address);

      await withdraw(alice, fraxRebalancer, maxWithdrawable);

      let afterBalanceAlice =
        previousBalanceAlice +
        maxWithdrawable -
        (maxWithdrawable * WITHDRAW_FEE_PERCENT) / PRECISION_CONSTANT;

      expect(await fraxContract.balanceOf(alice.address)).to.equal(
        afterBalanceAlice
      );
    });
  });

  describe('balances', async () => {
    it('Should get balances', async () => {
      await deposit(alice, fraxRebalancer, DEPOSIT_AMOUNT);
      expect(await fraxRebalancer.totalAssets()).to.be.closeTo(
        DEPOSIT_AMOUNT + minAmount,
        DEPOSIT_AMOUNT / 1000n
      );
    });
  });

  describe('interest rates', async () => {
    it('Should get interest rates', async () => {
      await deposit(alice, fraxRebalancer, DEPOSIT_AMOUNT);
      let depositRate = await fraxlendProvider.getDepositRateFor(
        await fraxRebalancer.getAddress()
      );
      expect(depositRate).to.be.greaterThan(0);
    });
  });
});
