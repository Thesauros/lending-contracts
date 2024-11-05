// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {IProvider} from "./IProvider.sol";

/**
 * @title IVault
 */
interface IVault is IERC4626 {
    /**
     * @notice Emitted when the vault setup is completed.
     *
     * @param setupAddress The address that performed the vault setup.
     */
    event SetupCompleted(address indexed setupAddress);

    /**
     * @notice Emitted when the timelock contract is changed.
     *
     * @param timelock The new timelock contract address.
     */
    event TimelockUpdated(address indexed timelock);

    /**
     * @notice Emitted when the available providers for the vault change.
     *
     * @param providers The new array of providers.
     */
    event ProvidersUpdated(IProvider[] providers);

    /**
     * @notice Emitted when the active provider is changed.
     *
     * @param activeProvider The new active provider.
     */
    event ActiveProviderUpdated(IProvider activeProvider);

    /**
     * @notice Emitted when the treasury address is changed.
     *
     * @param treasury The new treasury address.
     */
    event TreasuryUpdated(address indexed treasury);

    /**
     * @notice Emitted when the withdrawal fee is changed.
     *
     * @param withdrawFee The new withdrawal fee.
     */
    event WithdrawFeeUpdated(uint256 withdrawFee);

    /**
     * @notice Emitted when the minimum amount is changed.
     *
     * @param minAmount The new minimum amount.
     */
    event MinAmountUpdated(uint256 minAmount);

    /**
     * @notice Emitted when a fee is charged.
     *
     * @param treasury The treasury address of the vault.
     * @param assets The total amount from which the fee is charged.
     * @param fee The amount charged.
     */
    event FeeCharged(address indexed treasury, uint256 assets, uint256 fee);

    /**
     * @notice Emitted when the vault is rebalanced.
     *
     * @param assetsFrom The amount of assets rebalanced from.
     * @param assetsTo The amount of assets rebalanced to.
     * @param from The provider from which assets are rebalanced.
     * @param to The provider to which assets are rebalanced.
     */
    event RebalanceExecuted(
        uint256 assetsFrom,
        uint256 assetsTo,
        address indexed from,
        address indexed to
    );

    /**
     * @notice Emitted when rewards are transferred.
     *
     * @param to The address to which rewards are transferred.
     * @param amount The amount of rewards transferred.
     */
    event RewardsTransferred(address indexed to, uint256 amount);

    /**
     * @notice Emitted when the rewards distributor contract is changed.
     *
     * @param rewardsDistributor The new rewards distributor contract address.
     */
    event DistributorUpdated(address indexed rewardsDistributor);

    /**
     * @notice Performs rebalancing of the vault by moving funds across providers.
     * @param assets The amount of assets to be rebalanced.
     * @param from The provider currently holding the assets.
     * @param to The provider receiving the assets.
     * @param fee The fee amount charged for the rebalancing.
     * @param activateToProvider A flag indicating whether to mark the receiving provider as active.
     */
    function rebalance(
        uint256 assets,
        IProvider from,
        IProvider to,
        uint256 fee,
        bool activateToProvider
    ) external returns (bool);
}
