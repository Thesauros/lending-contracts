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
import {
  getHashTypedData,
  getStructHash,
  signMessage,
} from '../../utils/signature-helper';
import {
  deployVault,
  deposit,
  ASSET_DECIMALS,
  DEPOSIT_AMOUNT,
  PRECISION_CONSTANT,
  WITHDRAW_FEE_PERCENT,
} from '../../utils/test-config';
import { moveTime } from '../../utils/move-time';

describe('VaultPermit', async () => {
  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let spender: SignerWithAddress;
  let operator: SignerWithAddress;

  let mainAsset: MockERC20; // testWETH
  let providerA: MockProviderA;
  let vaultRebalancer: VaultRebalancerV2;

  let minAmount: bigint;
  let approveAmount: bigint;

  before(async () => {
    [deployer, owner, spender, operator] = await ethers.getSigners();

    minAmount = ethers.parseUnits('1', 6);
    approveAmount = ethers.parseEther('0.5');
  });

  beforeEach(async () => {
    mainAsset = await new MockERC20__factory(deployer).deploy(
      'testWETH',
      'tWETH',
      ASSET_DECIMALS
    );

    await mainAsset.mint(deployer.address, minAmount);
    await mainAsset.mint(owner.address, DEPOSIT_AMOUNT);

    providerA = await new MockProviderA__factory(deployer).deploy();

    vaultRebalancer = await deployVault(
      deployer,
      await mainAsset.getAddress(),
      'Rebalance tWETH',
      'rtWETH',
      [await providerA.getAddress()]
    );

    await mainAsset.approve(await vaultRebalancer.getAddress(), minAmount);
    await mainAsset
      .connect(owner)
      .approve(await vaultRebalancer.getAddress(), DEPOSIT_AMOUNT);

    await vaultRebalancer.initializeVaultShares(minAmount);
  });

  describe('permit', async () => {
    async function createPermit() {
      // @ts-ignore: Object is possibly 'null'.
      const timestamp = (await ethers.provider.getBlock('latest')).timestamp;
      return {
        owner: owner.address,
        spender: spender.address,
        value: approveAmount,
        nonce: await vaultRebalancer.nonces(owner.address),
        deadline: timestamp + 86400,
      };
    }

    async function signPermit(permit: any) {
      const digest = await getHashTypedData(
        await vaultRebalancer.DOMAIN_SEPARATOR(),
        await getStructHash(permit)
      );
      return signMessage(owner, digest);
    }

    it('Should revert when the signature is invalid', async () => {
      await deposit(owner, vaultRebalancer, DEPOSIT_AMOUNT);

      const permit = await createPermit();
      const { v, r, s } = await signPermit(permit);

      // invalid owner
      await expect(
        vaultRebalancer
          .connect(operator)
          .permit(
            operator.address,
            spender.address,
            approveAmount,
            permit.deadline,
            v,
            r,
            s
          )
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'VaultPermit__InvalidSignature'
      );
      // invalid spender
      await expect(
        vaultRebalancer
          .connect(operator)
          .permit(
            owner.address,
            operator.address,
            approveAmount,
            permit.deadline,
            v,
            r,
            s
          )
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'VaultPermit__InvalidSignature'
      );
      // invalid amount
      await expect(
        vaultRebalancer
          .connect(operator)
          .permit(
            owner.address,
            spender.address,
            approveAmount + 1n,
            permit.deadline,
            v,
            r,
            s
          )
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'VaultPermit__InvalidSignature'
      );
      // invalid deadline
      await expect(
        vaultRebalancer
          .connect(operator)
          .permit(
            owner.address,
            spender.address,
            approveAmount,
            permit.deadline + 1,
            v,
            r,
            s
          )
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'VaultPermit__InvalidSignature'
      );
    });
    it('Should revert when the deadline is expired', async () => {
      await deposit(owner, vaultRebalancer, DEPOSIT_AMOUNT);

      const permit = await createPermit();
      const { v, r, s } = await signPermit(permit);

      await moveTime(86401);

      await expect(
        vaultRebalancer
          .connect(operator)
          .permit(
            owner.address,
            spender.address,
            approveAmount,
            permit.deadline,
            v,
            r,
            s
          )
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'VaultPermit__ExpiredDeadline'
      );
    });
    it('Should redeem with permit', async () => {
      let previousBalanceSpender = await mainAsset.balanceOf(spender.address);

      await deposit(owner, vaultRebalancer, DEPOSIT_AMOUNT);

      const permit = await createPermit();
      const { v, r, s } = await signPermit(permit);

      await vaultRebalancer
        .connect(operator)
        .permit(
          owner.address,
          spender.address,
          approveAmount,
          permit.deadline,
          v,
          r,
          s
        );

      expect(
        await vaultRebalancer.allowance(owner.address, spender.address)
      ).to.equal(approveAmount);

      await vaultRebalancer
        .connect(spender)
        .redeem(approveAmount, spender.address, owner.address);

      let expectedAmount =
        previousBalanceSpender +
        approveAmount -
        (approveAmount * WITHDRAW_FEE_PERCENT) / PRECISION_CONSTANT;

      expect(await mainAsset.balanceOf(spender.address)).to.equal(
        expectedAmount
      );
    });
  });
});
