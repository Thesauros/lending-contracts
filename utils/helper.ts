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
