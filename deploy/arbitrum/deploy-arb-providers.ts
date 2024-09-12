import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import {
  lodestarPairs,
  cometPairs,
  ARBITRUM_CHAIN_ID,
} from '../../utils/constants';
import { verify } from '../../utils/verify';

const deployArbProviders: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  // @ts-ignore
  const { getNamedAccounts, deployments } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  const providersToDeploy = [
    'AaveV3Arbitrum',
    'RadiantV2Arbitrum',
    'CompoundV3Arbitrum',
    'SiloArbitrum',
    'DolomiteArbitrum',
    'LodestarArbitrum',
  ];

  log('----------------------------------------------------');
  log('Deploying ProviderManager...');

  const providerManager = await deploy('ProviderManager', {
    from: deployer,
    args: [],
    log: true,
  });

  if ((await ethers.provider.getNetwork()).chainId === ARBITRUM_CHAIN_ID) {
    await verify(providerManager.address, []);
  }

  log(`ProviderManager at ${providerManager.address}`);

  const providerManagerInstance = await ethers.getContractAt(
    'ProviderManager',
    providerManager.address
  );

  log('----------------------------------------------------');
  log('Setting up protocol tokens...');

  for (const { asset, cToken } of cometPairs) {
    await providerManagerInstance.setProtocolToken(
      'Compound_V3_Arbitrum',
      asset,
      cToken
    );
  }

  for (const { asset, lToken } of lodestarPairs) {
    await providerManagerInstance.setProtocolToken(
      'Lodestar_Arbitrum',
      asset,
      lToken
    );
  }

  log('----------------------------------------------------');
  log('Deploying all the providers...');

  for (const providerName of providersToDeploy) {
    const args =
      providerName === 'CompoundV3Arbitrum' ||
      providerName === 'LodestarArbitrum'
        ? [providerManager.address]
        : [];

    const provider = await deploy(providerName, {
      from: deployer,
      args: args,
      log: true,
    });

    log(`${providerName} deployed at ${provider.address}`);
    log('----------------------------------------------------');

    if ((await ethers.provider.getNetwork()).chainId === ARBITRUM_CHAIN_ID) {
      await verify(provider.address, args);
    }
  }
};

export default deployArbProviders;
deployArbProviders.tags = ['all', 'arb-providers'];
