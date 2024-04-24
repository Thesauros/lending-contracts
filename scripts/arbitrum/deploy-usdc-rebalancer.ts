import { ethers, upgrades, network } from 'hardhat';
import { CompoundV3Arbitrum__factory } from '../../typechain-types';

const USDC = '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8'; // USDC.e
const iUSDC = '0x8dc3312c68125a94916d62B97bb5D925f84d4aE0'; // DForce iUSDC
const owner = '0x714E9446DDAc1B7051291B7E3E1730746128A9aF';
const rebalancerManagerAddress = '0x7912C6906649D582dD8928fC121D35f4b3B9fEF2'; // RebalancerManager

const providerManagerAddress = '0x0cBa04A01b6e20467739cDF2B3379d759DcB6ae1';
const aaveProviderAddress = '0x4cF0ff2A67a850DC212e3f3E07794765AB7c46E3';
const radiantV2ProviderAddress = '0x081962727bf54013F99e166D0096fd535aCFc854';
const dforceProviderAddress = '0x2c17806FF8bE2f9507AA75E3857eB49E8185ca70';

const name = 'Rebalance USDC.e';
const symbol = 'rUSDC.e';

let userDepositLimit = ethers.MaxUint256 - 1n;
let vaultDepositLimit = ethers.MaxUint256;

let withdrawFeePercent = ethers.parseEther('0.001'); // 0.1%

let initShares = ethers.parseUnits('1', 6);

async function deploy() {
  const [deployer] = await ethers.getSigners();

  // Deploy providers

  console.log('Setting providers...');

  let providerManager = await ethers.getContractAt(
    'ProviderManager',
    providerManagerAddress
  );

  await providerManager.setProtocolToken('DForce_Arbitrum', USDC, iUSDC);

  console.log('Providers set');
  console.log('----------------------------------------------------');

  // Deploy Rebalancer
  const vaultContractFactory = await ethers.getContractFactory(
    'VaultRebalancerUpgradeable',
    deployer
  );

  const vaultProxyInstance = await upgrades.deployProxy(
    vaultContractFactory,
    [
      USDC,
      rebalancerManagerAddress,
      name,
      symbol,
      [aaveProviderAddress, radiantV2ProviderAddress, dforceProviderAddress],
      userDepositLimit,
      vaultDepositLimit,
      withdrawFeePercent,
      owner,
    ],
    {
      kind: 'uups',
      unsafeAllow: ['delegatecall'],
      initializer:
        'initialize(address, address, string memory, string memory, address[] memory, uint256, uint256, uint256, address)',
    }
  );

  console.log(
    `VaultRebalancer deployed at: ${await vaultProxyInstance.getAddress()}`
  );
  console.log('----------------------------------------------------');
  console.log('Initializing the vault...');

  const vaultRebalancer = await ethers.getContractAt(
    'VaultRebalancerUpgradeable',
    await vaultProxyInstance.getAddress()
  );

  const assetContract = await ethers.getContractAt('IERC20', USDC);

  await assetContract.approve(await vaultRebalancer.getAddress(), initShares);

  await vaultRebalancer.initializeVaultShares(initShares);

  console.log('----------------------------------------------------');
  console.log('Vault initialized');

  console.log('----------------------------------------------------');
  console.log('Setting roles...');

  await vaultRebalancer.grantRole(
    await vaultRebalancer.DEFAULT_ADMIN_ROLE(),
    owner
  );
  await vaultRebalancer.renounceRole(
    await vaultRebalancer.DEFAULT_ADMIN_ROLE(),
    deployer.address
  );

  console.log('Roles set');
}

async function interact() {}

async function main() {
  // await deploy();
  await interact();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
