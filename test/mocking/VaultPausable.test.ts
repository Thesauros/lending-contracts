import { ethers } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import {
  MockERC20__factory,
  MockERC20,
  VaultRebalancerV2,
  MockProviderA__factory,
  MockProviderA,
} from '../../typechain-types';
import { deployVault, ASSET_DECIMALS } from '../../utils/helper-config';

describe('VaultPausable', async () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;

  let mainAsset: MockERC20; // testWETH
  let providerA: MockProviderA;
  let vaultRebalancer: VaultRebalancerV2;

  let minAmount: bigint;

  before(async () => {
    [deployer, alice] = await ethers.getSigners();

    minAmount = ethers.parseUnits('1', 6);
  });

  beforeEach(async () => {
    mainAsset = await new MockERC20__factory(deployer).deploy(
      'testWETH',
      'tWETH',
      ASSET_DECIMALS
    );
    await mainAsset.mint(deployer.address, minAmount);

    providerA = await new MockProviderA__factory(deployer).deploy();

    vaultRebalancer = await deployVault(
      deployer,
      await mainAsset.getAddress(),
      'Rebalance tWETH',
      'rtWETH',
      [await providerA.getAddress()]
    );
    await mainAsset.approve(await vaultRebalancer.getAddress(), minAmount);

    await vaultRebalancer.initializeVaultShares(minAmount);
  });

  describe('pause', async () => {
    it('Should revert when caller is invalid', async () => {
      await expect(
        vaultRebalancer.connect(alice).pause(0)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'ProtocolAccessControl__CallerIsNotAdmin'
      );
    });
    it('Should revert when action is already paused', async () => {
      await vaultRebalancer.pause(0);
      await expect(vaultRebalancer.pause(0)).to.be.revertedWithCustomError(
        vaultRebalancer,
        'VaultPausable__ActionPaused'
      );
    });
    it('Should pause actions', async () => {
      // 0. Deposit
      // 1. Withdraw
      let tx0 = await vaultRebalancer.pause(0);
      let tx1 = await vaultRebalancer.pause(1);

      expect(await vaultRebalancer.paused(0)).to.be.true;
      expect(await vaultRebalancer.paused(1)).to.be.true;

      await expect(tx0)
        .to.emit(vaultRebalancer, 'Paused')
        .withArgs(deployer.address, 0);
      await expect(tx1)
        .to.emit(vaultRebalancer, 'Paused')
        .withArgs(deployer.address, 1);
    });
  });

  describe('unpause', async () => {
    it('Should revert when caller is invalid', async () => {
      await expect(
        vaultRebalancer.connect(alice).unpause(0)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'ProtocolAccessControl__CallerIsNotAdmin'
      );
    });
    it('Should revert when action is not paused', async () => {
      await expect(vaultRebalancer.unpause(0)).to.be.revertedWithCustomError(
        vaultRebalancer,
        'VaultPausable__ActionNotPaused'
      );
    });
    it('Should unpause actions', async () => {
      // 0. Deposit
      // 1. Withdraw
      await vaultRebalancer.pause(0);
      await vaultRebalancer.pause(1);

      let tx0 = await vaultRebalancer.unpause(0);
      let tx1 = await vaultRebalancer.unpause(1);

      expect(await vaultRebalancer.paused(0)).to.be.false;
      expect(await vaultRebalancer.paused(1)).to.be.false;

      await expect(tx0)
        .to.emit(vaultRebalancer, 'Unpaused')
        .withArgs(deployer.address, 0);
      await expect(tx1)
        .to.emit(vaultRebalancer, 'Unpaused')
        .withArgs(deployer.address, 1);
    });
  });

  describe('pauseAll', async () => {
    it('Should revert when caller is invalid', async () => {
      await expect(
        vaultRebalancer.connect(alice).pauseAll()
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'ProtocolAccessControl__CallerIsNotAdmin'
      );
    });
    it('Should pause actions', async () => {
      // 0. Deposit
      // 1. Withdraw
      let tx = await vaultRebalancer.pauseAll();

      expect(await vaultRebalancer.paused(0)).to.be.true;
      expect(await vaultRebalancer.paused(1)).to.be.true;

      await expect(tx)
        .to.emit(vaultRebalancer, 'PausedAll')
        .withArgs(deployer.address);
    });
  });

  describe('unpauseAll', async () => {
    it('Should revert when caller is invalid', async () => {
      await expect(
        vaultRebalancer.connect(alice).unpauseAll()
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'ProtocolAccessControl__CallerIsNotAdmin'
      );
    });
    it('Should unpause actions', async () => {
      // 0. Deposit
      // 1. Withdraw
      await vaultRebalancer.pauseAll();
      let tx = await vaultRebalancer.unpauseAll();

      expect(await vaultRebalancer.paused(0)).to.be.false;
      expect(await vaultRebalancer.paused(1)).to.be.false;

      await expect(tx)
        .to.emit(vaultRebalancer, 'UnpausedAll')
        .withArgs(deployer.address);
    });
  });
});
