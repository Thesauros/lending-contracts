import { ethers } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import {
  VaultRebalancerV2__factory,
  VaultRebalancerV2,
  ProviderManager__factory,
  ProviderManager,
  DForceArbitrum__factory,
  DForceArbitrum,
  IERC20,
  IWETH,
} from '../../../typechain-types';
import { impersonate } from '../../../utils/impersonate-account';
import { moveTime } from '../../../utils/move-time';
import { moveBlocks } from '../../../utils/move-blocks';

interface VaultAssetPair {
  vault: VaultRebalancerV2;
  asset: IERC20;
}

describe('DForceArbitrum', async () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let holder: SignerWithAddress;

  let holderAddress: string;

  let PRECISION_CONSTANT: bigint;

  let minAmount: bigint;
  let depositAmount: bigint;

  let withdrawFeePercent: bigint;

  let userDepositLimit: bigint;
  let vaultDepositLimit: bigint;

  let providerManager: ProviderManager;
  let dforceProvider: DForceArbitrum;

  let wethContract: IWETH; // Wrapped native token contract on Arbitrum mainnet
  let daiContract: IERC20; // DAI contract on Arbitrum mainnet

  let wethRebalancer: VaultRebalancerV2;
  let daiRebalancer: VaultRebalancerV2;

  let vaultAssetPairs: VaultAssetPair[];

  let WETH: string; // WETH address on Arbitrum mainnet
  let DAI: string; // DAI address on Arbitrum mainnet
  let iETH: string; // DForce iETH address on Arbitrum mainnet
  let iDAI: string; // DForce iDAI address on Arbitrum mainnet

  async function deployVaultRebalancer(
    asset: string,
    name: string,
    symbol: string
  ) {
    // Treasury and Rebalancer is the deployer for testing purposes.
    return await new VaultRebalancerV2__factory(deployer).deploy(
      deployer.address,
      asset,
      name,
      symbol,
      [await dforceProvider.getAddress()],
      userDepositLimit,
      vaultDepositLimit,
      withdrawFeePercent,
      deployer.address
    );
  }

  before(async () => {
    [deployer, alice, bob] = await ethers.getSigners();

    holderAddress = '0xc2995BBD284953e8BA0b01eFE64535aC55cfcD9d';

    WETH = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';
    DAI = '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1';
    iETH = '0xEe338313f022caee84034253174FA562495dcC15';
    iDAI = '0xf6995955e4B0E5b287693c221f456951D612b628';

    PRECISION_CONSTANT = ethers.parseEther('1');

    minAmount = ethers.parseEther('0.0001');
    depositAmount = ethers.parseEther('1');

    withdrawFeePercent = ethers.parseEther('0.001'); // 0.1%

    userDepositLimit = ethers.parseEther('100000000000'); // 100 billion
    vaultDepositLimit = ethers.parseEther('200000000000'); // 200 billion
  });

  beforeEach(async () => {
    holder = await impersonate(holderAddress);

    wethContract = await ethers.getContractAt('IWETH', WETH);
    daiContract = await ethers.getContractAt('IERC20', DAI);

    // Set up token balances for deployer, alice and bob
    Promise.all([
      wethContract.connect(deployer).deposit({ value: minAmount }),
      wethContract.connect(alice).deposit({ value: depositAmount }),
      wethContract.connect(bob).deposit({ value: depositAmount }),
      daiContract.connect(holder).transfer(deployer.address, minAmount),
      daiContract.connect(holder).transfer(alice.address, depositAmount),
      daiContract.connect(holder).transfer(bob.address, depositAmount),
    ]);

    providerManager = await new ProviderManager__factory(deployer).deploy();

    // Set up providerManager
    await providerManager.setProtocolToken('DForce_Arbitrum', WETH, iETH);
    await providerManager.setProtocolToken('DForce_Arbitrum', DAI, iDAI);

    dforceProvider = await new DForceArbitrum__factory(deployer).deploy(
      await providerManager.getAddress()
    );

    wethRebalancer = await deployVaultRebalancer(
      WETH,
      'Rebalance tWETH',
      'rtWETH'
    );
    daiRebalancer = await deployVaultRebalancer(DAI, 'Rebalance tDAI', 'rtDAI');

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
        .approve(await wethRebalancer.getAddress(), depositAmount),
      wethContract
        .connect(bob)
        .approve(await wethRebalancer.getAddress(), depositAmount),
      daiContract
        .connect(deployer)
        .approve(await daiRebalancer.getAddress(), minAmount),
      daiContract
        .connect(alice)
        .approve(await daiRebalancer.getAddress(), depositAmount),
      daiContract
        .connect(bob)
        .approve(await daiRebalancer.getAddress(), depositAmount),
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

        await vault.connect(alice).deposit(depositAmount, alice.address);
        await vault.connect(bob).deposit(depositAmount, bob.address);

        let mintedSharesAliceAfter = await vault.balanceOf(alice.address);
        let assetBalanceAliceAfter = await vault.convertToAssets(
          mintedSharesAliceAfter
        );

        let mintedSharesBobAfter = await vault.balanceOf(bob.address);
        let assetBalanceBobAfter = await vault.convertToAssets(
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
      }
    });
  });

  describe('withdraw', async () => {
    it('Should withdraw assets', async () => {
      for (const { vault, asset } of vaultAssetPairs) {
        await vault.connect(alice).deposit(depositAmount, alice.address);

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
          (maxWithdrawable * withdrawFeePercent) / PRECISION_CONSTANT;

        expect(await asset.balanceOf(alice.address)).to.equal(
          afterBalanceAlice
        );
      }
    });
  });

  describe('balances', async () => {
    it('Should get balances', async () => {
      for (const { vault } of vaultAssetPairs) {
        await vault.connect(alice).deposit(depositAmount, alice.address);
        expect(await vault.totalAssets()).to.be.closeTo(
          depositAmount + minAmount,
          depositAmount / 1000n
        );
      }
    });
  });

  describe('interest rates', async () => {
    it('Should get interest rates', async () => {
      for (const { vault } of vaultAssetPairs) {
        await vault.connect(alice).deposit(depositAmount, alice.address);
        let depositRate = await dforceProvider.getDepositRateFor(
          await vault.getAddress()
        );
        expect(depositRate).to.be.greaterThan(0);
      }
    });
  });
});
