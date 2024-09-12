import { ethers } from 'hardhat';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import {
  ARBITRUM_CHAIN_ID,
  ARBITRUM_SEPOLIA_CHAIN_ID,
} from '../utils/constants';
import { EXECUTOR_ROLE } from '../utils/helper';
import { verify } from '../utils/verify';

const deployVaultManager: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  // @ts-ignore
  const { getNamedAccounts, deployments } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  log('----------------------------------------------------');
  log('Deploying VaultManager...');

  const vaultManager = await deploy('VaultManager', {
    from: deployer,
    args: [deployer, deployer],
    log: true,
  });

  log(`VaultManager at ${vaultManager.address}`);

  const vaultManagerInstance = await ethers.getContractAt(
    'VaultManager',
    vaultManager.address
  );
  await vaultManagerInstance.revokeRole(EXECUTOR_ROLE, deployer);

  log('----------------------------------------------------');

  const chainId = (await ethers.provider.getNetwork()).chainId;

  if (chainId === ARBITRUM_CHAIN_ID || chainId === ARBITRUM_SEPOLIA_CHAIN_ID) {
    await verify(vaultManager.address, [deployer, deployer]);
  }
};

export default deployVaultManager;
deployVaultManager.tags = ['all', 'vault-manager'];
