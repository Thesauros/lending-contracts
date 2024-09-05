export const networkUrls = {
  arbitrumOne: `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_PROJECT_ID}`,
  arbitrumSepolia: `https://arbitrum-sepolia.blockpi.network/v1/rpc/public`,
  avalanche: `https://avalanche-mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
  bsc: 'https://bsc-dataseed1.defibit.io', 
  //`https://bsc-mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
  sepolia: `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_PROJECT_ID}`,
};

export const networkConfig = {
  localhost: {
    chainId: 31337,
  },
  hardhat: {
    forking: {
      url: networkUrls.arbitrumOne,
      blockNumber: 233407190,
    },
  },
  arbitrumOne: {
    url: networkUrls.arbitrumOne,
    accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    chainId: 42161,
    gasPrice: 100000000,
  },
  arbitrumSepolia: {
    url: networkUrls.arbitrumSepolia,
    accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    chainId: 421614,
  },
  avalanche: {
    url: networkUrls.avalanche,
    accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    chainId: 43114,
    gasPrice: 30000000000,
  },
  bsc: {
    url: networkUrls.bsc,
    accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    chainId: 56,
    gasPrice: 2000000000,
  },
  sepolia: {
    url: networkUrls.sepolia,
    accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    chainId: 11155111,
    gasPrice: 100000000000,
  },
};
