import { ethers } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import {
  MockERC20__factory,
  MockERC20,
  VaultRebalancerV2,
  MockProviderA__factory,
  MockProviderA,
  MockProviderB__factory,
  MockProviderB,
  VaultManager__factory,
  VaultManager,
} from '../../typechain-types';
import {
  deployVault,
  deposit,
  PRECISION_CONSTANT,
  MAX_REBALANCE_FEE,
  DEPOSIT_AMOUNT,
  DEFAULT_ADMIN_ROLE,
  EXECUTOR_ROLE,
  ASSET_DECIMALS,
} from '../../utils/helper';

describe('VaultManager', async () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let charlie: SignerWithAddress;

  let mainAsset: MockERC20; // testWETH
  let providerA: MockProviderA;
  let providerB: MockProviderB;

  let vaultRebalancer: VaultRebalancerV2;
  let vaultManager: VaultManager;

  let minAmount: bigint;

  before(async () => {
    [deployer, alice, bob, charlie] = await ethers.getSigners();

    minAmount = ethers.parseUnits('1', 6);
  });

  beforeEach(async () => {
    mainAsset = await new MockERC20__factory(deployer).deploy(
      'testWETH',
      'tWETH',
      ASSET_DECIMALS
    );

    await Promise.all([
      mainAsset.mint(deployer.address, DEPOSIT_AMOUNT + minAmount),
      mainAsset.mint(alice.address, DEPOSIT_AMOUNT),
      mainAsset.mint(bob.address, DEPOSIT_AMOUNT),
      mainAsset.mint(charlie.address, DEPOSIT_AMOUNT),
    ]);

    providerA = await new MockProviderA__factory(deployer).deploy();
    providerB = await new MockProviderB__factory(deployer).deploy();

    // Executor is the deployer for testing purposes
    vaultManager = await new VaultManager__factory(deployer).deploy(
      deployer.address,
      deployer.address
    );

    vaultRebalancer = await deployVault(
      deployer,
      await mainAsset.getAddress(),
      'Rebalance tWETH',
      'rtWETH',
      [await providerA.getAddress(), await providerB.getAddress()],
      await vaultManager.getAddress()
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
      await deposit(alice, vaultRebalancer, DEPOSIT_AMOUNT),
      await deposit(bob, vaultRebalancer, DEPOSIT_AMOUNT),
      await deposit(charlie, vaultRebalancer, DEPOSIT_AMOUNT),
    ]);
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
      let invalidAmount = 4n * DEPOSIT_AMOUNT;
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
      let assetsAliceAndBob = 2n * DEPOSIT_AMOUNT;

      let assetsCharlie =
        DEPOSIT_AMOUNT + (await vaultRebalancer.convertToAssets(minAmount));

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
      let assetsAll = 3n * DEPOSIT_AMOUNT + minAmount; // alice, bob, charlie

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
      let assetsAll = 3n * DEPOSIT_AMOUNT + minAmount; // alice, bob, charlie

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
