import { ethers } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import {
  MockERC20__factory,
  MockERC20,
  RewardsDistributor,
  RewardsDistributor__factory,
} from '../../typechain-types';
import { ASSET_DECIMALS } from '../../utils/helper';

describe('RewardsDistributor', async () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let testToken: MockERC20;

  let rewardsDistributor: RewardsDistributor;

  let claimableAlice: bigint;
  let claimableBob: bigint;
  let totalClaimable: bigint;

  let proofAlice: string[];
  let proofBob: string[];

  let distributionValues: any[];
  let merkleTree: any;

  before(async () => {
    [deployer, alice, bob] = await ethers.getSigners();

    claimableAlice = ethers.parseEther('1');
    claimableBob = ethers.parseEther('2');

    totalClaimable = claimableAlice + claimableBob;
  });

  beforeEach(async () => {
    testToken = await new MockERC20__factory(deployer).deploy(
      'Mock Token',
      'MTK',
      ASSET_DECIMALS
    );

    rewardsDistributor = await new RewardsDistributor__factory(
      deployer
    ).deploy();

    await testToken.mint(await rewardsDistributor.getAddress(), totalClaimable);

    distributionValues = [
      [alice.address, await testToken.getAddress(), claimableAlice],
      [bob.address, await testToken.getAddress(), claimableBob],
    ];

    merkleTree = StandardMerkleTree.of(distributionValues, [
      'address',
      'address',
      'uint256',
    ]);

    proofAlice = merkleTree.getProof(distributionValues[0]);
    proofBob = merkleTree.getProof(distributionValues[1]);
  });

  describe('withdraw', async () => {
    it('Should revert if the caller is not the owner', async () => {
      await expect(
        rewardsDistributor.connect(alice).withdraw(await testToken.getAddress())
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it('Should withdraw the contract balance', async () => {
      await rewardsDistributor
        .connect(deployer)
        .withdraw(await testToken.getAddress());

      expect(
        await testToken.balanceOf(await rewardsDistributor.getAddress())
      ).to.equal(0);
      expect(await testToken.balanceOf(deployer.address)).to.equal(
        totalClaimable
      );
    });
  });

  describe('updateRoot', async () => {
    const newRoot = ethers.encodeBytes32String('newRoot');
    it('Should revert if the caller is not the owner', async () => {
      await expect(
        rewardsDistributor.connect(alice).updateRoot(newRoot)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it('Should update the root', async () => {
      let tx = await rewardsDistributor.connect(deployer).updateRoot(newRoot);

      expect(await rewardsDistributor.root()).to.equal(newRoot);
      await expect(tx)
        .to.emit(rewardsDistributor, 'RootUpdated')
        .withArgs(newRoot);
    });
  });

  describe('claim', async () => {
    it('Should revert if there is no root', async () => {
      await expect(
        rewardsDistributor
          .connect(alice)
          .claim(
            alice.address,
            await testToken.getAddress(),
            claimableAlice,
            proofAlice
          )
      ).to.be.revertedWithCustomError(
        rewardsDistributor,
        'RewardsDistributor__InvalidProof'
      );
    });
    it('Should revert when the rewards have already been claimed', async () => {
      await rewardsDistributor.connect(deployer).updateRoot(merkleTree.root);

      await rewardsDistributor
        .connect(alice)
        .claim(
          alice.address,
          await testToken.getAddress(),
          claimableAlice,
          proofAlice
        );

      await expect(
        rewardsDistributor
          .connect(alice)
          .claim(
            alice.address,
            await testToken.getAddress(),
            claimableAlice,
            proofAlice
          )
      ).to.be.revertedWithCustomError(
        rewardsDistributor,
        'RewardsDistributor__AlreadyClaimed'
      );
    });
    it('Should claim the rewards', async () => {
      await rewardsDistributor.connect(deployer).updateRoot(merkleTree.root);

      let tx = await rewardsDistributor
        .connect(bob)
        .claim(
          bob.address,
          await testToken.getAddress(),
          claimableBob,
          proofBob
        );

      expect(await testToken.balanceOf(bob.address)).to.equal(claimableBob);
      expect(
        await testToken.balanceOf(await rewardsDistributor.getAddress())
      ).to.equal(totalClaimable - claimableBob);

      await expect(tx)
        .to.emit(rewardsDistributor, 'RewardsClaimed')
        .withArgs(bob.address, await testToken.getAddress(), claimableBob);
    });
  });
});
