import { ethers } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import {
  MockERC20__factory,
  MockERC20,
  InterestLocker__factory,
  InterestLocker,
} from '../../typechain-types';

describe('InterestLocker', async () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let testTokenA: MockERC20;
  let testTokenB: MockERC20;

  let interestLocker: InterestLocker;

  let lockAmount: bigint;

  before(async () => {
    [deployer, alice, bob] = await ethers.getSigners();

    lockAmount = ethers.parseEther('100');
  });

  beforeEach(async () => {
    testTokenA = await new MockERC20__factory(deployer).deploy(
      'tRebalance USDT',
      'trUSDT',
      18
    );
    testTokenB = await new MockERC20__factory(deployer).deploy(
      'tRebalance USDC',
      'trUSDC',
      18
    );

    await testTokenA.mint(alice.address, ethers.parseEther('1000'));
    await testTokenA.mint(bob.address, ethers.parseEther('1000'));
    await testTokenB.mint(alice.address, ethers.parseEther('1000'));
    await testTokenB.mint(bob.address, ethers.parseEther('1000'));

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
    await testTokenA
      .connect(bob)
      .approve(interestLocker.getAddress(), ethers.MaxUint256);
    await testTokenB
      .connect(bob)
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

    beforeEach(async () => {
      anotherToken = await new MockERC20__factory(deployer).deploy(
        'Test Token',
        'TestToken',
        18
      );
    });
    it('Should revert when token amount is zero', async () => {
      await expect(
        interestLocker
          .connect(alice)
          .lockTokens(await testTokenA.getAddress(), 0)
      ).to.be.revertedWithCustomError(
        interestLocker,
        'InterestLocker__InvalidTokenAmount'
      );
    });
    it('Should revert when token address is not supported', async () => {
      await expect(
        interestLocker
          .connect(alice)
          .lockTokens(await anotherToken.getAddress(), lockAmount)
      ).to.be.revertedWithCustomError(
        interestLocker,
        'InterestLocker__TokenNotSupported'
      );
    });
    it('Should lock tokens', async () => {
      let previousBalanceAlice = await testTokenA.balanceOf(alice.address);
      let previousBalanceBob = await testTokenB.balanceOf(bob.address);

      let tx1 = await interestLocker
        .connect(alice)
        .lockTokens(await testTokenA.getAddress(), lockAmount);
      let tx2 = await interestLocker
        .connect(bob)
        .lockTokens(await testTokenB.getAddress(), lockAmount);

      expect(await testTokenA.balanceOf(alice.address)).to.equal(
        previousBalanceAlice - lockAmount
      );
      expect(await testTokenB.balanceOf(bob.address)).to.equal(
        previousBalanceBob - lockAmount
      );

      expect(
        await interestLocker.getTotalLocked(await testTokenA.getAddress())
      ).to.equal(lockAmount);
      expect(
        await interestLocker.getTotalLocked(await testTokenB.getAddress())
      ).to.equal(lockAmount);

      expect(
        await interestLocker.getAccountLocked(
          alice.address,
          await testTokenA.getAddress()
        )
      ).to.equal(lockAmount);
      expect(
        await interestLocker.getAccountLocked(
          bob.address,
          await testTokenB.getAddress()
        )
      ).to.equal(lockAmount);

      await expect(tx1)
        .to.emit(interestLocker, 'TokensLocked')
        .withArgs(alice.address, await testTokenA.getAddress(), lockAmount);
      await expect(tx2)
        .to.emit(interestLocker, 'TokensLocked')
        .withArgs(bob.address, await testTokenB.getAddress(), lockAmount);
    });
  });

  describe('unlockTokens', async () => {
    beforeEach(async () => {
      await interestLocker
        .connect(alice)
        .lockTokens(await testTokenA.getAddress(), lockAmount);
      await interestLocker
        .connect(bob)
        .lockTokens(await testTokenB.getAddress(), lockAmount);
    });
    it('Should revert when token amount is zero', async () => {
      await expect(
        interestLocker
          .connect(alice)
          .unlockTokens(await testTokenA.getAddress(), 0)
      ).to.be.revertedWithCustomError(
        interestLocker,
        'InterestLocker__InvalidTokenAmount'
      );
    });
    it('Should revert when token amount is invalid ', async () => {
      await expect(
        interestLocker
          .connect(alice)
          .unlockTokens(await testTokenA.getAddress(), lockAmount + 1n)
      ).to.be.revertedWithCustomError(
        interestLocker,
        'InterestLocker__NotEnoughLocked'
      );
    });
    it('Should unlock tokens', async () => {
      let previousBalanceAlice = await testTokenA.balanceOf(alice.address);
      let previousBalanceBob = await testTokenB.balanceOf(bob.address);

      let tx1 = await interestLocker
        .connect(alice)
        .unlockTokens(await testTokenA.getAddress(), lockAmount);
      let tx2 = await interestLocker
        .connect(bob)
        .unlockTokens(await testTokenB.getAddress(), lockAmount / 2n);

      expect(await testTokenA.balanceOf(alice.address)).to.equal(
        previousBalanceAlice + lockAmount
      );
      expect(await testTokenB.balanceOf(bob.address)).to.equal(
        previousBalanceBob + lockAmount / 2n
      );

      expect(
        await interestLocker.getTotalLocked(await testTokenA.getAddress())
      ).to.equal(0);
      expect(
        await interestLocker.getTotalLocked(await testTokenB.getAddress())
      ).to.equal(lockAmount / 2n);

      expect(
        await interestLocker.getAccountLocked(
          alice.address,
          await testTokenA.getAddress()
        )
      ).to.equal(0);
      expect(
        await interestLocker.getAccountLocked(
          bob.address,
          await testTokenB.getAddress()
        )
      ).to.equal(lockAmount / 2n);

      await expect(tx1)
        .to.emit(interestLocker, 'TokensUnlocked')
        .withArgs(alice.address, await testTokenA.getAddress(), lockAmount);
      await expect(tx2)
        .to.emit(interestLocker, 'TokensUnlocked')
        .withArgs(bob.address, await testTokenB.getAddress(), lockAmount / 2n);
    });
  });

  describe('setTokens', async () => {
    let anotherToken: MockERC20;

    beforeEach(async () => {
      anotherToken = await new MockERC20__factory(deployer).deploy(
        'Test Token',
        'TestToken',
        18
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
    it.only('Should set tokens', async () => {
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
