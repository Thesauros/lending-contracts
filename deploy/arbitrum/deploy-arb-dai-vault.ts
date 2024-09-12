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

const deployDaiVault: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  // @ts-ignore
  const { getNamedAccounts, deployments } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  const name = 'Rebalance DAI';
  const symbol = 'rDAI';

  const daiAddress = tokenAddresses.DAI;

  const initAmount = ethers.parseEther('0.0001'); // Be sure that you have the balance available in the deployer account

  log('----------------------------------------------------');
  log('Deploying DAI VaultRebalancer...');

  const [vaultManager, aaveV3Provider, dolomiteProvider, radiantV2Provider] =
    await Promise.all([
      deployments.get('VaultManager'),
      deployments.get('AaveV3Arbitrum'),
      deployments.get('DolomiteArbitrum'),
      deployments.get('RadiantV2Arbitrum'),
    ]);

  const providers = [
    aaveV3Provider.address,
    dolomiteProvider.address,
    radiantV2Provider.address,
  ];

  const args = [
    vaultManager.address,
    daiAddress,
    name,
    symbol,
    providers,
    USER_DEPOSIT_LIMIT,
    VAULT_DEPOSIT_LIMIT,
    WITHDRAW_FEE_PERCENT,
    TREASURY_ADDRESS,
  ];

  const daiRebalancer = await deploy('VaultRebalancerV1', {
    from: deployer,
    args: args,
    log: true,
  });

  log(`DAI VaultRebalancer at ${daiRebalancer.address}`);
  log('----------------------------------------------------');

  const daiRebalancerInstance = await ethers.getContractAt(
    'VaultRebalancerV1',
    daiRebalancer.address
  );
  const daiInstance = await ethers.getContractAt('IERC20', daiAddress);

  await daiInstance.approve(daiRebalancer.address, initAmount);

  await daiRebalancerInstance.initializeVaultShares(initAmount);

  if ((await ethers.provider.getNetwork()).chainId === ARBITRUM_CHAIN_ID) {
    await verify(daiRebalancer.address, args);
  }
};

export default deployDaiVault;
deployDaiVault.tags = ['all', 'arb-dai'];
// deployDaiVault.dependencies = ['vault-manager', 'arb-providers'];
