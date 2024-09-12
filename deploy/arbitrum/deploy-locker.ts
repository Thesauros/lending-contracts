import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import {
  TREASURY_ADDRESS,
  ARBITRUM_CHAIN_ID,
  vaults,
} from '../../utils/constants';
import { verify } from '../../utils/verify';

const deployArbLocker: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  // @ts-ignore
  const { getNamedAccounts, deployments } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  log('----------------------------------------------------');
  log('Deploying InterestLocker...');

  const interestLocker = await deploy('InterestLocker', {
    from: deployer,
    args: [vaults],
    log: true,
  });
  log(`InterestLocker at ${interestLocker.address}`);

  const interestLockerInstance = await ethers.getContractAt(
    'InterestLocker',
    interestLocker.address
  );

  log('----------------------------------------------------');
  log('Transferring ownership to treasury...');

  await interestLockerInstance.transferOwnership(TREASURY_ADDRESS);

  if ((await ethers.provider.getNetwork()).chainId === ARBITRUM_CHAIN_ID) {
    await verify(interestLocker.address, [vaults]);
  }
};

export default deployArbLocker;
deployArbLocker.tags = ['all', 'locker'];
