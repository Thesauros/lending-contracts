import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import {
  USER_DEPOSIT_LIMIT,
  VAULT_DEPOSIT_LIMIT,
  WITHDRAW_FEE_PERCENT,
} from '../../utils/helper';
import {
  tokenAddresses,
  TREASURY_ADDRESS,
  ARBITRUM_CHAIN_ID,
} from '../../utils/constants';
import { verify } from '../../utils/verify';

const deployWethVault: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  // @ts-ignore
  const { getNamedAccounts, deployments } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  const name = 'Rebalance WETH';
  const symbol = 'rWETH';

  const wethAddress = tokenAddresses.WETH;

  const initAmount = ethers.parseEther('0.0001'); // Be sure that you have the balance available in the deployer account

  log('----------------------------------------------------');
  log('Deploying WETH VaultRebalancer...');

  const [
    vaultManager,
    compoundV3Provider,
    aaveV3Provider,
    siloProvider,
    dolomiteProvider,
    radiantV2Provider,
  ] = await Promise.all([
    deployments.get('VaultManager'),
    deployments.get('CompoundV3Arbitrum'),
    deployments.get('AaveV3Arbitrum'),
    deployments.get('SiloArbitrum'),
    deployments.get('DolomiteArbitrum'),
    deployments.get('RadiantV2Arbitrum'),
  ]);

  const providers = [
    compoundV3Provider.address,
    aaveV3Provider.address,
    siloProvider.address,
    dolomiteProvider.address,
    radiantV2Provider.address,
  ];

  const args = [
    vaultManager.address,
    wethAddress,
    name,
    symbol,
    providers,
    USER_DEPOSIT_LIMIT,
    VAULT_DEPOSIT_LIMIT,
    WITHDRAW_FEE_PERCENT,
    TREASURY_ADDRESS,
  ];

  const wethRebalancer = await deploy('VaultRebalancerV1', {
    from: deployer,
    args: args,
    log: true,
  });
  
  log(`WETH VaultRebalancer at ${wethRebalancer.address}`);
  log('----------------------------------------------------');

  if ((await ethers.provider.getNetwork()).chainId === ARBITRUM_CHAIN_ID) {
    await verify(wethRebalancer.address, args);
  }

  const wethRebalancerInstance = await ethers.getContractAt(
    'VaultRebalancerV1',
    wethRebalancer.address
  );
  const wethInstance = await ethers.getContractAt('IWETH', wethAddress);

  await wethInstance.deposit({ value: initAmount });
  await wethInstance.approve(wethRebalancer.address, initAmount);

  await wethRebalancerInstance.initializeVaultShares(initAmount);
};

export default deployWethVault;
deployWethVault.tags = ['all', 'arb-weth'];
// deployWethVault.dependencies = ['vault-manager', 'arb-providers'];
