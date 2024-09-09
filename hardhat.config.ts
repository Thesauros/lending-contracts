import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import 'hardhat-contract-sizer';
import 'hardhat-deploy';
import 'hardhat-deploy-ethers';
import '@openzeppelin/hardhat-upgrades';
import 'dotenv/config';

import { networkConfig } from './network-config';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.23',
    settings: { optimizer: { enabled: true, runs: 1 } },
  },
  mocha: {
    timeout: 150000000,
  },
  contractSizer: { runOnCompile: false },
  networks: networkConfig,
  gasReporter: {
    enabled: false,
    currency: 'USD',
    outputFile: 'gas-report.txt',
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    noColors: true,
    gasPrice: 1,
  },
  etherscan: {
    apiKey: {
      arbitrumOne: process.env.ARBISCAN_API_KEY || '',
      arbitrumSepolia: process.env.ARBISCAN_API_KEY || '',
      sepolia: process.env.ETHERSCAN_API_KEY || '',
      avalanche: 'snowtrace', // Snowtrace does not need an API key, only placeholder
      bsc: process.env.BSCSCAN_API_KEY || '',
    },
  },
  namedAccounts: {
    deployer: 0,
  },
};

export default config;
