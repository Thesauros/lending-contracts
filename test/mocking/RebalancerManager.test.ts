import { ethers } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import {
  MockERC20__factory,
  MockERC20,
  VaultRebalancer__factory,
  VaultRebalancer,
  MockProviderA__factory,
  MockProviderA,
  MockProviderB__factory,
  MockProviderB,
  RebalancerManager__factory,
  RebalancerManager,
} from '../../typechain-types';

describe('RebalancerManager', async () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let charlie: SignerWithAddress;

  let MAX_REBALANCE_FEE: bigint;
  let PRECISION_CONSTANT: bigint;

  let initAmount: bigint;
  let withdrawFeePercent: bigint;
  let depositAmount: bigint;

  let userDepositLimit: bigint;
  let vaultDepositLimit: bigint;

  let assetDecimals: bigint;

  let mainAsset: MockERC20; // testUSDC
  let providerA: MockProviderA;
  let providerB: MockProviderB;

  let vaultRebalancer: VaultRebalancer;
  let rebalancerManager: RebalancerManager;

  before(async () => {
    [deployer, alice, bob, charlie] = await ethers.getSigners();

    PRECISION_CONSTANT = ethers.parseEther('1');
    MAX_REBALANCE_FEE = ethers.parseEther('0.2'); // 20%

    initAmount = ethers.parseUnits('1', 6);
    withdrawFeePercent = ethers.parseEther('0.001'); // 0.1%
    depositAmount = ethers.parseUnits('1000', 6);

    userDepositLimit = ethers.parseUnits('1000', 6);
    vaultDepositLimit = ethers.parseUnits('3000', 6) + initAmount;

    assetDecimals = 6n;
  });

  beforeEach(async () => {
    mainAsset = await new MockERC20__factory(deployer).deploy(
      'testUSDC',
      'tUSDC',
      assetDecimals
    );

    await mainAsset.mint(deployer.address, depositAmount + initAmount);
    await mainAsset.mint(alice.address, depositAmount);
    await mainAsset.mint(bob.address, depositAmount);
    await mainAsset.mint(charlie.address, depositAmount);

    providerA = await new MockProviderA__factory(deployer).deploy();
    providerB = await new MockProviderB__factory(deployer).deploy();

    rebalancerManager = await new RebalancerManager__factory(deployer).deploy();
    // Executor is the deployer for testing purposes
    await rebalancerManager.allowExecutor(deployer.address, true);

    vaultRebalancer = await new VaultRebalancer__factory(deployer).deploy(
      await mainAsset.getAddress(),
      await rebalancerManager.getAddress(),
      'Rebalance tUSDC',
      'rtUSDC',
      [await providerA.getAddress(), await providerB.getAddress()],
      userDepositLimit,
      vaultDepositLimit,
      withdrawFeePercent,
      deployer.address
    );
    await mainAsset.approve(await vaultRebalancer.getAddress(), initAmount);
    await vaultRebalancer.initializeVaultShares(initAmount);

    await mainAsset
      .connect(alice)
      .approve(await vaultRebalancer.getAddress(), ethers.MaxUint256);
    await mainAsset
      .connect(bob)
      .approve(await vaultRebalancer.getAddress(), ethers.MaxUint256);
    await mainAsset
      .connect(charlie)
      .approve(await vaultRebalancer.getAddress(), ethers.MaxUint256);

    await vaultRebalancer.connect(alice).deposit(depositAmount, alice.address);
    await vaultRebalancer.connect(bob).deposit(depositAmount, bob.address);
    await vaultRebalancer
      .connect(charlie)
      .deposit(depositAmount, charlie.address);
  });

  describe('rebalanceVault', async () => {
    it('Should revert when executor is invalid', async () => {
      await expect(
        rebalancerManager
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
        rebalancerManager,
        'RebalancerManager__InvalidExecutor'
      );
    });
    it('Should revert when the amounts are invalid', async () => {
      await expect(
        rebalancerManager.rebalanceVault(
          await vaultRebalancer.getAddress(),
          0,
          await providerA.getAddress(),
          await providerB.getAddress(),
          0,
          true
        )
      ).to.be.revertedWithCustomError(
        rebalancerManager,
        'RebalancerManager__InvalidRebalanceAmount'
      );
    });
    it('Should revert when the assets amount is invalid', async () => {
      let invalidAmount = 4n * depositAmount;
      await expect(
        rebalancerManager.rebalanceVault(
          await vaultRebalancer.getAddress(),
          invalidAmount,
          await providerA.getAddress(),
          await providerB.getAddress(),
          0,
          true
        )
      ).to.be.revertedWithCustomError(
        rebalancerManager,
        'RebalancerManager__InvalidAssetAmount'
      );
    });
    it('Should partially rebalance the vault', async () => {
      let assetsAliceAndBob = 2n * depositAmount;

      let assetsCharlie =
        depositAmount + (await vaultRebalancer.convertToAssets(initAmount));

      await rebalancerManager.rebalanceVault(
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
      let assetsAll = 3n * depositAmount + initAmount; // alice, bob, charlie

      await rebalancerManager.rebalanceVault(
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
      let assetsAll = 3n * depositAmount + initAmount; // alice, bob, charlie

      let rebalanceFee = (assetsAll * MAX_REBALANCE_FEE) / PRECISION_CONSTANT;

      let previousBalanceTreasury = await mainAsset.balanceOf(deployer.address);

      await rebalancerManager.rebalanceVault(
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

  describe('allowExecutor', async () => {
    it('Should revert when called by non-admin', async () => {
      await expect(
        rebalancerManager.connect(alice).allowExecutor(alice.address, true)
      ).to.be.revertedWithCustomError(
        rebalancerManager,
        'ProtocolAccessControl__CallerIsNotAdmin'
      );
    });
    it('Should revert when executor is invalid', async () => {
      await expect(
        rebalancerManager.allowExecutor(ethers.ZeroAddress, true)
      ).to.be.revertedWithCustomError(
        rebalancerManager,
        'RebalancerManager__AddressZero'
      );
    });
    it('Should revert when executor is already allowed', async () => {
      await expect(
        rebalancerManager.allowExecutor(deployer.address, true)
      ).to.be.revertedWithCustomError(
        rebalancerManager,
        'RebalancerManager__ExecutorAlreadyAllowed'
      );
    });
    it('Should allow the executor', async () => {
      let tx = await rebalancerManager.allowExecutor(alice.address, true);
      expect(await rebalancerManager.allowedExecutor(alice.address)).to.equal(
        true
      );
      // Should emit AllowExecutor event
      await expect(tx)
        .to.emit(rebalancerManager, 'AllowExecutor')
        .withArgs(alice.address, true);
    });
  });
});
