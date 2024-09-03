import { ethers } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { AccessManager, AccessManager__factory } from '../../typechain-types';

describe('AccessManager', async () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;

  let accessManager: AccessManager;

  let ROOT_UPDATER_ROLE: string;

  before(async () => {
    [deployer, alice] = await ethers.getSigners();

    ROOT_UPDATER_ROLE = ethers.id('ROOT_UPDATER_ROLE');
  });

  beforeEach(async () => {
    accessManager = await new AccessManager__factory(deployer).deploy();
  });

  describe('grantRole', async () => {
    it('Should revert when called by non-admin', async () => {
      await expect(
        accessManager.connect(alice).grantRole(ROOT_UPDATER_ROLE, alice.address)
      ).to.be.revertedWithCustomError(
        accessManager,
        'AccessManager__CallerIsNotAdmin'
      );
    });
    it('Should grant the role', async () => {
      const tx = await accessManager.grantRole(
        ROOT_UPDATER_ROLE,
        alice.address
      );

      expect(await accessManager.hasRole(ROOT_UPDATER_ROLE, alice.address)).to
        .be.true;
      await expect(tx)
        .to.emit(accessManager, 'RoleGranted')
        .withArgs(ROOT_UPDATER_ROLE, alice.address, deployer.address);
    });
    it('Should not emit an event if the role is already granted', async () => {
      await accessManager.grantRole(ROOT_UPDATER_ROLE, alice.address);
      const tx = await accessManager.grantRole(
        ROOT_UPDATER_ROLE,
        alice.address
      );

      await expect(tx).to.not.emit(accessManager, 'RoleGranted');
    });
  });

  describe('revokeRole', async () => {
    it('Should revert when called by non-admin', async () => {
      await expect(
        accessManager
          .connect(alice)
          .revokeRole(ROOT_UPDATER_ROLE, alice.address)
      ).to.be.revertedWithCustomError(
        accessManager,
        'AccessManager__CallerIsNotAdmin'
      );
    });
    it('Should revoke the role', async () => {
      await accessManager.grantRole(ROOT_UPDATER_ROLE, alice.address);
      const tx = await accessManager.revokeRole(
        ROOT_UPDATER_ROLE,
        alice.address
      );

      expect(await accessManager.hasRole(ROOT_UPDATER_ROLE, alice.address)).to
        .be.false;
      await expect(tx)
        .to.emit(accessManager, 'RoleRevoked')
        .withArgs(ROOT_UPDATER_ROLE, alice.address, deployer.address);
    });
    it('Should not emit an event if the role is already revoked', async () => {
      const tx = await accessManager.revokeRole(
        ROOT_UPDATER_ROLE,
        alice.address
      );

      await expect(tx).to.not.emit(accessManager, 'RoleRevoked');
    });
  });
});
