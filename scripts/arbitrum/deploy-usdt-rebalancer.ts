import { ethers, upgrades } from 'hardhat';
import {
  AaveV3Arbitrum__factory,
  RadiantV2Arbitrum__factory,
  ProviderManager__factory,
  DForceArbitrum__factory,
  RebalancerManager__factory,
} from '../../typechain-types';

const USDT = '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9';
const iUSDT = '0xf52f079Af080C9FB5AFCA57DDE0f8B83d49692a9'; // DForce iUSDT
const owner = '0xc8a682F0991323777253ffa5fa6F19035685E723';
const rebalanceProvider = '0x7A8355Af580347146a6C19F430fA89a97c00916f';

const name = 'Rebalance USDT';
const symbol = 'rUSDT';

let userDepositLimit = ethers.MaxUint256 - 1n;
let vaultDepositLimit = ethers.MaxUint256;

let withdrawFeePercent = ethers.parseEther('0.001'); // 0.1%

let initShares = ethers.parseUnits('1', 6);

async function deploy() {
  const [deployer] = await ethers.getSigners();

  // Deploy providers

  const providerManager = await new ProviderManager__factory(deployer).deploy();
  console.log(
    `Provider Manager deployed at: ${await providerManager.getAddress()}`
  );
  console.log('----------------------------------------------------');

  const aaveV3Provider = await new AaveV3Arbitrum__factory(deployer).deploy();
  console.log(`AaveV3 deployed at: ${await aaveV3Provider.getAddress()}`);
  console.log('----------------------------------------------------');

  const radiantV2Provider = await new RadiantV2Arbitrum__factory(
    deployer
  ).deploy();
  console.log(`RadiantV2 deployed at: ${await radiantV2Provider.getAddress()}`);
  console.log('----------------------------------------------------');

  const dforceProvider = await new DForceArbitrum__factory(deployer).deploy(
    await providerManager.getAddress()
  );
  console.log(`DForce deployed at: ${await dforceProvider.getAddress()}`);
  console.log('----------------------------------------------------');

  console.log('Setting providers...');

  // await providerManager.setProtocolToken("Compound_V3_Arbitrum", USDC, cUSDC);
  await providerManager.setProtocolToken('DForce_Arbitrum', USDT, iUSDT);

  console.log('Providers set');
  console.log('----------------------------------------------------');

  const rebalancerManager = await new RebalancerManager__factory(
    deployer
  ).deploy();

  await rebalancerManager.allowExecutor(rebalanceProvider, true);

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
      USDT,
      await rebalancerManager.getAddress(),
      name,
      symbol,
      [
        await aaveV3Provider.getAddress(),
        await radiantV2Provider.getAddress(),
        await dforceProvider.getAddress(),
      ],
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

  const assetContract = await ethers.getContractAt('IERC20', USDT);
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

  await rebalancerManager.grantRole(
    await rebalancerManager.DEFAULT_ADMIN_ROLE(),
    owner
  );
  await rebalancerManager.renounceRole(
    await rebalancerManager.DEFAULT_ADMIN_ROLE(),
    deployer.address
  );

  await providerManager.grantRole(
    await providerManager.DEFAULT_ADMIN_ROLE(),
    owner
  );
  await providerManager.renounceRole(
    await providerManager.DEFAULT_ADMIN_ROLE(),
    deployer.address
  );

  console.log('Roles set');
}

async function interact() {
  const [deployer] = await ethers.getSigners();

  const vaultImplementationFactory = await ethers.getContractFactory(
    'VaultRebalancerUpgradeable',
    deployer
  );

  const vaultImplementation = await vaultImplementationFactory.deploy();

  console.log(
    `New implementation deployed at: ${await vaultImplementation.getAddress()}`
  );
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
