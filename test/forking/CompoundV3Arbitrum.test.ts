import { ethers } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import {
  VaultRebalancerV2__factory,
  VaultRebalancerV2,
  ProviderManager__factory,
  ProviderManager,
  CompoundV3Arbitrum__factory,
  CompoundV3Arbitrum,
  ISwapRouter,
  IERC20,
  IWETH,
} from '../../typechain-types';
import { moveTime } from '../../utils/move-time';
import { moveBlocks } from '../../utils/move-blocks';

describe('CompoundV3Arbitrum', async () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let PRECISION_CONSTANT: bigint;

  let minAmount: bigint;
  let depositAmount: bigint;
  let mintAmount: bigint;
  let swapAmount: bigint;

  let withdrawFeePercent: bigint;

  let userDepositLimit: bigint;
  let vaultDepositLimit: bigint;

  let vaultRebalancer: VaultRebalancerV2;

  let mainAsset: IERC20; // WETH contract on Arbitrum mainnet
  let wethContract: IWETH;

  let providerManager: ProviderManager;
  let compoundProvider: CompoundV3Arbitrum;

  let uniswapRouter: string; // Uniswap Router address
  let routerContract: ISwapRouter;

  let cUSDC: string; // cUSDC.e on Arbitrum Mainnet
  let WETH: string; // WETH address on Arbitrum mainnet
  let USDC: string; // USDC.e address on Arbitrum mainnet

  before(async () => {
    [deployer, alice, bob] = await ethers.getSigners();

    PRECISION_CONSTANT = ethers.parseEther('1');

    uniswapRouter = '0xE592427A0AEce92De3Edee1F18E0157C05861564';

    cUSDC = '0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA';
    WETH = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';
    USDC = '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8';

    minAmount = ethers.parseUnits('1', 6);
    depositAmount = ethers.parseUnits('100', 6);
    mintAmount = ethers.parseEther('10');
    swapAmount = ethers.parseEther('5');

    withdrawFeePercent = ethers.parseEther('0.001'); // 0.1%

    userDepositLimit = ethers.parseUnits('1000', 6);
    vaultDepositLimit = ethers.parseUnits('3000', 6) + minAmount;
  });

  beforeEach(async () => {
    mainAsset = await ethers.getContractAt('IERC20', USDC);
    wethContract = await ethers.getContractAt('IWETH', WETH);

    // Set up WETH balances for deployer, alice and bob
    await Promise.all([
      wethContract.connect(deployer).deposit({ value: mintAmount }),
      wethContract.connect(alice).deposit({ value: mintAmount }),
      wethContract.connect(bob).deposit({ value: mintAmount }),
    ]);

    // Set up USDC.e balances for deployer

    // @ts-ignore: Object is possibly 'null'.
    let timestamp = (await ethers.provider.getBlock('latest')).timestamp;

    routerContract = await ethers.getContractAt('ISwapRouter', uniswapRouter);

    let exactInputParams = {
      tokenIn: WETH,
      tokenOut: USDC,
      fee: 10000,
      recipient: deployer.address,
      deadline: timestamp + 100,
      amountIn: swapAmount,
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0,
    };
    await routerContract.exactInputSingle(exactInputParams, {
      value: swapAmount,
    });

    await mainAsset.transfer(alice.address, depositAmount);
    await mainAsset.transfer(bob.address, depositAmount);

    providerManager = await new ProviderManager__factory(deployer).deploy();
    // Set up providerManager
    await providerManager.setProtocolToken('Compound_V3_Arbitrum', USDC, cUSDC);

    compoundProvider = await new CompoundV3Arbitrum__factory(deployer).deploy(
      await providerManager.getAddress()
    );

    // Treasury and Rebalancer is the deployer for testing purposes.

    vaultRebalancer = await new VaultRebalancerV2__factory(deployer).deploy(
      deployer.address,
      USDC,
      'Rebalance tUSDC',
      'rtUSDC',
      [await compoundProvider.getAddress()],
      userDepositLimit,
      vaultDepositLimit,
      withdrawFeePercent,
      deployer.address
    );

    Promise.all([
      mainAsset
        .connect(deployer)
        .approve(await vaultRebalancer.getAddress(), ethers.MaxUint256),
      mainAsset
        .connect(alice)
        .approve(await vaultRebalancer.getAddress(), ethers.MaxUint256),
      mainAsset
        .connect(bob)
        .approve(await vaultRebalancer.getAddress(), ethers.MaxUint256),
    ]);

    await vaultRebalancer.connect(deployer).initializeVaultShares(minAmount);
  });

  describe('getProviderName', async () => {
    it('Should get the provider name', async () => {
      expect(await compoundProvider.getProviderName()).to.equal(
        'Compound_V3_Arbitrum'
      );
    });
  });

  describe('getProviderManager', async () => {
    it('Should get the provider manager', async () => {
      expect(await compoundProvider.getProviderManager()).to.equal(
        await providerManager.getAddress()
      );
    });
  });

  describe('deposit', async () => {
    it('Should deposit assets', async () => {
      let mintedSharesAliceBefore = await vaultRebalancer.balanceOf(
        alice.address
      );
      let assetBalanceAliceBefore = await vaultRebalancer.convertToAssets(
        mintedSharesAliceBefore
      );
      let mintedSharesBobBefore = await vaultRebalancer.balanceOf(bob.address);
      let assetBalanceBobBefore = await vaultRebalancer.convertToAssets(
        mintedSharesBobBefore
      );
      await vaultRebalancer
        .connect(alice)
        .deposit(depositAmount, alice.address);
      await vaultRebalancer.connect(bob).deposit(depositAmount, bob.address);

      let mintedSharesAliceAfter = await vaultRebalancer.balanceOf(
        alice.address
      );
      let assetBalanceAliceAfter = await vaultRebalancer.convertToAssets(
        mintedSharesAliceAfter
      );
      let mintedSharesBobAfter = await vaultRebalancer.balanceOf(bob.address);
      let assetBalanceBobAfter = await vaultRebalancer.convertToAssets(
        mintedSharesBobAfter
      );

      expect(assetBalanceAliceAfter - assetBalanceAliceBefore).to.be.closeTo(
        depositAmount,
        depositAmount / 1000n
      );
      expect(assetBalanceBobAfter - assetBalanceBobBefore).to.be.closeTo(
        depositAmount,
        depositAmount / 1000n
      );
    });
  });

  describe('withdraw', async () => {
    it('Should withdraw assets', async () => {
      await vaultRebalancer
        .connect(alice)
        .deposit(depositAmount, alice.address);

      await moveTime(60); // Move 60 seconds
      await moveBlocks(3); // Move 3 blocks

      let maxWithdrawable = await vaultRebalancer.maxWithdraw(alice.address);
      let previousBalanceAlice = await mainAsset.balanceOf(alice.address);
      await vaultRebalancer
        .connect(alice)
        .withdraw(maxWithdrawable, alice.address, alice.address);

      let afterBalanceAlice =
        previousBalanceAlice +
        maxWithdrawable -
        (maxWithdrawable * withdrawFeePercent) / PRECISION_CONSTANT;

      expect(await mainAsset.balanceOf(alice.address)).to.equal(
        afterBalanceAlice
      );
    });
  });

  describe('balances', async () => {
    it('Should get balances', async () => {
      await vaultRebalancer
        .connect(alice)
        .deposit(depositAmount, alice.address);
      expect(await vaultRebalancer.totalAssets()).to.be.closeTo(
        depositAmount + minAmount,
        depositAmount / 1000n
      );
    });
  });

  describe('interest rates', async () => {
    it('Should get interest rates', async () => {
      await vaultRebalancer
        .connect(alice)
        .deposit(depositAmount, alice.address);
      let depositRate = await compoundProvider.getDepositRateFor(
        await vaultRebalancer.getAddress()
      );
      expect(depositRate).to.be.greaterThan(0);
    });
  });
});
