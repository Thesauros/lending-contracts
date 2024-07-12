import { network } from 'hardhat';
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
