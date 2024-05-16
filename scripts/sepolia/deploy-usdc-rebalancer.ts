import { ethers, upgrades } from 'hardhat';
import {
  AaveV3Sepolia__factory,
  RebalancerManager__factory,
  InterestLocker__factory,
  InterestLocker,
} from '../../typechain-types';

const USDC = '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8'; // AaveV3 testnet USDC

const name = 'Rebalance tUSDC';
const symbol = 'rtUSDC';

let userDepositLimit = ethers.MaxUint256 - 1n;
let vaultDepositLimit = ethers.MaxUint256;

let withdrawFeePercent = ethers.parseEther('0.001'); // 0.1%

let initShares = ethers.parseUnits('1', 6);

async function deploy() {
  const [deployer] = await ethers.getSigners();

  // Deploy providers

  const aaveV3Provider = await new AaveV3Sepolia__factory(deployer).deploy();
  console.log(`AaveV3 deployed at: ${await aaveV3Provider.getAddress()}`);
  console.log('----------------------------------------------------');

  const rebalancerManager = await new RebalancerManager__factory(
    deployer
  ).deploy();

  await rebalancerManager.allowExecutor(deployer.address, true);

  console.log(
    `RebalancerManager deployed at: ${await rebalancerManager.getAddress()}`
  );
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
      await rebalancerManager.getAddress(),
      name,
      symbol,
      [await aaveV3Provider.getAddress()],
      userDepositLimit,
      vaultDepositLimit,
      withdrawFeePercent,
      deployer.address,
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
}

async function interact() {
  const [deployer] = await ethers.getSigners();
  const vaultContractFactory = await ethers.getContractFactory(
    'VaultRebalancerUpgradeable',
    deployer
  );
  await upgrades.upgradeProxy(
    '0xe97830116fD3f065696E4aDfb3a337f02AD233be',
    vaultContractFactory,
    {
      kind: 'uups',
      unsafeAllow: ['delegatecall'],
    }
  );
  console.log('Vault upgraded');
}

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
