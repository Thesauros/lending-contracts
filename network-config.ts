export const networkUrls = {
  arbitrumOne: `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_PROJECT_ID}`,
  avalanche: `https://avalanche-mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
  sepolia: `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_PROJECT_ID}`,
};

export const networkConfig = {
  localhost: {
    chainId: 31337,
  },
  hardhat: {
    forking: {
      url: networkUrls.arbitrumOne,
      blockNumber: 218341994,
    },
    gasPrice: 1000000000,
  },
  arbitrumOne: {
    url: networkUrls.arbitrumOne,
    accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    chainId: 42161,
    gasPrice: 100000000,
  },
  avalanche: {
    url: networkUrls.avalanche,
    accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    chainId: 43114,
  },
  sepolia: {
    url: networkUrls.sepolia,
    accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    chainId: 11155111,
    gasPrice: 100000000000,
  },
};
