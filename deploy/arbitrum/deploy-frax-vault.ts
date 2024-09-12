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

const deployFraxVault: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  // @ts-ignore
  const { getNamedAccounts, deployments } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  const name = 'Rebalance FRAX';
  const symbol = 'rFRAX';

  const fraxAddress = tokenAddresses.FRAX;

  const initAmount = ethers.parseEther('1'); // Be sure that you have the balance available in the deployer account

  log('----------------------------------------------------');
  log('Deploying FRAX VaultRebalancer...');

  const [vaultManager, providerManager, aaveV3Provider] = await Promise.all([
    deployments.get('VaultManager'),
    deployments.get('ProviderManager'),
    deployments.get('AaveV3Arbitrum'),
  ]);

  const rewardsDistributor = await deploy('RewardsDistributor', {
    from: deployer,
    args: [],
    log: true,
  });

  const lodestarProvider = await deploy('LodestarArbitrum', {
    from: deployer,
    args: [providerManager.address],
    log: true,
  });

  const providers = [lodestarProvider.address, aaveV3Provider.address];

  const args = [
    vaultManager.address,
    fraxAddress,
    name,
    symbol,
    providers,
    USER_DEPOSIT_LIMIT,
    VAULT_DEPOSIT_LIMIT,
    WITHDRAW_FEE_PERCENT,
    rewardsDistributor.address,
    TREASURY_ADDRESS,
  ];

  const fraxRebalancer = await deploy('VaultRebalancerV2', {
    from: deployer,
    args: args,
    log: true,
  });

  log(`FRAX VaultRebalancer at ${fraxRebalancer.address}`);
  log('----------------------------------------------------');

  const fraxRebalancerInstance = await ethers.getContractAt(
    'VaultRebalancerV2',
    fraxRebalancer.address
  );
  const fraxInstance = await ethers.getContractAt('IERC20', fraxAddress);

  await fraxInstance.approve(fraxRebalancer.address, initAmount);

  await fraxRebalancerInstance.initializeVaultShares(initAmount);

  if ((await ethers.provider.getNetwork()).chainId === ARBITRUM_CHAIN_ID) {
    await verify(fraxRebalancer.address, args);
    await verify(rewardsDistributor.address, []);
    await verify(lodestarProvider.address, [providerManager.address]);
  }
};

export default deployFraxVault;
deployFraxVault.tags = ['all', 'frax-vault'];
// deployFraxVault.dependencies = ['vault-manager', 'providers'];
