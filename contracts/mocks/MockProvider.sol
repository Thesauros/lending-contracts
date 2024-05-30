// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title MockProvider
 *
 * @notice Mock implementation of a lending provider.
 *
 * @dev This contract works in conjunction with
 * {MockERC20} to allow simulation and tracking of token
 * balances.
 */

import {IProvider} from "../interfaces/IProvider.sol";
import {IInterestVault} from "../interfaces/IInterestVault.sol";
import {MockERC20} from "./MockERC20.sol";

contract BaseMockProvider is IProvider {
    
    /**
     * @inheritdoc IProvider
     */
    function getProviderName()
        public
        pure
        virtual
        override
        returns (string memory)
    {
        return "Base_Provider";
    }

    /**
     * @inheritdoc IProvider
     */
    function getOperator(
        address keyAsset,
        address,
        address
    ) external pure override returns (address operator) {
        operator = keyAsset;
    }

    /**
     * @inheritdoc IProvider
     */
    function deposit(
        uint256 amount,
        IInterestVault vault
    ) external override returns (bool success) {
        MockERC20 merc20 = MockERC20(vault.asset());
        try
            merc20.makeDeposit(address(vault), amount, getProviderName())
        returns (bool result) {
            success = result;
        } catch {}
    }

    /**
     * @inheritdoc IProvider
     */
    function withdraw(
        uint256 amount,
        IInterestVault vault
    ) external override returns (bool success) {
        MockERC20 merc20 = MockERC20(vault.asset());
        try
            merc20.withdrawDeposit(address(vault), amount, getProviderName())
        returns (bool result) {
            success = result;
        } catch {}
    }

    /**
     * @inheritdoc IProvider
     */
    function getDepositRateFor(
        IInterestVault
    ) external pure override returns (uint256 rate) {
        rate = 1e27;
    }

    /**
     * @inheritdoc IProvider
     */
    function getDepositBalance(
        address user,
        IInterestVault vault
    ) external view override returns (uint256 balance) {
        balance = MockERC20(vault.asset()).balanceOfDeposit(
            user,
            getProviderName()
        );
    }
}

contract MockProviderA is BaseMockProvider {
    function getProviderName() public pure override returns (string memory) {
        return "Provider_A";
    }
}

contract MockProviderB is BaseMockProvider {
    function getProviderName() public pure override returns (string memory) {
        return "Provider_B";
    }
}
