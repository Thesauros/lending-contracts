import { ethers } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import {
  VaultRebalancerV2,
  ProviderManager__factory,
  ProviderManager,
  BenqiAvalanche__factory,
  BenqiAvalanche,
  IWETH,
  IERC20,
} from '../../../typechain-types';
import { setForkToAvalanche } from '../../../utils/set-fork';
import {
  deployVault,
  deposit,
  withdraw,
  VaultAssetPair,
  benqiPairs,
  avaxTokenAddresses,
  PRECISION_CONSTANT,
  WITHDRAW_FEE_PERCENT,
  DEPOSIT_AMOUNT,
} from '../../../utils/helper-config';
import { impersonate } from '../../../utils/impersonate-account';
import { moveTime } from '../../../utils/move-time';
import { moveBlocks } from '../../../utils/move-blocks';

describe('BenqiAvalanche', async () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let holder: SignerWithAddress;

  let holderAddress: string;
  let wavaxAddress: string;
  let daiAddress: string;
  let qiWavaxAddress: string;
  let qiDaiAddress: string;

  let wavaxContract: IWETH;
  let daiContract: IERC20;
  let providerManager: ProviderManager;
  let benqiProvider: BenqiAvalanche;
  let wavaxRebalancer: VaultRebalancerV2;
  let daiRebalancer: VaultRebalancerV2;

  let vaultAssetPairs: VaultAssetPair[];

  let minAmount: bigint;

  before(async () => {
    [deployer, alice, bob] = await ethers.getSigners();

    holderAddress = '0xC882b111A75C0c657fC507C04FbFcD2cC984F071';

    wavaxAddress = avaxTokenAddresses.wavax;
    daiAddress = avaxTokenAddresses.bridgedDai;
    qiWavaxAddress = benqiPairs.wavax;
    qiDaiAddress = benqiPairs.bridgedDai;

    minAmount = ethers.parseEther('0.0001');
  });

  beforeEach(async () => {
    await setForkToAvalanche();

    holder = await impersonate(holderAddress);

    wavaxContract = await ethers.getContractAt('IWETH', wavaxAddress);
    daiContract = await ethers.getContractAt('IERC20', daiAddress);

    // Set up WAVAX balances for deployer, alice and bob
    Promise.all([
      wavaxContract.connect(deployer).deposit({ value: minAmount }),
      wavaxContract.connect(alice).deposit({ value: DEPOSIT_AMOUNT }),
      wavaxContract.connect(bob).deposit({ value: DEPOSIT_AMOUNT }),
      daiContract.connect(holder).transfer(deployer.address, minAmount),
      daiContract.connect(holder).transfer(alice.address, DEPOSIT_AMOUNT),
      daiContract.connect(holder).transfer(bob.address, DEPOSIT_AMOUNT),
    ]);

    providerManager = await new ProviderManager__factory(deployer).deploy();

    // Set up providerManager
    await providerManager.setProtocolToken(
      'Benqi_Avalanche',
      wavaxAddress,
      qiWavaxAddress
    );
    await providerManager.setProtocolToken(
      'Benqi_Avalanche',
      daiAddress,
      qiDaiAddress
    );

    benqiProvider = await new BenqiAvalanche__factory(deployer).deploy(
      await providerManager.getAddress()
    );

    wavaxRebalancer = await deployVault(
      deployer,
      wavaxAddress,
      'Rebalance tWAVAX',
      'rtWAVAX',
      [await benqiProvider.getAddress()]
    );
    daiRebalancer = await deployVault(
      deployer,
      daiAddress,
      'Rebalance tDAI',
      'rtDAI',
      [await benqiProvider.getAddress()]
    );
    vaultAssetPairs = [
      { vault: wavaxRebalancer, asset: wavaxContract },
      { vault: daiRebalancer, asset: daiContract },
    ];

    Promise.all([
      wavaxContract
        .connect(deployer)
        .approve(await wavaxRebalancer.getAddress(), minAmount),
      wavaxContract
        .connect(alice)
        .approve(await wavaxRebalancer.getAddress(), DEPOSIT_AMOUNT),
      wavaxContract
        .connect(bob)
        .approve(await wavaxRebalancer.getAddress(), DEPOSIT_AMOUNT),
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

    await wavaxRebalancer.connect(deployer).initializeVaultShares(minAmount);
    await daiRebalancer.connect(deployer).initializeVaultShares(minAmount);
  });

  describe('constructor', async () => {
    it('Should revert when the provider manager is invalid', async () => {
      await expect(
        new BenqiAvalanche__factory(deployer).deploy(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(
        benqiProvider,
        'BenqiAvalanche__AddressZero'
      );
    });
    it('Should initialize correctly', async () => {
      expect(await benqiProvider.getProviderManager()).to.equal(
        await providerManager.getAddress()
      );
    });
  });

  describe('getProviderName', async () => {
    it('Should get the provider name', async () => {
      expect(await benqiProvider.getProviderName()).to.equal('Benqi_Avalanche');
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

        await withdraw(alice, vault, maxWithdrawable);

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
        let depositRate = await benqiProvider.getDepositRateFor(
          await vault.getAddress()
        );
        expect(depositRate).to.be.greaterThan(0);
      }
    });
  });
});
