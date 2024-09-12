import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import { WITHDRAW_FEE_PERCENT } from '../../utils/helper';
import { ARBITRUM_SEPOLIA_CHAIN_ID } from '../../utils/constants';
import { verify } from '../../utils/verify';

const deployUsdcVault: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  // @ts-ignore
  const { getNamedAccounts, deployments } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  const name = 'Rebalance tUSDC';
  const symbol = 'rtUSDC';

  const usdcAddress = '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d'; // Aave v3 USDC address

  const userDepositLimit = ethers.parseUnits('100000000000', 6); // 100 billion
  const vaultDepositLimit = ethers.parseUnits('200000000000', 6); // 200 billion
  const initAmount = ethers.parseUnits('1', 6); // Be sure that you have the balance available in the deployer account

  log('----------------------------------------------------');
  log('Deploying USDC VaultRebalancer...');

  const rewardsDistributor = await deploy('RewardsDistributor', {
    from: deployer,
    args: [],
    log: true,
  });

  const [vaultManager, aaveV3Provider] = await Promise.all([
    deployments.get('VaultManager'),
    deployments.get('AaveV3ArbSepolia'),
  ]);

  const providers = [aaveV3Provider.address];

  const args = [
    vaultManager.address,
    usdcAddress,
    name,
    symbol,
    providers,
    userDepositLimit,
    vaultDepositLimit,
    WITHDRAW_FEE_PERCENT,
    rewardsDistributor.address,
    deployer,
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

  if (
    (await ethers.provider.getNetwork()).chainId === ARBITRUM_SEPOLIA_CHAIN_ID
  ) {
    await verify(usdcRebalancer.address, args);
    await verify(rewardsDistributor.address, []);
  }
};

export default deployUsdcVault;
deployUsdcVault.tags = ['all', 'sepolia-usdc'];
// deployUsdcVault.dependencies = ['vault-manager'];
