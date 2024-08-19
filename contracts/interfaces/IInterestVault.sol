// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {IProvider} from "./IProvider.sol";

/**
 * @title IInterestVault
 *
 * @notice Defines the interface for {InterestVault}.
 */
interface IInterestVault is IERC4626 {
    /**
     * @notice Emitted when the vault is initialized.
     *
     * @param initializer The address of the initializer.
     */
    event VaultInitialized(address initializer);

    /**
     * @notice Emitted when rewards are transferred.
     *
     * @param to The address to which rewards are transferred.
     * @param amount The amount of rewards transferred.
     */
    event RewardsTransferred(address indexed to, uint256 amount);

    /**
     * @notice Emitted when fees are charged.
     *
     * @param treasury The treasury address of the vault.
     * @param assets The amount of assets charged.
     * @param fee The amount of fee charged.
     */
    event FeesCharged(address treasury, uint256 assets, uint256 fee);

    /**
     * @notice Emitted when the available providers for the vault change.
     *
     * @param newProviders The new providers available.
     */
    event ProvidersChanged(IProvider[] newProviders);

    /**
     * @notice Emitted when the active provider is changed.
     *
     * @param newActiveProvider The new active provider.
     */
    event ActiveProviderChanged(IProvider newActiveProvider);

    /**
     * @notice Emitted when the deposit limits are changed.
     *
     * @param newUserDepositLimit The new user deposit limit.
     * @param newVaultDepositLimit The new vault deposit limit.
     */
    event DepositLimitsChanged(
        uint256 newUserDepositLimit,
        uint256 newVaultDepositLimit
    );

    /**
     * @notice Emitted when the vault is rebalanced.
     *
     * @param assetsFrom The amount of assets rebalanced from.
     * @param assetsTo The amount of assets rebalanced to.
     * @param from The provider from which assets are rebalanced.
     * @param to The provider to which assets are rebalanced.
     */
    event VaultRebalance(
        uint256 assetsFrom,
        uint256 assetsTo,
        address indexed from,
        address indexed to
    );

    /**
     * @notice Emitted when the withdrawal fee is changed.
     *
     * @param newWithdrawFee The new withdrawal fee.
     */
    event WithdrawFeeChanged(uint256 newWithdrawFee);

    /**
     * @notice Emitted when the treasury address is changed.
     *
     * @param newTreasury The new treasury address.
     */
    event TreasuryChanged(address newTreasury);

    /**
     * @notice Emitted when the rewards distributor address is changed.
     *
     * @param newRewardsDistributor The new rewards distributor address.
     */
    event RewardsDistributorChanged(address newRewardsDistributor);

    /**
     * @notice Emitted when the minimum amount is changed.
     *
     * @param newMinAmount The new minimum amount.
     */
    event MinAmountChanged(uint256 newMinAmount);

    /**
     * @notice Performs rebalancing of the vault by moving funds across providers.
     *
     * @param assets The amount of assets to be rebalanced.
     * @param from The provider currently holding the assets.
     * @param to The provider receiving assets.
     * @param fee The fee amount charged for the rebalancing operation.
     * @param activateToProvider A flag indicating whether the receiving provider should be marked as active.
     *
     * @dev Requirements:
     * - Must check that providers `from` and `to` are valid.
     * - Must be called by an authorized rebalancer: {VaultManager} contract that performs all necessary checks.
     * - Must verify that the `fee` is a reasonable amount.
     * - Must emit a VaultRebalance event after successful execution.
     */
    function rebalance(
        uint256 assets,
        IProvider from,
        IProvider to,
        uint256 fee,
        bool activateToProvider
    ) external returns (bool);
}
