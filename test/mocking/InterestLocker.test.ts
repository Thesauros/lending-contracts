import { ethers } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import {
  MockERC20__factory,
  MockERC20,
  InterestLocker__factory,
  InterestLocker,
} from '../../typechain-types';
import { ASSET_DECIMALS } from '../../utils/test-config';
import { moveTime } from '../../utils/move-time';

describe('InterestLocker', async () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let testTokenA: MockERC20;
  let testTokenB: MockERC20;

  let interestLocker: InterestLocker;

  let lockAmountA: bigint;
  let lockAmountB: bigint;
  let lockIdA: bigint;
  let lockIdB: bigint;
  let lockDuration: number;

  before(async () => {
    [deployer, alice, bob] = await ethers.getSigners();

    lockAmountA = ethers.parseEther('100');
    lockAmountB = ethers.parseEther('200');
    lockIdA = 0n;
    lockIdB = 1n;

    lockDuration = 30 * 86400; // 30 days
  });

  beforeEach(async () => {
    testTokenA = await new MockERC20__factory(deployer).deploy(
      'Rebalance tWETH',
      'rtWETH',
      ASSET_DECIMALS
    );
    testTokenB = await new MockERC20__factory(deployer).deploy(
      'Rebalance tDAI',
      'rtDAI',
      ASSET_DECIMALS
    );

    await testTokenA.mint(alice.address, ethers.parseEther('1000'));
    await testTokenB.mint(alice.address, ethers.parseEther('1000'));

    interestLocker = await new InterestLocker__factory(deployer).deploy([
      await testTokenA.getAddress(),
      await testTokenB.getAddress(),
    ]);

    await testTokenA
      .connect(alice)
      .approve(interestLocker.getAddress(), ethers.MaxUint256);
    await testTokenB
      .connect(alice)
      .approve(interestLocker.getAddress(), ethers.MaxUint256);
  });

  describe('constructor', async () => {
    it('Should set correct values', async () => {
      expect((await interestLocker.getTokens())[0]).to.equal(
        await testTokenA.getAddress()
      );
      expect((await interestLocker.getTokens())[1]).to.equal(
        await testTokenB.getAddress()
      );
    });
  });

  describe('lockTokens', async () => {
    let anotherToken: MockERC20;

    before(async () => {
      anotherToken = await new MockERC20__factory(deployer).deploy(
        'Test Token',
        'TestToken',
        ASSET_DECIMALS
      );
    });
    it('Should revert when token amount is zero', async () => {
      await expect(
        interestLocker
          .connect(alice)
          .lockTokens(await testTokenA.getAddress(), 0, lockDuration)
      ).to.be.revertedWithCustomError(
        interestLocker,
        'InterestLocker__InvalidTokenAmount'
      );
    });
    it('Should revert when token address is not supported', async () => {
      await expect(
        interestLocker
          .connect(alice)
          .lockTokens(
            await anotherToken.getAddress(),
            lockAmountA,
            lockDuration
          )
      ).to.be.revertedWithCustomError(
        interestLocker,
        'InterestLocker__TokenNotSupported'
      );
    });
    it('Should revert when lock duration is invalid', async () => {
      let invalidLockDuration = 29 * 86400; // 29 days
      await expect(
        interestLocker
          .connect(alice)
          .lockTokens(
            await testTokenA.getAddress(),
            lockAmountA,
            invalidLockDuration
          )
      ).to.be.revertedWithCustomError(
        interestLocker,
        'InterestLocker__InvalidDuration'
      );
    });
    it('Should lock tokens', async () => {
      let previousBalanceA = await testTokenA.balanceOf(alice.address);
      let previousBalanceB = await testTokenB.balanceOf(alice.address);

      // @ts-ignore: Object is possibly 'null'.
      let timestamp = (await ethers.provider.getBlock('latest')).timestamp;

      let tx1 = await interestLocker
        .connect(alice)
        .lockTokens(await testTokenA.getAddress(), lockAmountA, lockDuration);
      let tx2 = await interestLocker
        .connect(alice)
        .lockTokens(await testTokenB.getAddress(), lockAmountB, lockDuration);

      let lockInfoA = await interestLocker.lockInfo(lockIdA);
      let lockInfoB = await interestLocker.lockInfo(lockIdB);

      expect(await testTokenA.balanceOf(alice.address)).to.equal(
        previousBalanceA - lockAmountA
      );
      expect(await testTokenB.balanceOf(alice.address)).to.equal(
        previousBalanceB - lockAmountB
      );

      expect(
        await interestLocker.getTotalLocked(await testTokenA.getAddress())
      ).to.equal(lockAmountA);
      expect(
        await interestLocker.getTotalLocked(await testTokenB.getAddress())
      ).to.equal(lockAmountB);

      expect(await interestLocker.getBeneficiary(lockIdA)).to.equal(
        alice.address
      );
      expect(await interestLocker.getBeneficiary(lockIdA)).to.equal(
        alice.address
      );

      expect(lockInfoA.token).to.equal(await testTokenA.getAddress());
      expect(lockInfoA.amount).to.equal(lockAmountA);
      expect(lockInfoA.duration).to.equal(lockDuration);
      expect(lockInfoA.unlockTime).to.be.closeTo(timestamp + lockDuration, 10n);

      expect(lockInfoB.token).to.equal(await testTokenB.getAddress());
      expect(lockInfoB.amount).to.equal(lockAmountB);
      expect(lockInfoB.duration).to.equal(lockDuration);
      expect(lockInfoB.unlockTime).to.be.closeTo(timestamp + lockDuration, 10n);

      await expect(tx1)
        .to.emit(interestLocker, 'TokensLocked')
        .withArgs(
          lockIdA,
          alice.address,
          await testTokenA.getAddress(),
          lockAmountA,
          lockDuration
        );
      await expect(tx2)
        .to.emit(interestLocker, 'TokensLocked')
        .withArgs(
          lockIdB,
          alice.address,
          await testTokenB.getAddress(),
          lockAmountB,
          lockDuration
        );
    });
  });

  describe('unlockTokens', async () => {
    beforeEach(async () => {
      await interestLocker
        .connect(alice)
        .lockTokens(await testTokenA.getAddress(), lockAmountA, lockDuration);
      await interestLocker
        .connect(alice)
        .lockTokens(await testTokenB.getAddress(), lockAmountB, lockDuration);
    });
    it('Should revert when caller is invalid', async () => {
      await expect(
        interestLocker.connect(bob).unlockTokens(lockIdA)
      ).to.be.revertedWithCustomError(
        interestLocker,
        'InterestLocker__NotAuthorized'
      );
    });
    it('Should revert when not enough time passed', async () => {
      await expect(
        interestLocker.connect(alice).unlockTokens(lockIdA)
      ).to.be.revertedWithCustomError(
        interestLocker,
        'InterestLocker__TooSoonToUnlock'
      );
    });
    it('Should unlock tokens', async () => {
      await moveTime(lockDuration);

      let previousBalanceA = await testTokenA.balanceOf(alice.address);
      let previousBalanceB = await testTokenB.balanceOf(alice.address);

      let tx1 = await interestLocker.connect(alice).unlockTokens(lockIdA);
      let tx2 = await interestLocker.connect(alice).unlockTokens(lockIdB);

      let lockInfoA = await interestLocker.lockInfo(lockIdA);
      let lockInfoB = await interestLocker.lockInfo(lockIdB);

      expect(await testTokenA.balanceOf(alice.address)).to.equal(
        previousBalanceA + lockAmountA
      );
      expect(await testTokenB.balanceOf(alice.address)).to.equal(
        previousBalanceB + lockAmountB
      );

      expect(
        await interestLocker.getTotalLocked(await testTokenA.getAddress())
      ).to.equal(0);
      expect(
        await interestLocker.getTotalLocked(await testTokenB.getAddress())
      ).to.equal(0);

      expect(lockInfoA.amount).to.equal(0);
      expect(lockInfoB.amount).to.equal(0);
      expect(await interestLocker.getBeneficiary(lockIdA)).to.equal(
        ethers.ZeroAddress
      );
      expect(await interestLocker.getBeneficiary(lockIdB)).to.equal(
        ethers.ZeroAddress
      );

      await expect(tx1)
        .to.emit(interestLocker, 'TokensUnlocked')
        .withArgs(
          lockIdA,
          alice.address,
          await testTokenA.getAddress(),
          lockAmountA
        );
      await expect(tx2)
        .to.emit(interestLocker, 'TokensUnlocked')
        .withArgs(
          lockIdB,
          alice.address,
          await testTokenB.getAddress(),
          lockAmountB
        );
    });
  });

  describe('setTokens', async () => {
    let anotherToken: MockERC20;

    beforeEach(async () => {
      anotherToken = await new MockERC20__factory(deployer).deploy(
        'Test Token',
        'TestToken',
        ASSET_DECIMALS
      );
    });
    it('Should revert when caller is not the owner', async () => {
      await expect(
        interestLocker
          .connect(alice)
          .setTokens([await anotherToken.getAddress()])
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it('Should revert when token address is invalid', async () => {
      await expect(
        interestLocker.setTokens([
          await anotherToken.getAddress(),
          ethers.ZeroAddress,
        ])
      ).to.be.revertedWithCustomError(
        interestLocker,
        'InterestLocker__AddressZero'
      );
    });
    it('Should set tokens', async () => {
      let tx = await interestLocker.setTokens([
        await anotherToken.getAddress(),
      ]);

      expect((await interestLocker.getTokens())[0]).to.equal(
        await anotherToken.getAddress()
      );

      await expect(tx)
        .to.emit(interestLocker, 'TokensChanged')
        .withArgs([await anotherToken.getAddress()]);
    });
  });
});
