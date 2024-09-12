export const tokenAddresses = {
  WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
  FRAX: '0x17FC002b466eEc40DaE837Fc4bE5c67993ddBd6F',
  USDC_e: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
};

export const cometTokens = {
  cWETH: '0x6f7D514bbD4aFf3BcD1140B7344b32f063dEe486',
  cUSDT: '0xd98Be00b5D27fc98112BdE293e487f8D4cA57d07',
  cUSDC: '0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf',
  cUSDC_e: '0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA',
};

export const lodestarTokens = {
  lETH: '0x2193c45244AF12C280941281c8aa67dD08be0a64',
  lUSDT: '0x9365181A7df82a1cC578eAE443EFd89f00dbb643',
  lUSDC: '0x4C9aAed3b8c443b4b634D1A189a5e25C604768dE',
  lDAI: '0x4987782da9a63bC3ABace48648B15546D821c720',
  lFRAX: '0xD12d43Cdf498e377D3bfa2c6217f05B466E14228',
  lUSDC_e: '0x1ca530f02DD0487cef4943c674342c5aEa08922F',
};

export const dforceTokens = {
  iETH: '0xEe338313f022caee84034253174FA562495dcC15',
  iDAI: '0xf6995955e4B0E5b287693c221f456951D612b628',
};

export const cometPairs = [
  {
    asset: tokenAddresses.WETH,
    cToken: cometTokens.cWETH,
  },
  {
    asset: tokenAddresses.USDT,
    cToken: cometTokens.cUSDT,
  },
  {
    asset: tokenAddresses.USDC,
    cToken: cometTokens.cUSDC,
  },
  {
    asset: tokenAddresses.USDC_e,
    cToken: cometTokens.cUSDC_e,
  },
];

export const lodestarPairs = [
  {
    asset: tokenAddresses.WETH,
    lToken: lodestarTokens.lETH,
  },
  {
    asset: tokenAddresses.USDT,
    lToken: lodestarTokens.lUSDT,
  },
  {
    asset: tokenAddresses.USDC,
    lToken: lodestarTokens.lUSDC,
  },
  {
    asset: tokenAddresses.DAI,
    lToken: lodestarTokens.lDAI,
  },
  {
    asset: tokenAddresses.FRAX,
    lToken: lodestarTokens.lFRAX,
  },
  {
    asset: tokenAddresses.USDC_e,
    lToken: lodestarTokens.lUSDC_e,
  },
];

export const vaults = [
  '0xcd5357A4F48823ebC86D17205C12B0B268d292a7',
  '0xCF86c768E5b8bcc823aC1D825F56f37c533d32F9',
  '0x6eAFd6Ae0B766BAd90e9226627285685b2d702aB',
  '0xa8aae282ab2e57B8E39ad2e70DA3566d315348A9',
  '0x5A0F7b7Ea13eDee7AD76744c5A6b92163e51a99a',
  '0x3BCa6513BF284026b4237880b4e4D60cC94F686c',
];

export const ARBITRUM_CHAIN_ID = 42161n;
export const ARBITRUM_SEPOLIA_CHAIN_ID = 421614n;

export const TREASURY_ADDRESS = '0xc8a682F0991323777253ffa5fa6F19035685E723';
