// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {AccessManager} from "../../contracts/access/AccessManager.sol";
import {Rebalancer} from "../../contracts/Rebalancer.sol";
import {InvalidProvider} from "../../contracts/mocks/MockProvider.sol";
import {MockingUtilities} from "../utils/MockingUtilities.sol";

contract RebalancerRebalancingTests is MockingUtilities {
    InvalidProvider public invalidProvider;

    event FeeCharged(address indexed treasury, uint256 assets, uint256 fee);
    event RebalanceExecuted(
        uint256 assetsFrom,
        uint256 assetsTo,
        address indexed from,
        address indexed to
    );

    function setUp() public {
        invalidProvider = new InvalidProvider();

        initializeVault(MIN_AMOUNT, initializer);

        executeDeposit(DEPOSIT_AMOUNT, alice);
        executeDeposit(DEPOSIT_AMOUNT, bob);
    }

    // =========================================
    // rebalance
    // =========================================

    function testRebalanceRevertsIfCallerIsNotOperator() public {
        uint256 assets = 2 * DEPOSIT_AMOUNT;
        uint256 fee = (assets * REBALANCE_FEE_PERCENT) / PRECISION_FACTOR;

        vm.expectRevert(
            AccessManager.AccessManager__CallerIsNotOperator.selector
        );
        vm.prank(alice);
        vault.rebalance(assets, mockProviderA, mockProviderB, fee, true);
    }

    function testRebalanceRevertsIfProviderIsInvalid() public {
        uint256 assets = 2 * DEPOSIT_AMOUNT;
        uint256 fee = (assets * REBALANCE_FEE_PERCENT) / PRECISION_FACTOR;

        vm.expectRevert(Rebalancer.Rebalancer__InvalidProvider.selector);
        vault.rebalance(assets, invalidProvider, mockProviderB, fee, true);

        vm.expectRevert(Rebalancer.Rebalancer__InvalidProvider.selector);
        vault.rebalance(assets, mockProviderA, invalidProvider, fee, true);
    }

    function testRebalanceRevertsIfFeeIsNotReasonable() public {
        uint256 assets = 2 * DEPOSIT_AMOUNT;
        uint256 excessFee = (assets * MAX_REBALANCE_FEE_PERCENT) /
            PRECISION_FACTOR +
            1;

        vm.expectRevert(Rebalancer.Rebalancer__ExcessRebalanceFee.selector);
        vault.rebalance(assets, mockProviderA, mockProviderB, excessFee, true);
    }

    function testRebalance() public {
        uint256 assets = 2 * DEPOSIT_AMOUNT;
        uint256 fee = (assets * REBALANCE_FEE_PERCENT) / PRECISION_FACTOR;

        vault.rebalance(assets, mockProviderA, mockProviderB, fee, true);

        assertEq(
            mockProviderA.getDepositBalance(address(vault), vault),
            MIN_AMOUNT
        );
        assertEq(
            mockProviderB.getDepositBalance(address(vault), vault),
            assets - fee
        );
        assertEq(asset.balanceOf(treasury), fee);
        assertEq(address(vault.activeProvider()), address(mockProviderB));
    }

    function testRebalanceEmitsEvent() public {
        uint256 assets = 2 * DEPOSIT_AMOUNT;
        uint256 fee = (assets * REBALANCE_FEE_PERCENT) / PRECISION_FACTOR;

        vm.expectEmit();

        emit FeeCharged(treasury, assets, fee);
        emit RebalanceExecuted(
            assets,
            assets - fee,
            address(mockProviderA),
            address(mockProviderB)
        );
        vault.rebalance(assets, mockProviderA, mockProviderB, fee, true);
    }
}
