// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {IProvider} from "../../contracts/interfaces/IProvider.sol";
import {MockERC20} from "../../contracts/mocks/MockERC20.sol";
import {MockProviderA, MockProviderB} from "../../contracts/mocks/MockProvider.sol";
import {IVault} from "../../contracts/interfaces/IVault.sol";
import {Vault} from "../../contracts/base/Vault.sol";
import {Rebalancer} from "../../contracts/Rebalancer.sol";
import {RebalancerWithRewards} from "../../contracts/RebalancerWithRewards.sol";
import {VaultManager} from "../../contracts/VaultManager.sol";
import {Timelock} from "../../contracts/Timelock.sol";
import {RewardsDistributor} from "../../contracts/RewardsDistributor.sol";
import {Test} from "forge-std/Test.sol";
import {StdCheats} from "forge-std/StdCheats.sol";

contract MockingUtilities is StdCheats, Test {
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public initializer = makeAddr("initializer");
    address public treasury = makeAddr("treasury");

    Rebalancer public vault;
    RebalancerWithRewards public vaultWithRewards;
    VaultManager public vaultManager;

    Timelock public timelock;
    RewardsDistributor public rewardsDistributor;

    IProvider public mockProviderA;
    IProvider public mockProviderB;

    MockERC20 public asset;

    uint8 public constant ASSET_DECIMALS = 18;

    uint256 public constant PRECISION_FACTOR = 1 ether;
    uint256 public constant MAX_WITHDRAW_FEE_PERCENT = 0.05 ether; // 5%
    uint256 public constant MAX_REBALANCE_FEE_PERCENT = 0.2 ether; // 20%

    uint256 public constant MIN_AMOUNT = 1e6;
    uint256 public constant DEPOSIT_AMOUNT = 10000 ether;
    uint256 public constant WITHDRAW_FEE_PERCENT = 0.001 ether; // 0.1%
    uint256 public constant REBALANCE_FEE_PERCENT = 0.001 ether; // 0.1%

    uint256 public constant TIMELOCK_DELAY = 30 minutes;
    uint256 public constant TIMELOCK_GRACE_PERIOD = 14 days;

    bytes32 public constant ADMIN_ROLE = 0x00;
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

    constructor() {
        asset = new MockERC20("Test USDT", "tUSDT", ASSET_DECIMALS);
        vm.label(address(asset), "tUSDT");

        mockProviderA = new MockProviderA();
        mockProviderB = new MockProviderB();

        vm.label(address(mockProviderA), "MockProviderA");
        vm.label(address(mockProviderB), "MockProviderB");

        IProvider[] memory providers = new IProvider[](2);
        providers[0] = mockProviderA;
        providers[1] = mockProviderB;

        timelock = new Timelock(address(this), TIMELOCK_DELAY);
        rewardsDistributor = new RewardsDistributor();

        vault = new Rebalancer(
            address(asset),
            "Rebalance tUSDT",
            "rtUSDT",
            providers,
            WITHDRAW_FEE_PERCENT,
            address(this), // Testing purposes
            treasury
        );

        vaultWithRewards = new RebalancerWithRewards(
            address(asset),
            "Rebalance tUSDT",
            "rtUSDT",
            providers,
            WITHDRAW_FEE_PERCENT,
            address(rewardsDistributor),
            address(this), // Testing purposes
            treasury
        );

        vaultManager = new VaultManager();

        vault.grantRole(OPERATOR_ROLE, address(this));
        vault.grantRole(OPERATOR_ROLE, address(vaultManager));

        vaultWithRewards.grantRole(OPERATOR_ROLE, address(this));
        vaultWithRewards.grantRole(OPERATOR_ROLE, address(vaultManager));

        vaultManager.grantRole(EXECUTOR_ROLE, address(this));
    }

    function initializeVault(
        IVault _vault,
        uint256 amount,
        address from
    ) internal {
        asset.mint(from, amount);

        vm.startPrank(from);
        asset.approve(address(_vault), amount);
        _vault.setupVault(amount);
        vm.stopPrank();
    }

    function executeDeposit(
        IVault _vault,
        uint256 amount,
        address from
    ) internal returns (uint256 mintedShares) {
        asset.mint(from, amount);

        uint256 previousAssetsBalance = asset.balanceOf(from);

        vm.startPrank(from);
        asset.approve(address(_vault), amount);
        mintedShares = _vault.deposit(amount, from);
        vm.stopPrank();

        assertEq(asset.balanceOf(from), previousAssetsBalance - amount);
    }

    function executeMint(
        IVault _vault,
        uint256 amount,
        address from
    ) internal returns (uint256 pulledAssets) {
        asset.mint(from, amount); /// Must mint assets amount not shares

        uint256 previousAssetsBalance = asset.balanceOf(from);

        vm.startPrank(from);
        asset.approve(address(_vault), amount);
        pulledAssets = _vault.mint(amount, from);
        vm.stopPrank();

        assertEq(asset.balanceOf(from), previousAssetsBalance - pulledAssets);
    }

    function executeWithdraw(
        IVault _vault,
        uint256 amount,
        address from
    ) internal {
        vm.prank(from);
        _vault.withdraw(amount, from, from);
    }

    function executeRedeem(
        IVault _vault,
        uint256 amount,
        address from
    ) internal {
        vm.prank(from);
        _vault.redeem(amount, from, from);
    }
}
