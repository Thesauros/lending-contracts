import { ethers } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { network } from 'hardhat';
import {
  MockERC20__factory,
  MockERC20,
  MockProviderA__factory,
  MockProviderA,
  MockProviderB__factory,
  MockProviderB,
  BaseMockProvider,
  BaseMockProvider__factory,
  VaultRebalancer__factory,
  VaultRebalancer,
} from '../../typechain-types';

describe('VaultRebalancer', async () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let charlie: SignerWithAddress;
  let trent: SignerWithAddress;

  let PRECISION_CONSTANT: bigint;
  let MAX_WITHDRAW_FEE: bigint;
  let MAX_REBALANCE_FEE: bigint;

  let initShares: bigint;
  let minAmount: bigint;
  let mintAmount: bigint;
  let depositAmount: bigint;
  let maxDepositVault: bigint;

  let userDepositLimit: bigint;
  let vaultDepositLimit: bigint;

  let withdrawFeePercent: bigint;

  let assetDecimals: bigint;

  let mainAsset: MockERC20; // testUSDC

  let providerA: MockProviderA;
  let providerB: MockProviderB;
  let invalidProvider: BaseMockProvider;

  let vaultRebalancer: VaultRebalancer;

  let DEFAULT_ADMIN_ROLE: string;
  let REBALANCER_ROLE: string;

  async function deposit(
    _depositAmount: bigint,
    _signer: SignerWithAddress,
    _receiver: string
  ) {
    return await vaultRebalancer
      .connect(_signer)
      .deposit(_depositAmount, _receiver);
  }

  before(async () => {
    [deployer, alice, bob, charlie, trent] = await ethers.getSigners();

    PRECISION_CONSTANT = ethers.parseEther('1');
    MAX_WITHDRAW_FEE = ethers.parseEther('0.05'); // 5%
    MAX_REBALANCE_FEE = ethers.parseEther('0.2'); // 20%

    initShares = ethers.parseUnits('1', 6);
    minAmount = ethers.parseUnits('1', 6);
    mintAmount = ethers.parseUnits('100000', 6);
    depositAmount = ethers.parseUnits('100', 6);

    userDepositLimit = ethers.parseUnits('1000', 6);
    vaultDepositLimit = ethers.parseUnits('3000', 6) + initShares;

    maxDepositVault = vaultDepositLimit - initShares;

    withdrawFeePercent = ethers.parseEther('0.001'); // 0.1%

    assetDecimals = 6n;
  });

  beforeEach(async () => {
    mainAsset = await new MockERC20__factory(deployer).deploy(
      'testUSDC',
      'tUSDC',
      assetDecimals
    );

    await mainAsset.mint(deployer.address, mintAmount);
    await mainAsset.mint(alice.address, mintAmount);
    await mainAsset.mint(bob.address, mintAmount);
    await mainAsset.mint(charlie.address, mintAmount);
    await mainAsset.mint(trent.address, mintAmount);

    providerA = await new MockProviderA__factory(deployer).deploy();

    // Rebalancer and Treasury is the deployer for testing purposes

    vaultRebalancer = await new VaultRebalancer__factory(deployer).deploy(
      await mainAsset.getAddress(),
      deployer.address,
      'Rebalance tUSDC',
      'rtUSDC',
      [await providerA.getAddress()],
      userDepositLimit,
      vaultDepositLimit,
      withdrawFeePercent,
      deployer.address
    );

    DEFAULT_ADMIN_ROLE = await vaultRebalancer.DEFAULT_ADMIN_ROLE();
    REBALANCER_ROLE = await vaultRebalancer.REBALANCER_ROLE();

    await mainAsset
      .connect(deployer)
      .approve(await vaultRebalancer.getAddress(), ethers.MaxUint256);
    await mainAsset
      .connect(alice)
      .approve(await vaultRebalancer.getAddress(), ethers.MaxUint256);
    await mainAsset
      .connect(bob)
      .approve(await vaultRebalancer.getAddress(), ethers.MaxUint256);
    await mainAsset
      .connect(charlie)
      .approve(await vaultRebalancer.getAddress(), ethers.MaxUint256);
    await mainAsset
      .connect(trent)
      .approve(await vaultRebalancer.getAddress(), ethers.MaxUint256);

    await vaultRebalancer.initializeVaultShares(initShares);
  });

  describe('constructor', async () => {
    it('Should revert when main asset is invalid', async () => {
      await expect(
        new VaultRebalancer__factory(deployer).deploy(
          ethers.ZeroAddress,
          deployer.address,
          'Rebalance tUSDC',
          'rtUSDC',
          [await providerA.getAddress()],
          userDepositLimit,
          vaultDepositLimit,
          withdrawFeePercent,
          deployer.address
        )
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'InterestVault__InvalidInput'
      );
    });
    it('Should revert when rebalanceProvider is invalid', async () => {
      await expect(
        new VaultRebalancer__factory(deployer).deploy(
          await mainAsset.getAddress(),
          ethers.ZeroAddress,
          'Rebalance tUSDC',
          'rtUSDC',
          [await providerA.getAddress()],
          userDepositLimit,
          vaultDepositLimit,
          withdrawFeePercent,
          deployer.address
        )
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'InterestVault__InvalidInput'
      );
    });
    it('Should revert when withdrawFee is invalid', async () => {
      await expect(
        new VaultRebalancer__factory(deployer).deploy(
          await mainAsset.getAddress(),
          deployer.address,
          'Rebalance tUSDC',
          'rtUSDC',
          [await providerA.getAddress()],
          userDepositLimit,
          vaultDepositLimit,
          MAX_WITHDRAW_FEE + 1n,
          deployer.address
        )
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'InterestVault__InvalidInput'
      );
    });
    it('Should revert when userDepositLimit is invalid', async () => {
      let newUserDepositLimit = 0n;
      await expect(
        new VaultRebalancer__factory(deployer).deploy(
          await mainAsset.getAddress(),
          deployer.address,
          'Rebalance tUSDC',
          'rtUSDC',
          [await providerA.getAddress()],
          newUserDepositLimit,
          vaultDepositLimit,
          withdrawFeePercent,
          deployer.address
        )
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'InterestVault__InvalidInput'
      );
    });
    it('Should revert when vaultDepositLimit is invalid', async () => {
      let newVaultDepositLimit = 0n;
      await expect(
        new VaultRebalancer__factory(deployer).deploy(
          await mainAsset.getAddress(),
          deployer.address,
          'Rebalance tUSDC',
          'rtUSDC',
          [await providerA.getAddress()],
          userDepositLimit,
          newVaultDepositLimit,
          withdrawFeePercent,
          deployer.address
        )
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'InterestVault__InvalidInput'
      );
    });
    it('Should revert when deposit limits are invalid', async () => {
      let newUserDepositLimit = 1n;
      let newVaultDepositLimit = newUserDepositLimit;
      await expect(
        new VaultRebalancer__factory(deployer).deploy(
          await mainAsset.getAddress(),
          deployer.address,
          'Rebalance tUSDC',
          'rtUSDC',
          [await providerA.getAddress()],
          newUserDepositLimit,
          newVaultDepositLimit,
          withdrawFeePercent,
          deployer.address
        )
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'InterestVault__InvalidInput'
      );
    });
    it('Should initialize correctly', async () => {
      expect(
        await vaultRebalancer.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)
      ).to.be.true;
      expect(await vaultRebalancer.hasRole(REBALANCER_ROLE, deployer.address))
        .to.be.true;
      expect(await vaultRebalancer.decimals()).to.equal(
        await mainAsset.decimals()
      );
      expect(await vaultRebalancer.asset()).to.equal(
        await mainAsset.getAddress()
      );
      expect(await vaultRebalancer.minAmount()).to.equal(minAmount);
      expect(await vaultRebalancer.name()).to.equal('Rebalance tUSDC');
      expect(await vaultRebalancer.symbol()).to.equal('rtUSDC');
      expect((await vaultRebalancer.getProviders())[0]).to.equal(
        await providerA.getAddress()
      );
      expect(await vaultRebalancer.activeProvider()).to.equal(
        await providerA.getAddress()
      );
      expect(await vaultRebalancer.userDepositLimit()).to.equal(
        userDepositLimit
      );
      expect(await vaultRebalancer.vaultDepositLimit()).to.equal(
        vaultDepositLimit
      );
      expect(await vaultRebalancer.withdrawFeePercent()).to.equal(
        withdrawFeePercent
      );
      expect(await vaultRebalancer.treasury()).to.be.equal(deployer.address);
    });
  });

  describe('initializeVaultShares', async () => {
    let anotherVaultRebalancer: VaultRebalancer;

    beforeEach(async () => {
      anotherVaultRebalancer = await new VaultRebalancer__factory(
        deployer
      ).deploy(
        await mainAsset.getAddress(),
        deployer.address,
        'Rebalance tUSDC',
        'rtUSDC',
        [await providerA.getAddress()],
        userDepositLimit,
        vaultDepositLimit,
        withdrawFeePercent,
        deployer.address
      );
      await mainAsset
        .connect(deployer)
        .approve(await anotherVaultRebalancer.getAddress(), ethers.MaxUint256);
    });
    it('Should revert when called more than once', async () => {
      await anotherVaultRebalancer.initializeVaultShares(initShares);
      await expect(
        anotherVaultRebalancer.initializeVaultShares(initShares)
      ).to.be.revertedWithCustomError(
        anotherVaultRebalancer,
        'InterestVault__VaultAlreadyInitialized'
      );
    });
    it('Should revert when initial shares are less than minAmount', async () => {
      await expect(
        anotherVaultRebalancer.initializeVaultShares(minAmount - 1n)
      ).to.be.revertedWithCustomError(
        anotherVaultRebalancer,
        'InterestVault__AmountLessThanMin'
      );
    });
    it('Should initialize the vault', async () => {
      let tx = await anotherVaultRebalancer.initializeVaultShares(initShares);
      let balanceVault = await anotherVaultRebalancer.balanceOf(
        await anotherVaultRebalancer.getAddress()
      );
      expect(await anotherVaultRebalancer.totalAssets()).to.equal(initShares);
      expect(balanceVault).to.equal(initShares);
      // Should emit VaultInitialized event
      await expect(tx)
        .to.emit(anotherVaultRebalancer, 'VaultInitialized')
        .withArgs(deployer.address);
    });
  });

  describe('deposit', async () => {
    it('Should revert when receiver is invalid', async () => {
      await expect(
        deposit(depositAmount, alice, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'InterestVault__InvalidInput'
      );
    });
    it('Should revert when deposit amount is invalid', async () => {
      await expect(
        deposit(0n, alice, alice.address)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'InterestVault__InvalidInput'
      );
    });
    it('Should revert when deposit amount is more than userDepositLimit', async () => {
      await expect(
        deposit(userDepositLimit + 1n, alice, alice.address)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'InterestVault__DepositMoreThanMax'
      );
    });
    it('Should revert when deposit amount is more than vaultDepositLimit', async () => {
      await deposit(maxDepositVault / 3n, alice, alice.address);
      await deposit(maxDepositVault / 3n, bob, bob.address);
      await deposit(maxDepositVault / 3n, charlie, charlie.address);

      await expect(
        deposit(1n, trent, trent.address)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'InterestVault__DepositMoreThanMax'
      );
    });
    it('Should revert when deposit amount is less than minAmount', async () => {
      await expect(
        deposit(minAmount - 1n, alice, alice.address)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'InterestVault__AmountLessThanMin'
      );
    });
    it('Should revert when the vault is paused', async () => {
      await vaultRebalancer.pause(0);
      // We get this error because of _depositChecks when vault is paused
      await expect(
        deposit(depositAmount, alice, alice.address)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'InterestVault__DepositMoreThanMax'
      );
    });
    it('Should deposit assets', async () => {
      let previousBalance = await vaultRebalancer.balanceOf(alice.address);

      let tx = await deposit(depositAmount, alice, alice.address);

      let mintedShares =
        (await vaultRebalancer.balanceOf(alice.address)) - previousBalance;
      let assetBalance = await vaultRebalancer.convertToAssets(mintedShares);

      expect(assetBalance).to.equal(depositAmount);
      expect(await vaultRebalancer.totalAssets()).to.equal(
        depositAmount + initShares
      );
      // Should emit Deposit event
      await expect(tx)
        .to.emit(vaultRebalancer, 'Deposit')
        .withArgs(alice.address, alice.address, depositAmount, mintedShares);
    });
  });

  describe('mint', async () => {
    it('Should revert when shares amount is more than userDepositLimit', async () => {
      let maxMint = await vaultRebalancer.convertToShares(userDepositLimit);
      await expect(
        vaultRebalancer.connect(alice).mint(maxMint + 1n, alice.address)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'InterestVault__DepositMoreThanMax'
      );
    });
    it('Should mint shares', async () => {
      let assets = await vaultRebalancer.previewMint(depositAmount);

      let tx = await vaultRebalancer
        .connect(alice)
        .mint(depositAmount, alice.address);

      let pulledAssets = await vaultRebalancer
        .connect(alice)
        .mint.staticCall(depositAmount, alice.address);

      let mintedShares = await vaultRebalancer.balanceOf(alice.address);

      expect(depositAmount).to.equal(mintedShares);
      expect(pulledAssets).to.equal(assets);

      // Should emit Deposit event
      await expect(tx)
        .to.emit(vaultRebalancer, 'Deposit')
        .withArgs(alice.address, alice.address, assets, depositAmount);
    });
  });

  describe('withdraw', async () => {
    it('Should revert when receiver is invalid', async () => {
      await expect(
        vaultRebalancer
          .connect(alice)
          .withdraw(depositAmount, ethers.ZeroAddress, alice.address)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'InterestVault__InvalidInput'
      );
    });
    it('Should revert when owner is invalid', async () => {
      await expect(
        vaultRebalancer
          .connect(alice)
          .withdraw(depositAmount, alice.address, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'InterestVault__InvalidInput'
      );
    });
    it('Should revert when amount to withdraw is invalid', async () => {
      await expect(
        vaultRebalancer.connect(alice).withdraw(0, alice.address, alice.address)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'InterestVault__InvalidInput'
      );
    });
    it('Should revert when the vault is paused', async () => {
      await vaultRebalancer.pause(1);

      await deposit(depositAmount, alice, alice.address);

      await expect(
        vaultRebalancer
          .connect(alice)
          .withdraw(depositAmount, alice.address, alice.address)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'VaultPausable__ActionPaused'
      );
    });
    it('Should withdraw max possible when withdraw amount is more than available', async () => {
      let moreThanAvailable = depositAmount * 2n;

      await deposit(depositAmount, alice, alice.address);

      let previousBalance = await mainAsset.balanceOf(alice.address);
      await vaultRebalancer
        .connect(alice)
        .withdraw(moreThanAvailable, alice.address, alice.address);

      let newBalance =
        previousBalance +
        depositAmount -
        (depositAmount * withdrawFeePercent) / PRECISION_CONSTANT;
      expect(await mainAsset.balanceOf(alice.address)).to.equal(newBalance);
      expect(await vaultRebalancer.balanceOf(alice.address)).to.equal(0);
    });
    it('Should withdraw assets', async () => {
      let shares = await vaultRebalancer.previewWithdraw(depositAmount);
      let feeAmount = (depositAmount * withdrawFeePercent) / PRECISION_CONSTANT;
      let withdrawAmount = depositAmount - feeAmount;

      await deposit(depositAmount, alice, alice.address);

      let previousBalanceAlice = await mainAsset.balanceOf(alice.address);
      let previousBalanceTreasury = await mainAsset.balanceOf(deployer.address);

      let tx = await vaultRebalancer
        .connect(alice)
        .withdraw(depositAmount, alice.address, alice.address);

      expect(await mainAsset.balanceOf(alice.address)).to.equal(
        previousBalanceAlice + withdrawAmount
      );
      expect(await mainAsset.balanceOf(deployer.address)).to.equal(
        previousBalanceTreasury + feeAmount
      );
      expect(await vaultRebalancer.balanceOf(alice.address)).to.equal(0);
      expect(await vaultRebalancer.totalAssets()).to.equal(initShares);

      // Should emit Withdraw event
      await expect(tx)
        .to.emit(vaultRebalancer, 'Withdraw')
        .withArgs(
          alice.address,
          alice.address,
          alice.address,
          withdrawAmount,
          shares
        );
      // Should emit FeesCharged event
      await expect(tx)
        .to.emit(vaultRebalancer, 'FeesCharged')
        .withArgs(deployer.address, depositAmount, feeAmount);
    });
  });

  describe('redeem', async () => {
    it('Should redeem max possible when redeem amount is more than available', async () => {
      let moreThanAvailable = depositAmount * 2n;

      await vaultRebalancer.connect(alice).mint(depositAmount, alice.address);

      let assets = await vaultRebalancer.previewRedeem(depositAmount);
      let previousBalance = await mainAsset.balanceOf(alice.address);

      let newBalance =
        previousBalance +
        assets -
        (assets * withdrawFeePercent) / PRECISION_CONSTANT;

      await vaultRebalancer
        .connect(alice)
        .redeem(moreThanAvailable, alice.address, alice.address);

      expect(await mainAsset.balanceOf(alice.address)).to.equal(newBalance);
      expect(await vaultRebalancer.balanceOf(alice.address)).to.equal(0);
    });
    it('Should redeem shares', async () => {
      await vaultRebalancer.connect(alice).mint(depositAmount, alice.address);

      let previousBalanceAlice = await mainAsset.balanceOf(alice.address);
      let previousBalanceTreasury = await mainAsset.balanceOf(deployer.address);
      let previousShares = await vaultRebalancer.balanceOf(alice.address);

      let assets = await vaultRebalancer.previewRedeem(depositAmount);
      let feeAmount = (assets * withdrawFeePercent) / PRECISION_CONSTANT;
      let withdrawAmount = assets - feeAmount;

      let tx = await vaultRebalancer
        .connect(alice)
        .redeem(depositAmount, alice.address, alice.address);

      expect(await mainAsset.balanceOf(alice.address)).to.equal(
        previousBalanceAlice + withdrawAmount
      );
      expect(await mainAsset.balanceOf(deployer.address)).to.equal(
        previousBalanceTreasury + feeAmount
      );
      expect(await vaultRebalancer.balanceOf(alice.address)).to.equal(
        previousShares - depositAmount
      );

      // Should emit Withdraw event
      await expect(tx)
        .to.emit(vaultRebalancer, 'Withdraw')
        .withArgs(
          alice.address,
          alice.address,
          alice.address,
          withdrawAmount,
          depositAmount
        );
      // Should emit FeesCharged event
      await expect(tx)
        .to.emit(vaultRebalancer, 'FeesCharged')
        .withArgs(deployer.address, depositAmount, feeAmount);
    });
  });

  describe('transfer', async () => {
    it('Should transfer shares', async () => {
      await deposit(depositAmount, alice, alice.address);

      await vaultRebalancer.connect(alice).approve(bob.address, depositAmount);

      await vaultRebalancer
        .connect(bob)
        .transferFrom(alice.address, bob.address, depositAmount);
      await vaultRebalancer
        .connect(bob)
        .transfer(alice.address, depositAmount / 2n);

      expect(await vaultRebalancer.balanceOf(bob.address)).to.equal(
        depositAmount / 2n
      );
      expect(await vaultRebalancer.balanceOf(alice.address)).to.equal(
        depositAmount / 2n
      );
    });
  });

  describe('rebalance', async () => {
    beforeEach(async () => {
      invalidProvider = await new BaseMockProvider__factory(deployer).deploy();
      providerB = await new MockProviderB__factory(deployer).deploy();

      await vaultRebalancer.setProviders([
        await providerA.getAddress(),
        await providerB.getAddress(),
      ]);

      await deposit(depositAmount, alice, alice.address);
      await deposit(depositAmount, bob, bob.address);
      await deposit(depositAmount, charlie, charlie.address);
    });
    it('Should revert when caller is invalid', async () => {
      await expect(
        vaultRebalancer
          .connect(alice)
          .rebalance(
            depositAmount,
            await providerA.getAddress(),
            await providerB.getAddress(),
            0,
            true
          )
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'ProtocolAccessControl__CallerIsNotRebalancer'
      );
    });
    it('Should revert when provider from is invalid', async () => {
      await expect(
        vaultRebalancer.rebalance(
          depositAmount,
          await invalidProvider.getAddress(),
          await providerB.getAddress(),
          0,
          true
        )
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'VaultRebalancer__InvalidProvider'
      );
    });
    it('Should revert when provider to is invalid', async () => {
      await expect(
        vaultRebalancer.rebalance(
          depositAmount,
          await providerA.getAddress(),
          await invalidProvider.getAddress(),
          0,
          true
        )
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'VaultRebalancer__InvalidProvider'
      );
    });
    it('Should revert when rebalance fee is not reasonable', async () => {
      let excessRebalanceFee =
        (depositAmount * MAX_REBALANCE_FEE) / PRECISION_CONSTANT + 1n;

      await expect(
        vaultRebalancer.rebalance(
          depositAmount,
          await providerA.getAddress(),
          await providerB.getAddress(),
          excessRebalanceFee,
          true
        )
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'InterestVault__ExcessRebalanceFee'
      );
    });
    it('Should partially rebalance the vault', async () => {
      let assetsAliceAndBob = 2n * depositAmount;
      let assetsCharlie =
        depositAmount + (await vaultRebalancer.convertToAssets(initShares));

      let rebalanceFee =
        (assetsAliceAndBob * MAX_REBALANCE_FEE) / PRECISION_CONSTANT;

      let previousBalanceTreasury = await mainAsset.balanceOf(deployer.address);

      await vaultRebalancer.rebalance(
        assetsAliceAndBob,
        await providerA.getAddress(),
        await providerB.getAddress(),
        rebalanceFee,
        false
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
      ).to.equal(assetsAliceAndBob - rebalanceFee);

      expect(await mainAsset.balanceOf(deployer.address)).to.equal(
        previousBalanceTreasury + rebalanceFee
      );
      // Check the active provider
      expect(await vaultRebalancer.activeProvider()).to.equal(
        await providerA.getAddress()
      );
    });
    it('Should fully rebalance the vault', async () => {
      let assetsAll =
        3n * depositAmount +
        (await vaultRebalancer.convertToAssets(initShares)); // alice, bob, charlie

      let tx = await vaultRebalancer.rebalance(
        assetsAll,
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

      // Check the active provider
      expect(await vaultRebalancer.activeProvider()).to.equal(
        await providerB.getAddress()
      );
      // Should emit VaultRefinance event
      await expect(tx)
        .to.emit(vaultRebalancer, 'VaultRebalance')
        .withArgs(
          assetsAll,
          assetsAll,
          await providerA.getAddress(),
          await providerB.getAddress()
        );
    });
  });

  describe('setProviders', async () => {
    beforeEach(async () => {
      providerB = await new MockProviderB__factory(deployer).deploy();
    });

    it('Should revert when called by non-admin', async () => {
      await expect(
        vaultRebalancer
          .connect(alice)
          .setProviders([await providerB.getAddress()])
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'ProtocolAccessControl__CallerIsNotAdmin'
      );
    });
    it('Should revert when provider is invalid', async () => {
      await expect(
        vaultRebalancer.setProviders([ethers.ZeroAddress])
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'InterestVault__InvalidInput'
      );
    });
    it('Should set providers', async () => {
      let tx = await vaultRebalancer.setProviders([
        await providerA.getAddress(),
        await providerB.getAddress(),
      ]);
      expect((await vaultRebalancer.getProviders())[1]).to.equal(
        await providerB.getAddress()
      );

      // Should emit ProvidersChanged event
      await expect(tx)
        .to.emit(vaultRebalancer, 'ProvidersChanged')
        .withArgs([await providerA.getAddress(), await providerB.getAddress()]);
    });
  });

  describe('setActiveProvider', async () => {
    beforeEach(async () => {
      providerA = await new MockProviderA__factory(deployer).deploy();
      providerB = await new MockProviderB__factory(deployer).deploy();
    });
    it('Should revert when called by non-admin', async () => {
      await expect(
        vaultRebalancer
          .connect(alice)
          .setActiveProvider(await providerB.getAddress())
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'ProtocolAccessControl__CallerIsNotAdmin'
      );
    });
    it('Should revert when the active provider is invalid', async () => {
      await expect(
        vaultRebalancer.setActiveProvider(await providerB.getAddress())
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'InterestVault__InvalidInput'
      );
      await vaultRebalancer.setProviders([
        await providerA.getAddress(),
        await providerB.getAddress(),
      ]);
      await expect(
        vaultRebalancer.setActiveProvider(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'InterestVault__InvalidInput'
      );
    });
    it('Should set the active provider', async () => {
      await vaultRebalancer.setProviders([
        await providerA.getAddress(),
        await providerB.getAddress(),
      ]);
      let tx = await vaultRebalancer.setActiveProvider(
        await providerB.getAddress()
      );
      expect(await vaultRebalancer.activeProvider()).to.equal(
        await providerB.getAddress()
      );
      // Should emit ActiveProviderChanged event
      await expect(tx)
        .to.emit(vaultRebalancer, 'ActiveProviderChanged')
        .withArgs(await providerB.getAddress());
    });
  });

  describe('setDepositLimits', async () => {
    let newUserDepositLimit: bigint;
    let newVaultDepositLimit: bigint;
    beforeEach(async () => {
      newUserDepositLimit = ethers.parseUnits('2000', 6);
      newVaultDepositLimit = ethers.parseUnits('5000', 6);
    });
    it('Should revert when called by non-admin', async () => {
      await expect(
        vaultRebalancer
          .connect(alice)
          .setDepositLimits(newUserDepositLimit, newVaultDepositLimit)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'ProtocolAccessControl__CallerIsNotAdmin'
      );
    });
    it('Should revert when userDepositLimit is invalid', async () => {
      newUserDepositLimit = 0n;
      await expect(
        vaultRebalancer.setDepositLimits(
          newUserDepositLimit,
          newVaultDepositLimit
        )
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'InterestVault__InvalidInput'
      );
    });
    it('Should revert when vaultDepositLimit is invalid', async () => {
      newVaultDepositLimit = 0n;
      await expect(
        vaultRebalancer.setDepositLimits(
          newUserDepositLimit,
          newVaultDepositLimit
        )
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'InterestVault__InvalidInput'
      );
    });
    it('Should revert when deposit limits are invalid', async () => {
      newUserDepositLimit = 1n;
      newVaultDepositLimit = newUserDepositLimit;
      await expect(
        vaultRebalancer.setDepositLimits(
          newUserDepositLimit,
          newVaultDepositLimit
        )
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'InterestVault__InvalidInput'
      );
    });
    it('Should set the deposit limits', async () => {
      let tx = await vaultRebalancer.setDepositLimits(
        newUserDepositLimit,
        newVaultDepositLimit
      );
      expect(await vaultRebalancer.userDepositLimit()).to.equal(
        newUserDepositLimit
      );
      expect(await vaultRebalancer.vaultDepositLimit()).to.equal(
        newVaultDepositLimit
      );
      // Should emit DepositLimitsChanged event
      await expect(tx)
        .to.emit(vaultRebalancer, 'DepositLimitsChanged')
        .withArgs(newUserDepositLimit, newVaultDepositLimit);
    });
  });

  describe('setTreasury', async () => {
    it('Should revert when called by non-admin', async () => {
      await expect(
        vaultRebalancer.connect(alice).setTreasury(alice.address)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'ProtocolAccessControl__CallerIsNotAdmin'
      );
    });
    it('Should revert when the treasury address is invalid', async () => {
      await expect(
        vaultRebalancer.setTreasury(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'InterestVault__InvalidInput'
      );
    });
    it('Should set the treasury address', async () => {
      let tx = await vaultRebalancer.setTreasury(alice.address);
      expect(await vaultRebalancer.treasury()).to.equal(alice.address);
      // Should emit TreasuryChanged event
      await expect(tx)
        .to.emit(vaultRebalancer, 'TreasuryChanged')
        .withArgs(alice.address);
    });
  });

  describe('setWithdrawFee', async () => {
    beforeEach(async () => {
      withdrawFeePercent = ethers.parseEther('0.0005');
    });
    it('Should revert when called by non-admin', async () => {
      await expect(
        vaultRebalancer.connect(alice).setWithdrawFee(withdrawFeePercent)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'ProtocolAccessControl__CallerIsNotAdmin'
      );
    });
    it('Should revert when withdraw fee is invalid', async () => {
      await expect(
        vaultRebalancer.setWithdrawFee(MAX_WITHDRAW_FEE + 1n)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'InterestVault__InvalidInput'
      );
    });
    it('Should set fee percents', async () => {
      let tx = await vaultRebalancer.setWithdrawFee(withdrawFeePercent);
      expect(await vaultRebalancer.withdrawFeePercent()).to.equal(
        withdrawFeePercent
      );
      // Should emit FeesChanged event
      await expect(tx)
        .to.emit(vaultRebalancer, 'FeesChanged')
        .withArgs(withdrawFeePercent);
    });
  });

  describe('setMinAmount', async () => {
    it('Should revert when called by non-admin', async () => {
      await expect(
        vaultRebalancer.connect(alice).setMinAmount(PRECISION_CONSTANT)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'ProtocolAccessControl__CallerIsNotAdmin'
      );
    });
    it('Should set the minAmount', async () => {
      let tx = await vaultRebalancer.setMinAmount(PRECISION_CONSTANT);
      expect(await vaultRebalancer.minAmount()).to.equal(PRECISION_CONSTANT);
      // Should emit MinAmountChanged event
      await expect(tx)
        .to.emit(vaultRebalancer, 'MinAmountChanged')
        .withArgs(PRECISION_CONSTANT);
    });
  });

  describe('maxDeposit', async () => {
    it('Should return 0 when deposits are paused', async () => {
      await vaultRebalancer.pause(0);
      expect(await vaultRebalancer.maxDeposit(alice.address)).to.equal(0);
    });
    it('Should return 0 when vaultDepositLimit is reached', async () => {
      await deposit(maxDepositVault / 3n, alice, alice.address);
      await deposit(maxDepositVault / 3n, bob, bob.address);
      await deposit(maxDepositVault / 3n, charlie, charlie.address);

      expect(await vaultRebalancer.maxDeposit(trent.address)).to.equal(0);
    });
    it('Should return 0 when userDepositLimit is reached', async () => {
      await deposit(depositAmount, alice, alice.address);
      await deposit(depositAmount, bob, bob.address);
      await deposit(userDepositLimit - depositAmount, alice, alice.address);
      await deposit(userDepositLimit - depositAmount, bob, bob.address);

      expect(await vaultRebalancer.maxDeposit(alice.address)).to.equal(0);
      expect(await vaultRebalancer.maxDeposit(bob.address)).to.equal(0);
    });
    it('Should return maxDeposit', async () => {
      await deposit(depositAmount, alice, alice.address);
      await deposit(userDepositLimit, bob, bob.address);
      await deposit(depositAmount * 2n, charlie, charlie.address);

      expect(await vaultRebalancer.maxDeposit(alice.address)).to.equal(
        userDepositLimit - depositAmount
      );
      expect(await vaultRebalancer.maxDeposit(charlie.address)).to.equal(
        userDepositLimit - depositAmount * 2n
      );
      expect(await vaultRebalancer.maxDeposit(bob.address)).to.equal(0);

      await deposit(userDepositLimit - depositAmount, alice, alice.address);

      let vaultCapacityLeft = await vaultRebalancer.getVaultCapacity();

      expect(await vaultRebalancer.maxDeposit(trent.address)).to.equal(
        vaultCapacityLeft
      );
    });
  });

  describe('maxMint', async () => {
    it('Should return 0 when deposits are paused', async () => {
      await vaultRebalancer.pause(0);
      expect(await vaultRebalancer.maxMint(alice.address)).to.equal(0);
    });
    it('Should return 0 when vaultDepositLimit is reached', async () => {
      await vaultRebalancer
        .connect(alice)
        .mint(maxDepositVault / 3n, alice.address);
      await vaultRebalancer
        .connect(bob)
        .mint(maxDepositVault / 3n, bob.address);
      await vaultRebalancer
        .connect(charlie)
        .mint(maxDepositVault / 3n, charlie.address);
      expect(await vaultRebalancer.maxMint(trent.address)).to.equal(0);
    });
    it('Should return 0 when userDepositLimit is reached', async () => {
      await vaultRebalancer.connect(alice).mint(depositAmount, alice.address);
      await vaultRebalancer.connect(bob).mint(depositAmount, bob.address);
      await vaultRebalancer
        .connect(alice)
        .mint(userDepositLimit - depositAmount, alice.address);
      await vaultRebalancer
        .connect(bob)
        .mint(userDepositLimit - depositAmount, bob.address);
      expect(await vaultRebalancer.maxMint(alice.address)).to.equal(0);
      expect(await vaultRebalancer.maxMint(bob.address)).to.equal(0);
    });
    it('Should return maxMint', async () => {
      await vaultRebalancer.connect(alice).mint(depositAmount, alice.address);
      await vaultRebalancer.connect(bob).mint(userDepositLimit, bob.address);
      await vaultRebalancer
        .connect(charlie)
        .mint(depositAmount * 2n, charlie.address);
      expect(await vaultRebalancer.maxMint(alice.address)).to.equal(
        userDepositLimit - depositAmount
      );
      expect(await vaultRebalancer.maxMint(charlie.address)).to.equal(
        userDepositLimit - depositAmount * 2n
      );
      expect(await vaultRebalancer.maxMint(bob.address)).to.equal(0);

      await vaultRebalancer
        .connect(alice)
        .mint(userDepositLimit - depositAmount, alice.address);

      let vaultCapacityLeft = await vaultRebalancer.getVaultCapacity();

      expect(await vaultRebalancer.maxMint(trent.address)).to.equal(
        vaultCapacityLeft
      );
    });
  });

  describe('maxWithdraw', async () => {
    it('Should return 0 when withdraws are paused', async () => {
      await deposit(depositAmount, alice, alice.address);
      await vaultRebalancer.pause(1);
      expect(await vaultRebalancer.maxWithdraw(alice.address)).to.equal(0);
    });
    it('Should return maxWithdraw', async () => {
      await deposit(depositAmount, alice, alice.address);
      let balanceAlice = await vaultRebalancer.balanceOf(alice.address);
      let maxWithdraw = await vaultRebalancer.previewRedeem(balanceAlice);
      expect(await vaultRebalancer.maxWithdraw(alice.address)).to.equal(
        maxWithdraw
      );
    });
  });

  describe('maxRedeem', async () => {
    it('Should return 0 when withdraws are paused', async () => {
      await deposit(depositAmount, alice, alice.address);
      await vaultRebalancer.pause(1);
      expect(await vaultRebalancer.maxRedeem(alice.address)).to.equal(0);
    });
    it('Should return maxRedeem', async () => {
      await deposit(depositAmount, alice, alice.address);
      let maxRedeem = await vaultRebalancer.previewWithdraw(depositAmount);
      expect(await vaultRebalancer.maxRedeem(alice.address)).to.equal(
        maxRedeem
      );
    });
  });
  describe('getVaultCapacity', async () => {
    it('Should return 0 when deposits are paused', async () => {
      await vaultRebalancer.pause(0);
      expect(await vaultRebalancer.getVaultCapacity()).to.equal(0);
    });
    it('Should return 0 when vaultDepositLimit is reached', async () => {
      await deposit(maxDepositVault / 3n, alice, alice.address);
      await deposit(maxDepositVault / 3n, bob, bob.address);
      await deposit(maxDepositVault / 3n, charlie, charlie.address);
      expect(await vaultRebalancer.getVaultCapacity()).to.equal(0);
    });
    it('Should return vault capacity', async () => {
      await deposit(depositAmount, alice, alice.address);
      expect(await vaultRebalancer.getVaultCapacity()).to.equal(
        maxDepositVault - depositAmount
      );
    });
  });

  describe('balanceOfAsset', async () => {
    it('Should return the balance of the asset', async () => {
      await vaultRebalancer
        .connect(alice)
        .deposit(depositAmount, alice.address);
      let balance = await vaultRebalancer.balanceOfAsset(alice.address);
      expect(balance).to.equal(depositAmount);
    });
  });
});
