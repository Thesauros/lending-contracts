import { ethers } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import {
  MockERC20__factory,
  MockERC20,
  VaultRebalancerV2__factory,
  VaultRebalancerV2,
  MockProviderA__factory,
  MockProviderA,
  MockProviderB__factory,
  MockProviderB,
  VaultManager__factory,
  VaultManager,
} from '../../typechain-types';

describe('VaultManager', async () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let charlie: SignerWithAddress;

  let MAX_REBALANCE_FEE: bigint;
  let PRECISION_CONSTANT: bigint;

  let minAmount: bigint;
  let withdrawFeePercent: bigint;
  let depositAmount: bigint;

  let userDepositLimit: bigint;
  let vaultDepositLimit: bigint;

  let assetDecimals: bigint;

  let mainAsset: MockERC20; // testUSDC
  let providerA: MockProviderA;
  let providerB: MockProviderB;

  let vaultRebalancer: VaultRebalancerV2;
  let vaultManager: VaultManager;

  let DEFAULT_ADMIN_ROLE: string;
  let EXECUTOR_ROLE: string;

  before(async () => {
    [deployer, alice, bob, charlie] = await ethers.getSigners();

    PRECISION_CONSTANT = ethers.parseEther('1');
    MAX_REBALANCE_FEE = ethers.parseEther('0.2'); // 20%

    minAmount = ethers.parseUnits('1', 6);
    withdrawFeePercent = ethers.parseEther('0.001'); // 0.1%
    depositAmount = ethers.parseUnits('1000', 6);

    userDepositLimit = ethers.parseUnits('1000', 6);
    vaultDepositLimit = ethers.parseUnits('3000', 6) + minAmount;

    assetDecimals = 6n;
  });

  beforeEach(async () => {
    mainAsset = await new MockERC20__factory(deployer).deploy(
      'testUSDC',
      'tUSDC',
      assetDecimals
    );

    await Promise.all([
      mainAsset.mint(deployer.address, depositAmount + minAmount),
      mainAsset.mint(alice.address, depositAmount),
      mainAsset.mint(bob.address, depositAmount),
      mainAsset.mint(charlie.address, depositAmount),
    ]);

    providerA = await new MockProviderA__factory(deployer).deploy();
    providerB = await new MockProviderB__factory(deployer).deploy();

    // Executor is the deployer for testing purposes
    vaultManager = await new VaultManager__factory(deployer).deploy(
      deployer.address,
      deployer.address
    );

    vaultRebalancer = await new VaultRebalancerV2__factory(deployer).deploy(
      await vaultManager.getAddress(),
      await mainAsset.getAddress(),
      'Rebalance tUSDC',
      'rtUSDC',
      [await providerA.getAddress(), await providerB.getAddress()],
      userDepositLimit,
      vaultDepositLimit,
      withdrawFeePercent,
      deployer.address
    );

    await Promise.all([
      mainAsset
        .connect(deployer)
        .approve(await vaultRebalancer.getAddress(), ethers.MaxInt256),
      mainAsset
        .connect(alice)
        .approve(await vaultRebalancer.getAddress(), ethers.MaxUint256),
      mainAsset
        .connect(bob)
        .approve(await vaultRebalancer.getAddress(), ethers.MaxUint256),
      mainAsset
        .connect(charlie)
        .approve(await vaultRebalancer.getAddress(), ethers.MaxUint256),
    ]);

    await vaultRebalancer.initializeVaultShares(minAmount);

    await Promise.all([
      vaultRebalancer.connect(alice).deposit(depositAmount, alice.address),
      vaultRebalancer.connect(bob).deposit(depositAmount, bob.address),
      vaultRebalancer.connect(charlie).deposit(depositAmount, charlie.address),
    ]);

    DEFAULT_ADMIN_ROLE = await vaultManager.DEFAULT_ADMIN_ROLE();
    EXECUTOR_ROLE = await vaultManager.EXECUTOR_ROLE();
  });

  describe('constructor', async () => {
    it('Should initialize correctly', async () => {
      expect(await vaultManager.hasRole(DEFAULT_ADMIN_ROLE, deployer.address))
        .to.be.true;
      expect(await vaultManager.hasRole(EXECUTOR_ROLE, deployer.address)).to.be
        .true;
    });
  });

  describe('rebalanceVault', async () => {
    it('Should revert when executor is invalid', async () => {
      await expect(
        vaultManager
          .connect(alice)
          .rebalanceVault(
            await vaultRebalancer.getAddress(),
            ethers.MaxUint256,
            await providerA.getAddress(),
            await providerB.getAddress(),
            0,
            true
          )
      ).to.be.revertedWithCustomError(
        vaultManager,
        'ProtocolAccessControl__CallerIsNotExecutor'
      );
    });
    it('Should revert when the rebalance amount is invalid', async () => {
      await expect(
        vaultManager.rebalanceVault(
          await vaultRebalancer.getAddress(),
          0,
          await providerA.getAddress(),
          await providerB.getAddress(),
          0,
          true
        )
      ).to.be.revertedWithCustomError(
        vaultManager,
        'VaultManager__InvalidAssetAmount'
      );
    });
    it('Should revert when the assets amount is invalid', async () => {
      let invalidAmount = 4n * depositAmount;
      await expect(
        vaultManager.rebalanceVault(
          await vaultRebalancer.getAddress(),
          invalidAmount,
          await providerA.getAddress(),
          await providerB.getAddress(),
          0,
          true
        )
      ).to.be.revertedWithCustomError(
        vaultManager,
        'VaultManager__InvalidAssetAmount'
      );
    });
    it('Should partially rebalance the vault', async () => {
      let assetsAliceAndBob = 2n * depositAmount;

      let assetsCharlie =
        depositAmount + (await vaultRebalancer.convertToAssets(minAmount));

      await vaultManager.rebalanceVault(
        await vaultRebalancer.getAddress(),
        assetsAliceAndBob,
        await providerA.getAddress(),
        await providerB.getAddress(),
        0,
        true
      );

      expect(
        await providerA.getDepositBalance(
          await vaultRebalancer.getAddress(),
          await vaultRebalancer.getAddress()
        )
      ).to.equal(assetsCharlie);
      expect(
        await providerB.getDepositBalance(
          await vaultRebalancer.getAddress(),
          await vaultRebalancer.getAddress()
        )
      ).to.equal(assetsAliceAndBob);
    });
    it('Should fully rebalance the vault when using max', async () => {
      let assetsAll = 3n * depositAmount + minAmount; // alice, bob, charlie

      await vaultManager.rebalanceVault(
        await vaultRebalancer.getAddress(),
        ethers.MaxUint256,
        await providerA.getAddress(),
        await providerB.getAddress(),
        0,
        true
      );
      expect(
        await providerA.getDepositBalance(
          await vaultRebalancer.getAddress(),
          await vaultRebalancer.getAddress()
        )
      ).to.equal(0);
      expect(
        await providerB.getDepositBalance(
          await vaultRebalancer.getAddress(),
          await vaultRebalancer.getAddress()
        )
      ).to.equal(assetsAll);
    });
    it('Should fully rebalance the vault', async () => {
      let assetsAll = 3n * depositAmount + minAmount; // alice, bob, charlie

      let rebalanceFee = (assetsAll * MAX_REBALANCE_FEE) / PRECISION_CONSTANT;

      let previousBalanceTreasury = await mainAsset.balanceOf(deployer.address);

      await vaultManager.rebalanceVault(
        await vaultRebalancer.getAddress(),
        assetsAll,
        await providerA.getAddress(),
        await providerB.getAddress(),
        rebalanceFee,
        true
      );
      expect(
        await providerA.getDepositBalance(
          await vaultRebalancer.getAddress(),
          await vaultRebalancer.getAddress()
        )
      ).to.equal(0);
      expect(
        await providerB.getDepositBalance(
          await vaultRebalancer.getAddress(),
          await vaultRebalancer.getAddress()
        )
      ).to.equal(assetsAll - rebalanceFee);

      expect(await mainAsset.balanceOf(deployer.address)).to.equal(
        previousBalanceTreasury + rebalanceFee
      );
    });
  });
});
