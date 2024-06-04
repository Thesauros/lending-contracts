import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import 'hardhat-contract-sizer';
import 'hardhat-deploy';
import 'hardhat-deploy-ethers';
import '@openzeppelin/hardhat-upgrades';
import * as dotenv from 'dotenv';

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.23',
    settings: { optimizer: { enabled: true, runs: 1 } },
  },
  mocha: {
    timeout: 150000000,
  },
  contractSizer: { runOnCompile: true },
  networks: {
    localhost: {
      chainId: 31337,
    },
    hardhat: {
      forking: {
        url: `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_PROJECT_ID}`,
        // blockNumber: 182354000,
        // blockNumber: 197879010,
        blockNumber: 218341994,
      },
      gasPrice: 100000000,
    },
    goerli: {
      url: `https://eth-goerli.g.alchemy.com/v2/${process.env.ALCHEMY_PROJECT_ID}`,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 5,
    },
    sepolia: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_PROJECT_ID}`,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111,
      gasPrice: 35000000000,
    },
    arbitrumOne: {
      url: `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_PROJECT_ID}`,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 42161,
      gasPrice: 10000000,
    },
    arbitrumInfura: {
      url: `https://arbitrum-mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 42161,
    },
  },
  gasReporter: {
    enabled: true,
    currency: 'USD',
    outputFile: 'gas-report.txt',
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    noColors: true,
    gasPrice: 1,
  },
  etherscan: {
    apiKey: {
      arbitrumOne: process.env.ARBISCAN_API_KEY || '',
      sepolia: process.env.ETHERSCAN_API_KEY || '',
    },
  },
  namedAccounts: {
    deployer: 0,
  },
};

export default config;
