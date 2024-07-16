import { ethers, network } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import {
  VaultRebalancerV2__factory,
  VaultRebalancerV2,
  ProviderManager__factory,
  ProviderManager,
  BenqiAvalanche__factory,
  BenqiAvalanche,
  IWETH,
  IERC20,
} from '../../../typechain-types';
import { setForkToAvalanche } from '../../../utils/set-fork';
import { impersonate } from '../../../utils/impersonate-account';
import { moveTime } from '../../../utils/move-time';
import { moveBlocks } from '../../../utils/move-blocks';

interface VaultAssetPair {
  vault: VaultRebalancerV2;
  asset: IERC20;
}

describe('BenqiAvalanche', async () => {
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
  let benqiProvider: BenqiAvalanche;

  let wethContract: IWETH; // Wrapped native token contract on Avalanche
  let daiContract: IERC20; // DAI contract on Avalanche

  let wavaxRebalancer: VaultRebalancerV2;
  let daiRebalancer: VaultRebalancerV2;

  let rebalancers: VaultAssetPair[];

  let WAVAX: string; // WETH address on Avalanche
  let DAI: string; // DAI address on Avalanche
  let qiAVAX: string; // qiAvax address on Avalanche
  let qiDAI: string; // qiDAI address on Avalanche

  async function deployVaultRebalancer(
    asset: string,
    name: string,
    symbol: string
  ) {
    return await new VaultRebalancerV2__factory(deployer).deploy(
      deployer.address,
      asset,
      name,
      symbol,
      [await benqiProvider.getAddress()],
      userDepositLimit,
      vaultDepositLimit,
      withdrawFeePercent,
      deployer.address
    );
  }

  before(async () => {
    [deployer, alice, bob] = await ethers.getSigners();

    holderAddress = '0xC882b111A75C0c657fC507C04FbFcD2cC984F071';

    WAVAX = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
    DAI = '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70';
    qiAVAX = '0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c';
    qiDAI = '0x835866d37AFB8CB8F8334dCCdaf66cf01832Ff5D';

    PRECISION_CONSTANT = ethers.parseEther('1');

    minAmount = ethers.parseEther('0.01'); // NOTE: 0.01 is min amount for now
    depositAmount = ethers.parseEther('1');

    withdrawFeePercent = ethers.parseEther('0.001'); // 0.1%

    userDepositLimit = ethers.parseEther('100000000000'); // 100 billion
    vaultDepositLimit = ethers.parseEther('200000000000'); // 200 billion
  });

  beforeEach(async () => {
    await setForkToAvalanche();

    holder = await impersonate(holderAddress);

    wethContract = await ethers.getContractAt('IWETH', WAVAX);
    daiContract = await ethers.getContractAt('IERC20', DAI);

    // Set up WAVAX balances for deployer, alice and bob
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
    await providerManager.setProtocolToken('Benqi_Avalanche', WAVAX, qiAVAX);
    await providerManager.setProtocolToken('Benqi_Avalanche', DAI, qiDAI);

    benqiProvider = await new BenqiAvalanche__factory(deployer).deploy(
      await providerManager.getAddress()
    );

    wavaxRebalancer = await deployVaultRebalancer(
      WAVAX,
      'Rebalance tWAVAX',
      'rtWAVAX'
    );
    daiRebalancer = await deployVaultRebalancer(DAI, 'Rebalance tDAI', 'rtDAI');
    rebalancers = [
      { vault: wavaxRebalancer, asset: wethContract },
      { vault: daiRebalancer, asset: daiContract },
    ];

    Promise.all([
      wethContract
        .connect(deployer)
        .approve(await wavaxRebalancer.getAddress(), minAmount),
      wethContract
        .connect(alice)
        .approve(await wavaxRebalancer.getAddress(), depositAmount),
      wethContract
        .connect(bob)
        .approve(await wavaxRebalancer.getAddress(), depositAmount),
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
      for (const { vault } of rebalancers) {
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
      for (const { vault, asset } of rebalancers) {
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
      await wavaxRebalancer
        .connect(alice)
        .deposit(depositAmount, alice.address);
      expect(await wavaxRebalancer.totalAssets()).to.be.closeTo(
        depositAmount + minAmount,
        depositAmount / 1000n
      );
    });
  });

  describe('interest rates', async () => {
    it('Should get interest rates', async () => {
      await wavaxRebalancer
        .connect(alice)
        .deposit(depositAmount, alice.address);
      let depositRate = await benqiProvider.getDepositRateFor(
        await wavaxRebalancer.getAddress()
      );
      expect(depositRate).to.be.greaterThan(0);
    });
  });
});
