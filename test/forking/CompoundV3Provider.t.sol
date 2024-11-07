// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {IProvider} from "../../contracts/interfaces/IProvider.sol";
import {CompoundV3Provider} from "../../contracts/providers/CompoundV3Provider.sol";
import {ForkingUtilities} from "../utils/ForkingUtilities.sol";
import {console} from "forge-std/Test.sol";

contract CompoundV3ProviderTests is ForkingUtilities {
    CompoundV3Provider public compoundV3Provider;

    function setUp() public {
        compoundV3Provider = new CompoundV3Provider(address(providerManager));

        IProvider[] memory providers = new IProvider[](1);
        providers[0] = compoundV3Provider;

        deployVault(providers);
        initializeVault(MIN_AMOUNT, initializer);
    }

    // =========================================
    // constructor
    // =========================================

    function testConstructorRevertsIfProviderManagerIsInvalid() public {
        vm.expectRevert(
            CompoundV3Provider.CompoundV3Provider__AddressZero.selector
        );
        new CompoundV3Provider(address(0));
    }

    function testConstructor() public view {
        assertEq(
            address(compoundV3Provider.getProviderManager()),
            address(providerManager)
        );
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
        assertGe(compoundV3Provider.getDepositRate(vault), 0);
    }

    // =========================================
    // getIdentifier
    // =========================================

    function testIdentifier() public view {
        assertEq(compoundV3Provider.getIdentifier(), "Compound_V3_Provider");
    }
}
