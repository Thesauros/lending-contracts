// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {IProvider} from "../../contracts/interfaces/IProvider.sol";
import {AaveV3Provider} from "../../contracts/providers/AaveV3Provider.sol";
import {ForkingUtilities} from "../utils/ForkingUtilities.sol";

contract AaveV3ProviderTests is ForkingUtilities {
    AaveV3Provider public aaveV3Provider;

    function setUp() public {
        aaveV3Provider = new AaveV3Provider();

        IProvider[] memory providers = new IProvider[](1);
        providers[0] = aaveV3Provider;

        deployVault(providers);
        initializeVault(MIN_AMOUNT, initializer);
    }

    // =========================================
    // deposit
    // =========================================

    function testDeposit() public {
        uint256 mintedSharesBefore = vault.balanceOf(alice);
        uint256 assetBalanceBefore = vault.convertToAssets(mintedSharesBefore);

        executeDeposit(DEPOSIT_AMOUNT, alice);

        vm.warp(block.timestamp + 10 seconds);
        vm.roll(block.number + 1);

        uint256 mintedShares = vault.balanceOf(alice);
        uint256 assetBalance = vault.convertToAssets(mintedShares);

        assertApproxEqAbs(
            assetBalance - assetBalanceBefore,
            DEPOSIT_AMOUNT,
            100
        );
    }

    // =========================================
    // withdraw
    // =========================================

    function testWithdraw() public {
        executeDeposit(DEPOSIT_AMOUNT, alice);

        vm.warp(block.timestamp + 10 seconds);
        vm.roll(block.number + 1);

        uint256 balanceBefore = asset.balanceOf(alice);
        uint256 maxWithdrawable = vault.maxWithdraw(alice);
        uint256 fee = (maxWithdrawable * WITHDRAW_FEE_PERCENT) /
            PRECISION_FACTOR;

        executeWithdraw(maxWithdrawable, alice);

        uint256 balanceAfter = balanceBefore + maxWithdrawable - fee;

        assertEq(asset.balanceOf(alice), balanceAfter);
    }

    // =========================================
    // getDepositBalance
    // =========================================

    function testDepositBalance() public {
        executeDeposit(DEPOSIT_AMOUNT, alice);

        vm.warp(block.timestamp + 10 seconds);
        vm.roll(block.number + 1);

        assertApproxEqAbs(
            vault.totalAssets(),
            DEPOSIT_AMOUNT + MIN_AMOUNT,
            100
        );
    }

    // =========================================
    // getDepositRate
    // =========================================

    function testDepositRate() public view {
        assertGe(aaveV3Provider.getDepositRate(vault), 0);
    }

    // =========================================
    // getIdentifier
    // =========================================

    function testIdentifier() public view {
        assertEq(aaveV3Provider.getIdentifier(), "Aave_V3_Provider");
    }
}
