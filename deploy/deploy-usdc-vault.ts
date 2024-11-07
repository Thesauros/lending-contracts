import { ethers } from 'hardhat';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

import {
  ARBITRUM_CHAIN_ID,
  TREASURY_ADDRESS,
  WITHDRAW_FEE_PERCENT,
  OPERATOR_ROLE,
  tokenAddresses,
} from '../utils/constants';
import { verify } from '../utils/verify';

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

  const initialDeposit = ethers.parseUnits('1', 6); // Be sure that you have the balance available in the deployer account

  log('----------------------------------------------------');
  log('Deploying USDC Rebalancer...');

  const [vaultManager, timelock, compoundV3Provider, aaveV3Provider] =
    await Promise.all([
      deployments.get('VaultManager'),
      deployments.get('Timelock'),
      deployments.get('CompoundV3Provider'),
      deployments.get('AaveV3Provider'),
    ]);

  const providers = [compoundV3Provider.address, aaveV3Provider.address];

  const args = [
    usdcAddress,
    name,
    symbol,
    providers,
    WITHDRAW_FEE_PERCENT,
    timelock.address,
    TREASURY_ADDRESS,
  ];

  const usdcRebalancer = await deploy('Rebalancer', {
    from: deployer,
    args: args,
    log: true,
  });

  log(`USDC Rebalancer at ${usdcRebalancer.address}`);
  log('----------------------------------------------------');

  const usdcInstance = await ethers.getContractAt('IERC20', usdcAddress);
  await usdcInstance.approve(usdcRebalancer.address, initialDeposit);

  const usdcRebalancerInstance = await ethers.getContractAt(
    'VaultRebalancerV1',
    usdcRebalancer.address
  );
  await usdcRebalancerInstance.grantRole(OPERATOR_ROLE, vaultManager.address);
  await usdcRebalancerInstance.setupVault(initialDeposit);

  if ((await ethers.provider.getNetwork()).chainId === ARBITRUM_CHAIN_ID) {
    await verify(usdcRebalancer.address, args);
  }
};

export default deployUsdcVault;
deployUsdcVault.tags = ['all', 'usdc-vault'];
// deployUsdcVault.dependencies = ['vault-manager', 'providers', 'timelock'];
