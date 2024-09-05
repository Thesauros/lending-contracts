import { ethers } from 'hardhat';
import {
  IERC20,
  VaultRebalancerV2,
  VaultRebalancerV2__factory,
} from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

export interface VaultAssetPair {
  vault: VaultRebalancerV2;
  asset: IERC20;
}

export async function deployVault(
  signer: SignerWithAddress,
  asset: string,
  name: string,
  symbol: string,
  providers: string[],
  rebalancer: string = signer.address,
  userDepositLimit: bigint = USER_DEPOSIT_LIMIT,
  vaultDepositLimit: bigint = VAULT_DEPOSIT_LIMIT
) {
  // Treasury and Reward distributor is the signer for testing purposes
  return await new VaultRebalancerV2__factory(signer).deploy(
    rebalancer,
    asset,
    name,
    symbol,
    providers,
    userDepositLimit,
    vaultDepositLimit,
    WITHDRAW_FEE_PERCENT,
    signer.address,
    signer.address
  );
}

export async function deposit(
  signer: SignerWithAddress,
  vaultRebalancer: VaultRebalancerV2,
  depositAmount: bigint,
  receiver: string = signer.address
) {
  return await vaultRebalancer.connect(signer).deposit(depositAmount, receiver);
}

export async function mint(
  signer: SignerWithAddress,
  vaultRebalancer: VaultRebalancerV2,
  mintAmount: bigint,
  receiver: string = signer.address
) {
  return await vaultRebalancer.connect(signer).mint(mintAmount, receiver);
}

export async function withdraw(
  signer: SignerWithAddress,
  vaultRebalancer: VaultRebalancerV2,
  withdrawAmount: bigint,
  receiver: string = signer.address,
  owner: string = signer.address
) {
  return await vaultRebalancer
    .connect(signer)
    .withdraw(withdrawAmount, receiver, owner);
}

export async function redeem(
  signer: SignerWithAddress,
  vaultRebalancer: VaultRebalancerV2,
  redeemAmount: bigint,
  receiver: string = signer.address,
  owner: string = signer.address
) {
  return await vaultRebalancer
    .connect(signer)
    .redeem(redeemAmount, receiver, owner);
}

// Token addresses
export const tokenAddresses = {
  arbitrum: {
    WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    FRAX: '0x17FC002b466eEc40DaE837Fc4bE5c67993ddBd6F',
    USDC_e: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
  },
  avalanche: {
    WAVAX: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
    USDT: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
    USDC: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    USDT_e: '0xc7198437980c041c805A1EDcbA50c1Ce5db95118',
    USDC_e: '0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664',
    DAI_e: '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70',
  },
  bsc: {
    WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  },
};

// Comet's cTokens on Arbitrum
export const cometTokens = {
  cWETH: '0x6f7D514bbD4aFf3BcD1140B7344b32f063dEe486',
  cUSDT: '0xd98Be00b5D27fc98112BdE293e487f8D4cA57d07',
  cUSDC: '0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf',
  cUSDC_e: '0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA',
};

// Lodestar's lTokens on Arbitrum
export const lodestarTokens = {
  lETH: '0x2193c45244AF12C280941281c8aa67dD08be0a64',
  lUSDT: '0x9365181A7df82a1cC578eAE443EFd89f00dbb643',
  lUSDC: '0x4C9aAed3b8c443b4b634D1A189a5e25C604768dE',
  lDAI: '0x4987782da9a63bC3ABace48648B15546D821c720',
  lFRAX: '0xD12d43Cdf498e377D3bfa2c6217f05B466E14228',
  lUSDC_e: '0x1ca530f02DD0487cef4943c674342c5aEa08922F',
};

// DForce's iTokens on Arbitrum
export const dforceTokens = {
  iETH: '0xEe338313f022caee84034253174FA562495dcC15',
  iDAI: '0xf6995955e4B0E5b287693c221f456951D612b628',
};

// Benqi's qiTokens on Avalanche
export const benqiTokens = {
  qiAVAX: '0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c',
  qiUSDT: '0xc9e5999b8e75C3fEB117F6f73E664b9f3C8ca65C',
  qiUSDC: '0xBEb5d47A3f720Ec0a390d04b4d41ED7d9688bC7F',
  qiDAI: '0x835866d37AFB8CB8F8334dCCdaf66cf01832Ff5D',
  qiUSDTn: '0xd8fcDa6ec4Bdc547C0827B8804e89aCd817d56EF',
  qiUSDCn: '0xB715808a78F6041E46d61Cb123C9B4A27056AE9C',
};

// Trader Joe's jTokens on Avalanche
export const traderJoeTokens = {
  jAVAX: '0xC22F01ddc8010Ee05574028528614634684EC29e',
  jDAI: '0xc988c170d0E38197DC634A45bF00169C7Aa7CA19',
  jUSDT: '0x8b650e26404AC6837539ca96812f0123601E4448',
  jUSDC: '0xEd6AaF91a2B084bd594DBd1245be3691F9f637aC',
  jUSDCNative: '0x29472D511808Ce925F501D25F9Ee9efFd2328db2',
};

export const PRECISION_CONSTANT = ethers.parseEther('1');
export const WITHDRAW_FEE_PERCENT = ethers.parseEther('0.001'); // 0.1%
export const USER_DEPOSIT_LIMIT = ethers.parseEther('100000000000'); // 100 billion
export const VAULT_DEPOSIT_LIMIT = ethers.parseEther('200000000000'); // 200 billion
export const DEPOSIT_AMOUNT = ethers.parseEther('1');
export const MAX_WITHDRAW_FEE = ethers.parseEther('0.05');
export const MAX_REBALANCE_FEE = ethers.parseEther('0.2');
export const ASSET_DECIMALS = 18n;

export const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;
export const REBALANCER_ROLE = ethers.id('REBALANCER_ROLE');
export const EXECUTOR_ROLE = ethers.id('EXECUTOR_ROLE');
