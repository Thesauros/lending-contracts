import { network } from 'hardhat';
import { JsonRpcProvider } from 'ethers';
import { networkUrls } from '../network-config';

export async function setForkToAvalanche() {
  await network.provider.request({
    method: 'hardhat_reset',
    params: [
      {
        forking: {
          jsonRpcUrl: networkUrls.avalanche,
          blockNumber: 47831216,
        },
      },
    ],
  });
}

export async function setForkToBinance() {
  // Ugly solution, but we have troubles with forking BSC
  const binanceProvider = new JsonRpcProvider(networkUrls.bsc);
  const latestBlock = await binanceProvider.getBlockNumber();
  await network.provider.request({
    method: 'hardhat_reset',
    params: [
      {
        forking: {
          jsonRpcUrl: networkUrls.bsc,
          blockNumber: latestBlock,
        },
      },
    ],
  });
}
