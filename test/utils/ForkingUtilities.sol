// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IProvider} from "../../contracts/interfaces/IProvider.sol";
import {Vault} from "../../contracts/base/Vault.sol";
import {Rebalancer} from "../../contracts/Rebalancer.sol";
import {Timelock} from "../../contracts/Timelock.sol";
import {VaultManager} from "../../contracts/VaultManager.sol";
import {ProviderManager} from "../../contracts/providers/ProviderManager.sol";
import {CompoundV3Provider} from "../../contracts/providers/CompoundV3Provider.sol";
import {AaveV3Provider} from "../../contracts/providers/AaveV3Provider.sol";
import {Test} from "forge-std/Test.sol";
import {StdCheats} from "forge-std/StdCheats.sol";

contract ForkingUtilities is StdCheats, Test {
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public initializer = makeAddr("initializer");
    address public treasury = makeAddr("treasury");

    Rebalancer public vault;
    Timelock public timelock;

    ProviderManager public providerManager;

    IERC20 public asset;

    address public constant USDT_ADDRESS =
        0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9;
    address public constant COMET_USDT_ADDRESS =
        0xd98Be00b5D27fc98112BdE293e487f8D4cA57d07;

    uint256 public constant PRECISION_FACTOR = 1e18;
    uint256 public constant WITHDRAW_FEE_PERCENT = 0.001 ether; // 0.1%

    uint256 public constant MIN_AMOUNT = 1e6;
    uint256 public constant DEPOSIT_AMOUNT = 1000e6;
    uint256 public constant TIMELOCK_DELAY = 30 minutes;

    constructor() {
        string memory ARBITRUM_RPC_URL = vm.envString("ARBITRUM_RPC_URL");
        vm.createSelectFork(ARBITRUM_RPC_URL, 233407190);

        asset = IERC20(USDT_ADDRESS);
        vm.label(address(asset), "USDT");

        providerManager = new ProviderManager();
        providerManager.setYieldToken(
            "Compound_V3_Provider",
            USDT_ADDRESS,
            COMET_USDT_ADDRESS
        );

        timelock = new Timelock(address(this), TIMELOCK_DELAY);
    }

    function deployVault(IProvider[] memory providers) internal {
        vault = new Rebalancer(
            address(asset),
            "Rebalance USDT",
            "rUSDT",
            providers,
            WITHDRAW_FEE_PERCENT,
            address(timelock),
            treasury
        );
    }

    function initializeVault(uint256 amount, address from) internal {
        deal(address(asset), from, amount);

        vm.startPrank(from);
        asset.approve(address(vault), amount);
        vault.setupVault(amount);
        vm.stopPrank();
    }

    function executeDeposit(uint256 amount, address from) internal {
        deal(address(asset), from, amount);

        vm.startPrank(from);
        asset.approve(address(vault), amount);
        vault.deposit(amount, from);
        vm.stopPrank();
    }

    function executeWithdraw(uint256 amount, address from) internal {
        vm.prank(from);
        vault.withdraw(amount, from, from);
    }

    function executeRedeem(uint256 amount, address from) internal {
        vm.prank(from);
        vault.redeem(amount, from, from);
    }
}
