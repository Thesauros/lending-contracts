import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import { WITHDRAW_FEE_PERCENT } from '../../utils/helper';
import {
  tokenAddresses,
  TREASURY_ADDRESS,
  ARBITRUM_CHAIN_ID,
} from '../../utils/constants';
import { verify } from '../../utils/verify';

const deployUsdcVault: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  // @ts-ignore
  const { getNamedAccounts, deployments } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  const name = 'Rebalance USDC';
  const symbol = 'rUSDC';

  const usdcAddress = tokenAddresses.USDC;

  const userDepositLimit = ethers.parseUnits('100000000000', 6); // 100 billion
  const vaultDepositLimit = ethers.parseUnits('200000000000', 6); // 200 billion
  const initAmount = ethers.parseUnits('1', 6); // Be sure that you have the balance available in the deployer account

  log('----------------------------------------------------');
  log('Deploying USDC VaultRebalancer...');

  const [
    vaultManager,
    compoundV3Provider,
    aaveV3Provider,
    dolomiteProvider,
    radiantV2Provider,
  ] = await Promise.all([
    deployments.get('VaultManager'),
    deployments.get('CompoundV3Arbitrum'),
    deployments.get('AaveV3Arbitrum'),
    deployments.get('DolomiteArbitrum'),
    deployments.get('RadiantV2Arbitrum'),
  ]);

  const providers = [
    compoundV3Provider.address,
    aaveV3Provider.address,
    dolomiteProvider.address,
    radiantV2Provider.address,
  ];

  const args = [
    vaultManager.address,
    usdcAddress,
    name,
    symbol,
    providers,
    userDepositLimit,
    vaultDepositLimit,
    WITHDRAW_FEE_PERCENT,
    TREASURY_ADDRESS,
  ];

  const usdcRebalancer = await deploy('VaultRebalancerV1', {
    from: deployer,
    args: args,
    log: true,
  });

  log(`USDC VaultRebalancer at ${usdcRebalancer.address}`);
  log('----------------------------------------------------');

  const usdcRebalancerInstance = await ethers.getContractAt(
    'VaultRebalancerV1',
    usdcRebalancer.address
  );
  const usdcInstance = await ethers.getContractAt('IERC20', usdcAddress);

  await usdcInstance.approve(usdcRebalancer.address, initAmount);

  await usdcRebalancerInstance.initializeVaultShares(initAmount);

  if ((await ethers.provider.getNetwork()).chainId === ARBITRUM_CHAIN_ID) {
    await verify(usdcRebalancer.address, args);
  }
};

export default deployUsdcVault;
deployUsdcVault.tags = ['all', 'arb-usdc'];
// deployUsdcVault.dependencies = ['vault-manager', 'arb-providers'];
