import { ethers } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import {
  VaultRebalancerV2,
  ProviderManager__factory,
  ProviderManager,
  DForceArbitrum__factory,
  DForceArbitrum,
  IERC20,
  IWETH,
} from '../../../typechain-types';
import {
  deployVault,
  deposit,
  VaultAssetPair,
  dforcePairs,
  arbTokenAddresses,
  PRECISION_CONSTANT,
  WITHDRAW_FEE_PERCENT,
  DEPOSIT_AMOUNT,
} from '../../../utils/test-config';
import { impersonate } from '../../../utils/impersonate-account';
import { moveTime } from '../../../utils/move-time';
import { moveBlocks } from '../../../utils/move-blocks';

describe('DForceArbitrum', async () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let holder: SignerWithAddress;

  let holderAddress: string;
  let wethAddress: string;
  let daiAddress: string;
  let iWethAddress: string;
  let iDaiAddress: string;

  let wethContract: IWETH;
  let daiContract: IERC20;
  let providerManager: ProviderManager;
  let dforceProvider: DForceArbitrum;
  let wethRebalancer: VaultRebalancerV2;
  let daiRebalancer: VaultRebalancerV2;

  let vaultAssetPairs: VaultAssetPair[];

  let minAmount: bigint;

  before(async () => {
    [deployer, alice, bob] = await ethers.getSigners();

    holderAddress = '0xc2995BBD284953e8BA0b01eFE64535aC55cfcD9d';

    wethAddress = arbTokenAddresses.weth;
    daiAddress = arbTokenAddresses.dai;
    iWethAddress = dforcePairs.weth;
    iDaiAddress = dforcePairs.dai;

    minAmount = ethers.parseEther('0.0001');
  });

  beforeEach(async () => {
    holder = await impersonate(holderAddress);

    wethContract = await ethers.getContractAt('IWETH', wethAddress);
    daiContract = await ethers.getContractAt('IERC20', daiAddress);

    // Set up token balances for deployer, alice and bob
    Promise.all([
      wethContract.connect(deployer).deposit({ value: minAmount }),
      wethContract.connect(alice).deposit({ value: DEPOSIT_AMOUNT }),
      wethContract.connect(bob).deposit({ value: DEPOSIT_AMOUNT }),
      daiContract.connect(holder).transfer(deployer.address, minAmount),
      daiContract.connect(holder).transfer(alice.address, DEPOSIT_AMOUNT),
      daiContract.connect(holder).transfer(bob.address, DEPOSIT_AMOUNT),
    ]);

    providerManager = await new ProviderManager__factory(deployer).deploy();

    // Set up providerManager
    await providerManager.setProtocolToken(
      'DForce_Arbitrum',
      wethAddress,
      iWethAddress
    );
    await providerManager.setProtocolToken(
      'DForce_Arbitrum',
      daiAddress,
      iDaiAddress
    );

    dforceProvider = await new DForceArbitrum__factory(deployer).deploy(
      await providerManager.getAddress()
    );

    wethRebalancer = await deployVault(
      deployer,
      wethAddress,
      'Rebalance tWETH',
      'rtWETH',
      [await dforceProvider.getAddress()]
    );
    daiRebalancer = await deployVault(
      deployer,
      daiAddress,
      'Rebalance tDAI',
      'rtDAI',
      [await dforceProvider.getAddress()]
    );

    vaultAssetPairs = [
      { vault: wethRebalancer, asset: wethContract },
      { vault: daiRebalancer, asset: daiContract },
    ];

    Promise.all([
      wethContract
        .connect(deployer)
        .approve(await wethRebalancer.getAddress(), minAmount),
      wethContract
        .connect(alice)
        .approve(await wethRebalancer.getAddress(), DEPOSIT_AMOUNT),
      wethContract
        .connect(bob)
        .approve(await wethRebalancer.getAddress(), DEPOSIT_AMOUNT),
      daiContract
        .connect(deployer)
        .approve(await daiRebalancer.getAddress(), minAmount),
      daiContract
        .connect(alice)
        .approve(await daiRebalancer.getAddress(), DEPOSIT_AMOUNT),
      daiContract
        .connect(bob)
        .approve(await daiRebalancer.getAddress(), DEPOSIT_AMOUNT),
    ]);

    await wethRebalancer.connect(deployer).initializeVaultShares(minAmount);
    await daiRebalancer.connect(deployer).initializeVaultShares(minAmount);
  });

  describe('constructor', async () => {
    it('Should revert when the provider manager is invalid', async () => {
      await expect(
        new DForceArbitrum__factory(deployer).deploy(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(
        dforceProvider,
        'DForceArbitrum__AddressZero'
      );
    });
    it('Should initialize correctly', async () => {
      expect(await dforceProvider.getProviderManager()).to.equal(
        await providerManager.getAddress()
      );
    });
  });

  describe('getProviderName', async () => {
    it('Should get the provider name', async () => {
      expect(await dforceProvider.getProviderName()).to.equal(
        'DForce_Arbitrum'
      );
    });
  });

  describe('deposit', async () => {
    it('Should deposit assets', async () => {
      for (const { vault } of vaultAssetPairs) {
        let mintedSharesAliceBefore = await vault.balanceOf(alice.address);
        let assetBalanceAliceBefore = await vault.convertToAssets(
          mintedSharesAliceBefore
        );
        let mintedSharesBobBefore = await vault.balanceOf(bob.address);
        let assetBalanceBobBefore = await vault.convertToAssets(
          mintedSharesBobBefore
        );

        await deposit(alice, vault, DEPOSIT_AMOUNT);
        await deposit(bob, vault, DEPOSIT_AMOUNT);

        let mintedSharesAliceAfter = await vault.balanceOf(alice.address);
        let assetBalanceAliceAfter = await vault.convertToAssets(
          mintedSharesAliceAfter
        );

        let mintedSharesBobAfter = await vault.balanceOf(bob.address);
        let assetBalanceBobAfter = await vault.convertToAssets(
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
      }
    });
  });

  describe('withdraw', async () => {
    it('Should withdraw assets', async () => {
      for (const { vault, asset } of vaultAssetPairs) {
        await deposit(alice, vault, DEPOSIT_AMOUNT);

        await moveTime(60); // Move 60 seconds
        await moveBlocks(3); // Move 3 blocks

        let maxWithdrawable = await vault.maxWithdraw(alice.address);
        let previousBalanceAlice = await asset.balanceOf(alice.address);
        await vault
          .connect(alice)
          .withdraw(maxWithdrawable, alice.address, alice.address);

        let afterBalanceAlice =
          previousBalanceAlice +
          maxWithdrawable -
          (maxWithdrawable * WITHDRAW_FEE_PERCENT) / PRECISION_CONSTANT;

        expect(await asset.balanceOf(alice.address)).to.equal(
          afterBalanceAlice
        );
      }
    });
  });

  describe('balances', async () => {
    it('Should get balances', async () => {
      for (const { vault } of vaultAssetPairs) {
        await deposit(alice, vault, DEPOSIT_AMOUNT);
        expect(await vault.totalAssets()).to.be.closeTo(
          DEPOSIT_AMOUNT + minAmount,
          DEPOSIT_AMOUNT / 1000n
        );
      }
    });
  });

  describe('interest rates', async () => {
    it('Should get interest rates', async () => {
      for (const { vault } of vaultAssetPairs) {
        await deposit(alice, vault, DEPOSIT_AMOUNT);
        let depositRate = await dforceProvider.getDepositRateFor(
          await vault.getAddress()
        );
        expect(depositRate).to.be.greaterThan(0);
      }
    });
  });
});
