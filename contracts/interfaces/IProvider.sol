// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {IInterestVault} from "./IInterestVault.sol";

/**
 * @title IProvider
 *
 * @notice Defines the interface for core engine to perform operations at lending providers.
 *
 * @dev Functions are intended to be called in the context of a Vault via delegateCall,
 * except indicated.
 */
interface IProvider {
    /**
     * @notice Returns the name of the provider.
     */
    function getProviderName() external view returns (string memory);

    /**
     * @notice Returns the operator address that requires ERC20 approval for vault operations.
     *
     * @param key The address to inquire about the operator.
     * @param asset The address of the asset.
     * @param debtAsset The address of the debt asset.
     *
     * @dev Provider implementations may or may not require all inputs.
     */
    function getOperator(
        address key,
        address asset,
        address debtAsset
    ) external view returns (address operator);

    /**
     * @notice Performs a deposit operation at the lending provider on behalf of a vault.
     *
     * @param amount The amount to deposit.
     * @param vault The `IInterestVault` calling this function.
     *
     * @dev Requirements:
     * - This function should be delegate called in the context of a `vault`.
     */
    function deposit(
        uint256 amount,
        IInterestVault vault
    ) external returns (bool success);

    /**
     * @notice Performs a withdraw operation at the lending provider on behalf of a vault.
     *
     * @param amount The amount to withdraw.
     * @param vault The `IInterestVault` calling this function.
     *
     * @dev Requirements:
     * - This function should be delegate called in the context of a `vault`.
     */
    function withdraw(
        uint256 amount,
        IInterestVault vault
    ) external returns (bool success);

    /**
     * @notice Returns the deposit balance of a user at the lending provider.
     *
     * @param user The address of the user whose balance is needed.
     * @param vault The `IInterestVault` required by some specific providers with multi-markets, otherwise pass address(0).
     *
     * @dev Requirements:
     * - Must not require a Vault context.
     */
    function getDepositBalance(
        address user,
        IInterestVault vault
    ) external view returns (uint256 balance);

    /**
     * @notice Returns the latest supply annual percentage rate (APR) at the lending provider.
     *
     * @param vault The `IInterestVault` required by some specific providers with multi-markets, otherwise pass address(0).
     *
     * @dev Requirements:
     * - Must not require a Vault context.
     * - Must return the rate in ray units (1e27).
     *   Example: 8.5% APR = 0.085 * 1e27 = 85000000000000000000000000.
     */
    function getDepositRateFor(
        IInterestVault vault
    ) external view returns (uint256 rate);
}
