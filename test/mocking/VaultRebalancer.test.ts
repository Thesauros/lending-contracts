import { ethers } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import {
  MockERC20__factory,
  MockERC20,
  MockProviderA__factory,
  MockProviderA,
  MockProviderB__factory,
  MockProviderB,
  BaseMockProvider,
  BaseMockProvider__factory,
  VaultRebalancerV2,
} from '../../typechain-types';
import {
  deployVault,
  deposit,
  mint,
  withdraw,
  redeem,
  PRECISION_CONSTANT,
  WITHDRAW_FEE_PERCENT,
  MAX_REBALANCE_FEE,
  MAX_WITHDRAW_FEE,
  DEPOSIT_AMOUNT,
  ASSET_DECIMALS,
  DEFAULT_ADMIN_ROLE,
  REBALANCER_ROLE,
} from '../../utils/helper';

describe('VaultRebalancer', async () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let charlie: SignerWithAddress;
  let trent: SignerWithAddress;

  let mainAsset: MockERC20; // testWETH

  let providerA: MockProviderA;
  let providerB: MockProviderB;
  let invalidProvider: BaseMockProvider;

  let vaultRebalancer: VaultRebalancerV2;

  let minAmount: bigint;
  let mintAmount: bigint;

  let userDepositLimit: bigint;
  let vaultDepositLimit: bigint;
  let maxDepositVault: bigint;

  before(async () => {
    [deployer, alice, bob, charlie, trent] = await ethers.getSigners();

    minAmount = ethers.parseUnits('1', 6);

    mintAmount = ethers.parseEther('10');

    userDepositLimit = ethers.parseEther('10');
    vaultDepositLimit = ethers.parseEther('30') + minAmount;
    maxDepositVault = vaultDepositLimit - minAmount;
  });

  beforeEach(async () => {
    mainAsset = await new MockERC20__factory(deployer).deploy(
      'testWETH',
      'tWETH',
      ASSET_DECIMALS
    );

    await Promise.all([
      mainAsset.mint(deployer.address, mintAmount),
      mainAsset.mint(alice.address, mintAmount),
      mainAsset.mint(bob.address, mintAmount),
      mainAsset.mint(charlie.address, mintAmount),
      mainAsset.mint(trent.address, mintAmount),
    ]);

    providerA = await new MockProviderA__factory(deployer).deploy();

    vaultRebalancer = await deployVault(
      deployer,
      await mainAsset.getAddress(),
      'Rebalance tWETH',
      'rtWETH',
      [await providerA.getAddress()],
      deployer.address,
      userDepositLimit,
      vaultDepositLimit
    );

    await Promise.all([
      mainAsset
        .connect(deployer)
        .approve(await vaultRebalancer.getAddress(), ethers.MaxUint256),
      mainAsset
        .connect(alice)
        .approve(await vaultRebalancer.getAddress(), ethers.MaxUint256),
      mainAsset
        .connect(bob)
        .approve(await vaultRebalancer.getAddress(), ethers.MaxUint256),
      mainAsset
        .connect(charlie)
        .approve(await vaultRebalancer.getAddress(), ethers.MaxUint256),
      mainAsset
        .connect(trent)
        .approve(await vaultRebalancer.getAddress(), ethers.MaxUint256),
    ]);

    await vaultRebalancer.initializeVaultShares(minAmount);
  });

  describe('constructor', async () => {
    it('Should revert when the main asset is invalid', async () => {
      await expect(
        deployVault(
          deployer,
          ethers.ZeroAddress,
          'Rebalance tWETH',
          'rtWETH',
          [await providerA.getAddress()],
          deployer.address,
          userDepositLimit,
          vaultDepositLimit
        )
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'InterestVault__InvalidInput'
      );
    });
    it('Should revert when the rebalancer is invalid', async () => {
      await expect(
        deployVault(
          deployer,
          await mainAsset.getAddress(),
          'Rebalance tWETH',
          'rtWETH',
          [await providerA.getAddress()],
          ethers.ZeroAddress,
          userDepositLimit,
          vaultDepositLimit
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
      expect(await vaultRebalancer.name()).to.equal('Rebalance tWETH');
      expect(await vaultRebalancer.symbol()).to.equal('rtWETH');
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
        WITHDRAW_FEE_PERCENT
      );
      expect(await vaultRebalancer.treasury()).to.be.equal(deployer.address);
    });
  });

  describe('initializeVaultShares', async () => {
    let anotherVaultRebalancer: VaultRebalancerV2;

    beforeEach(async () => {
      anotherVaultRebalancer = await deployVault(
        deployer,
        await mainAsset.getAddress(),
        'Rebalance tWETH',
        'rtWETH',
        [await providerA.getAddress()],
        deployer.address,
        userDepositLimit,
        vaultDepositLimit
      );
      await mainAsset
        .connect(deployer)
        .approve(await anotherVaultRebalancer.getAddress(), ethers.MaxUint256);
    });
    it('Should revert when called more than once', async () => {
      await anotherVaultRebalancer.initializeVaultShares(minAmount);

      await expect(
        anotherVaultRebalancer.initializeVaultShares(minAmount)
      ).to.be.revertedWithCustomError(
        anotherVaultRebalancer,
        'InterestVault__VaultAlreadyInitialized'
      );
    });
    it('Should revert when initial asset amount is less than minAmount', async () => {
      await expect(
        anotherVaultRebalancer.initializeVaultShares(minAmount - 1n)
      ).to.be.revertedWithCustomError(
        anotherVaultRebalancer,
        'InterestVault__AmountLessThanMin'
      );
    });
    it('Should initialize the vault', async () => {
      let tx = await anotherVaultRebalancer.initializeVaultShares(minAmount);

      let balanceVault = await anotherVaultRebalancer.balanceOf(
        await anotherVaultRebalancer.getAddress()
      );

      expect(await anotherVaultRebalancer.totalAssets()).to.equal(minAmount);
      expect(balanceVault).to.equal(minAmount);
      // Should emit VaultInitialized event
      await expect(tx)
        .to.emit(anotherVaultRebalancer, 'VaultInitialized')
        .withArgs(deployer.address);
    });
  });

  describe('deposit', async () => {
    it('Should revert when receiver is invalid', async () => {
      await expect(
        deposit(alice, vaultRebalancer, DEPOSIT_AMOUNT, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'InterestVault__InvalidInput'
      );
    });
    it('Should revert when deposit amount is invalid', async () => {
      await expect(
        deposit(alice, vaultRebalancer, 0n)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'InterestVault__InvalidInput'
      );
    });
    it('Should revert when deposit amount is more than userDepositLimit', async () => {
      await expect(
        deposit(alice, vaultRebalancer, userDepositLimit + 1n)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'InterestVault__DepositMoreThanMax'
      );
    });
    it('Should revert when deposit amount is more than vaultDepositLimit', async () => {
      await deposit(alice, vaultRebalancer, maxDepositVault / 3n);
      await deposit(bob, vaultRebalancer, maxDepositVault / 3n);
      await deposit(charlie, vaultRebalancer, maxDepositVault / 3n);

      await expect(
        deposit(trent, vaultRebalancer, 1n)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'InterestVault__DepositMoreThanMax'
      );
    });
    it('Should revert when deposit amount is less than minAmount', async () => {
      await expect(
        deposit(alice, vaultRebalancer, minAmount - 1n)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'InterestVault__AmountLessThanMin'
      );
    });
    it('Should revert when the vault is paused', async () => {
      await vaultRebalancer.pause(0);
      // We get this error because of _validateDeposit when vault is paused
      await expect(
        deposit(alice, vaultRebalancer, DEPOSIT_AMOUNT)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'InterestVault__DepositMoreThanMax'
      );
    });
    it('Should deposit assets', async () => {
      let previousBalance = await vaultRebalancer.balanceOf(alice.address);

      let tx = await deposit(alice, vaultRebalancer, DEPOSIT_AMOUNT);

      let mintedShares =
        (await vaultRebalancer.balanceOf(alice.address)) - previousBalance;
      let assetBalance = await vaultRebalancer.convertToAssets(mintedShares);

      expect(assetBalance).to.equal(DEPOSIT_AMOUNT);
      expect(await vaultRebalancer.totalAssets()).to.equal(
        DEPOSIT_AMOUNT + minAmount
      );
      // Should emit Deposit event
      await expect(tx)
        .to.emit(vaultRebalancer, 'Deposit')
        .withArgs(alice.address, alice.address, DEPOSIT_AMOUNT, mintedShares);
    });
  });

  describe('mint', async () => {
    it('Should revert when shares amount is more than userDepositLimit', async () => {
      let maxMint = await vaultRebalancer.convertToShares(userDepositLimit);
      await expect(
        mint(alice, vaultRebalancer, maxMint + 1n)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'InterestVault__DepositMoreThanMax'
      );
    });
    it('Should mint shares', async () => {
      let tx = await mint(alice, vaultRebalancer, DEPOSIT_AMOUNT);

      let mintedShares = await vaultRebalancer.balanceOf(alice.address);
      let assets = await vaultRebalancer.previewMint(DEPOSIT_AMOUNT);

      expect(mintedShares).to.equal(DEPOSIT_AMOUNT);

      // Should emit Deposit event
      await expect(tx)
        .to.emit(vaultRebalancer, 'Deposit')
        .withArgs(alice.address, alice.address, assets, DEPOSIT_AMOUNT);
    });
  });

  describe('withdraw', async () => {
    it('Should revert when receiver is invalid', async () => {
      await expect(
        withdraw(alice, vaultRebalancer, DEPOSIT_AMOUNT, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'InterestVault__InvalidInput'
      );
    });
    it('Should revert when owner is invalid', async () => {
      await expect(
        withdraw(
          alice,
          vaultRebalancer,
          DEPOSIT_AMOUNT,
          alice.address,
          ethers.ZeroAddress
        )
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'InterestVault__InvalidInput'
      );
    });
    it('Should revert when amount to withdraw is invalid', async () => {
      await expect(
        withdraw(alice, vaultRebalancer, 0n)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'InterestVault__InvalidInput'
      );
    });
    it('Should revert when the vault is paused', async () => {
      await vaultRebalancer.pause(1);

      await deposit(alice, vaultRebalancer, DEPOSIT_AMOUNT);

      await expect(
        withdraw(alice, vaultRebalancer, DEPOSIT_AMOUNT)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'VaultPausable__ActionPaused'
      );
    });
    it('Should withdraw max possible when withdraw amount is more than available', async () => {
      let moreThanAvailable = DEPOSIT_AMOUNT * 2n;

      await deposit(alice, vaultRebalancer, DEPOSIT_AMOUNT);

      let previousBalance = await mainAsset.balanceOf(alice.address);

      await withdraw(alice, vaultRebalancer, moreThanAvailable);

      let newBalance =
        previousBalance +
        DEPOSIT_AMOUNT -
        (DEPOSIT_AMOUNT * WITHDRAW_FEE_PERCENT) / PRECISION_CONSTANT;

      expect(await mainAsset.balanceOf(alice.address)).to.equal(newBalance);
      expect(await vaultRebalancer.balanceOf(alice.address)).to.equal(0);
    });
    it('Should withdraw assets', async () => {
      let shares = await vaultRebalancer.previewWithdraw(DEPOSIT_AMOUNT);
      let feeAmount =
        (DEPOSIT_AMOUNT * WITHDRAW_FEE_PERCENT) / PRECISION_CONSTANT;
      let withdrawAmount = DEPOSIT_AMOUNT - feeAmount;

      await deposit(alice, vaultRebalancer, DEPOSIT_AMOUNT);

      let previousBalanceAlice = await mainAsset.balanceOf(alice.address);
      let previousBalanceTreasury = await mainAsset.balanceOf(deployer.address);

      let tx = await withdraw(alice, vaultRebalancer, DEPOSIT_AMOUNT);

      expect(await mainAsset.balanceOf(alice.address)).to.equal(
        previousBalanceAlice + withdrawAmount
      );
      expect(await mainAsset.balanceOf(deployer.address)).to.equal(
        previousBalanceTreasury + feeAmount
      );
      expect(await vaultRebalancer.balanceOf(alice.address)).to.equal(0);
      expect(await vaultRebalancer.totalAssets()).to.equal(minAmount);

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
        .withArgs(deployer.address, DEPOSIT_AMOUNT, feeAmount);
    });
  });

  describe('redeem', async () => {
    it('Should redeem max possible when redeem amount is more than available', async () => {
      let moreThanAvailable = DEPOSIT_AMOUNT * 2n;

      await mint(alice, vaultRebalancer, DEPOSIT_AMOUNT);

      let assets = await vaultRebalancer.previewRedeem(DEPOSIT_AMOUNT);
      let previousBalance = await mainAsset.balanceOf(alice.address);

      let newBalance =
        previousBalance +
        assets -
        (assets * WITHDRAW_FEE_PERCENT) / PRECISION_CONSTANT;

      await redeem(alice, vaultRebalancer, moreThanAvailable);

      expect(await mainAsset.balanceOf(alice.address)).to.equal(newBalance);
      expect(await vaultRebalancer.balanceOf(alice.address)).to.equal(0);
    });
    it('Should redeem shares', async () => {
      await mint(alice, vaultRebalancer, DEPOSIT_AMOUNT);

      let previousBalanceAlice = await mainAsset.balanceOf(alice.address);
      let previousBalanceTreasury = await mainAsset.balanceOf(deployer.address);
      let previousShares = await vaultRebalancer.balanceOf(alice.address);

      let assets = await vaultRebalancer.previewRedeem(DEPOSIT_AMOUNT);
      let feeAmount = (assets * WITHDRAW_FEE_PERCENT) / PRECISION_CONSTANT;
      let withdrawAmount = assets - feeAmount;

      let tx = await redeem(alice, vaultRebalancer, DEPOSIT_AMOUNT);

      expect(await mainAsset.balanceOf(alice.address)).to.equal(
        previousBalanceAlice + withdrawAmount
      );
      expect(await mainAsset.balanceOf(deployer.address)).to.equal(
        previousBalanceTreasury + feeAmount
      );
      expect(await vaultRebalancer.balanceOf(alice.address)).to.equal(
        previousShares - DEPOSIT_AMOUNT
      );

      // Should emit Withdraw event
      await expect(tx)
        .to.emit(vaultRebalancer, 'Withdraw')
        .withArgs(
          alice.address,
          alice.address,
          alice.address,
          withdrawAmount,
          DEPOSIT_AMOUNT
        );
      // Should emit FeesCharged event
      await expect(tx)
        .to.emit(vaultRebalancer, 'FeesCharged')
        .withArgs(deployer.address, DEPOSIT_AMOUNT, feeAmount);
    });
  });

  describe('transfer', async () => {
    it('Should transfer shares', async () => {
      await deposit(alice, vaultRebalancer, DEPOSIT_AMOUNT);

      await vaultRebalancer.connect(alice).approve(bob.address, DEPOSIT_AMOUNT);

      await vaultRebalancer
        .connect(bob)
        .transferFrom(alice.address, bob.address, DEPOSIT_AMOUNT);
      await vaultRebalancer
        .connect(bob)
        .transfer(alice.address, DEPOSIT_AMOUNT / 2n);

      expect(await vaultRebalancer.balanceOf(bob.address)).to.equal(
        DEPOSIT_AMOUNT / 2n
      );
      expect(await vaultRebalancer.balanceOf(alice.address)).to.equal(
        DEPOSIT_AMOUNT / 2n
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

      await deposit(alice, vaultRebalancer, DEPOSIT_AMOUNT);
      await deposit(bob, vaultRebalancer, DEPOSIT_AMOUNT);
      await deposit(charlie, vaultRebalancer, DEPOSIT_AMOUNT);
    });
    it('Should revert when caller is invalid', async () => {
      await expect(
        vaultRebalancer
          .connect(alice)
          .rebalance(
            DEPOSIT_AMOUNT,
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
          DEPOSIT_AMOUNT,
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
          DEPOSIT_AMOUNT,
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
        (DEPOSIT_AMOUNT * MAX_REBALANCE_FEE) / PRECISION_CONSTANT + 1n;

      await expect(
        vaultRebalancer.rebalance(
          DEPOSIT_AMOUNT,
          await providerA.getAddress(),
          await providerB.getAddress(),
          excessRebalanceFee,
          true
        )
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        'VaultRebalancer__ExcessRebalanceFee'
      );
    });
    it('Should partially rebalance the vault', async () => {
      let assetsAliceAndBob = 2n * DEPOSIT_AMOUNT;
      let assetsCharlie =
        DEPOSIT_AMOUNT + (await vaultRebalancer.convertToAssets(minAmount));

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
        3n * DEPOSIT_AMOUNT +
        (await vaultRebalancer.convertToAssets(minAmount)); // alice, bob, charlie

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
    let newWithdrawFeePercent: bigint;
    beforeEach(async () => {
      newWithdrawFeePercent = ethers.parseEther('0.0005');
    });
    it('Should revert when called by non-admin', async () => {
      await expect(
        vaultRebalancer.connect(alice).setWithdrawFee(newWithdrawFeePercent)
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
      let tx = await vaultRebalancer.setWithdrawFee(newWithdrawFeePercent);

      expect(await vaultRebalancer.withdrawFeePercent()).to.equal(
        newWithdrawFeePercent
      );
      // Should emit WithdrawFeeChanged event
      await expect(tx)
        .to.emit(vaultRebalancer, 'WithdrawFeeChanged')
        .withArgs(newWithdrawFeePercent);
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
      await deposit(alice, vaultRebalancer, maxDepositVault / 3n);
      await deposit(bob, vaultRebalancer, maxDepositVault / 3n);
      await deposit(charlie, vaultRebalancer, maxDepositVault / 3n);

      expect(await vaultRebalancer.maxDeposit(trent.address)).to.equal(0);
    });
    it('Should return 0 when userDepositLimit is reached', async () => {
      await deposit(alice, vaultRebalancer, DEPOSIT_AMOUNT);
      await deposit(bob, vaultRebalancer, DEPOSIT_AMOUNT);
      await deposit(alice, vaultRebalancer, userDepositLimit - DEPOSIT_AMOUNT);
      await deposit(bob, vaultRebalancer, userDepositLimit - DEPOSIT_AMOUNT);

      expect(await vaultRebalancer.maxDeposit(alice.address)).to.equal(0);
      expect(await vaultRebalancer.maxDeposit(bob.address)).to.equal(0);
    });
    it('Should return maxDeposit', async () => {
      await deposit(alice, vaultRebalancer, DEPOSIT_AMOUNT);
      await deposit(bob, vaultRebalancer, userDepositLimit);
      await deposit(charlie, vaultRebalancer, DEPOSIT_AMOUNT * 2n);

      expect(await vaultRebalancer.maxDeposit(alice.address)).to.equal(
        userDepositLimit - DEPOSIT_AMOUNT
      );
      expect(await vaultRebalancer.maxDeposit(charlie.address)).to.equal(
        userDepositLimit - DEPOSIT_AMOUNT * 2n
      );
      expect(await vaultRebalancer.maxDeposit(bob.address)).to.equal(0);

      await deposit(alice, vaultRebalancer, userDepositLimit - DEPOSIT_AMOUNT);

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
      await mint(alice, vaultRebalancer, maxDepositVault / 3n);
      await mint(bob, vaultRebalancer, maxDepositVault / 3n);
      await mint(charlie, vaultRebalancer, maxDepositVault / 3n);

      expect(await vaultRebalancer.maxMint(trent.address)).to.equal(0);
    });
    it('Should return 0 when userDepositLimit is reached', async () => {
      await mint(alice, vaultRebalancer, DEPOSIT_AMOUNT);
      await mint(bob, vaultRebalancer, DEPOSIT_AMOUNT);
      await mint(alice, vaultRebalancer, userDepositLimit - DEPOSIT_AMOUNT);
      await mint(bob, vaultRebalancer, userDepositLimit - DEPOSIT_AMOUNT);

      expect(await vaultRebalancer.maxMint(alice.address)).to.equal(0);
      expect(await vaultRebalancer.maxMint(bob.address)).to.equal(0);
    });
    it('Should return maxMint', async () => {
      await mint(alice, vaultRebalancer, DEPOSIT_AMOUNT);
      await mint(bob, vaultRebalancer, userDepositLimit);
      await mint(charlie, vaultRebalancer, DEPOSIT_AMOUNT * 2n);

      expect(await vaultRebalancer.maxMint(alice.address)).to.equal(
        userDepositLimit - DEPOSIT_AMOUNT
      );
      expect(await vaultRebalancer.maxMint(charlie.address)).to.equal(
        userDepositLimit - DEPOSIT_AMOUNT * 2n
      );
      expect(await vaultRebalancer.maxMint(bob.address)).to.equal(0);

      await mint(alice, vaultRebalancer, userDepositLimit - DEPOSIT_AMOUNT);

      let vaultCapacityLeft = await vaultRebalancer.getVaultCapacity();

      expect(await vaultRebalancer.maxMint(trent.address)).to.equal(
        vaultCapacityLeft
      );
    });
  });

  describe('maxWithdraw', async () => {
    it('Should return 0 when withdraws are paused', async () => {
      await deposit(alice, vaultRebalancer, DEPOSIT_AMOUNT);
      await vaultRebalancer.pause(1);

      expect(await vaultRebalancer.maxWithdraw(alice.address)).to.equal(0);
    });
    it('Should return maxWithdraw', async () => {
      await deposit(alice, vaultRebalancer, DEPOSIT_AMOUNT);

      let balanceAlice = await vaultRebalancer.balanceOf(alice.address);
      let maxWithdraw = await vaultRebalancer.previewRedeem(balanceAlice);

      expect(await vaultRebalancer.maxWithdraw(alice.address)).to.equal(
        maxWithdraw
      );
    });
  });

  describe('maxRedeem', async () => {
    it('Should return 0 when withdraws are paused', async () => {
      await deposit(alice, vaultRebalancer, DEPOSIT_AMOUNT);
      await vaultRebalancer.pause(1);

      expect(await vaultRebalancer.maxRedeem(alice.address)).to.equal(0);
    });
    it('Should return maxRedeem', async () => {
      await deposit(alice, vaultRebalancer, DEPOSIT_AMOUNT);
      let maxRedeem = await vaultRebalancer.previewWithdraw(DEPOSIT_AMOUNT);

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
      await deposit(alice, vaultRebalancer, maxDepositVault / 3n);
      await deposit(bob, vaultRebalancer, maxDepositVault / 3n);
      await deposit(charlie, vaultRebalancer, maxDepositVault / 3n);

      expect(await vaultRebalancer.getVaultCapacity()).to.equal(0);
    });
    it('Should return vault capacity', async () => {
      await deposit(alice, vaultRebalancer, DEPOSIT_AMOUNT);

      expect(await vaultRebalancer.getVaultCapacity()).to.equal(
        maxDepositVault - DEPOSIT_AMOUNT
      );
    });
  });

  describe('getBalanceOfAsset', async () => {
    it('Should return the balance of the asset', async () => {
      await deposit(alice, vaultRebalancer, DEPOSIT_AMOUNT);
      let balance = await vaultRebalancer.getBalanceOfAsset(alice.address);

      expect(balance).to.equal(DEPOSIT_AMOUNT);
    });
  });
});
