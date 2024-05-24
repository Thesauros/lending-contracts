// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title IInterestVaultV1
 *
 * @notice Defines the interface for vaults extending from IERC4626.
 */

import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {IProvider} from "./IProvider.sol";

interface IInterestVaultV1 is IERC4626 {
    /**
     * @dev Emit when the vault is initialized
     *
     * @param initializer of this vault
     *
     */
    event VaultInitialized(address initializer);

    /**
     * @dev Emit when the fees are charged
     *
     * @param treasury of this vault
     * @param assets amount to be charged
     * @param fee amount
     *
     */
    event FeesCharged(address treasury, uint256 assets, uint256 fee);

    /**
     * @dev Emit when the available providers for the vault change.
     *
     * @param newProviders the new providers available
     */
    event ProvidersChanged(IProvider[] newProviders);

    /**
     * @dev Emit when the active provider is changed.
     *
     * @param newActiveProvider the new active provider
     */
    event ActiveProviderChanged(IProvider newActiveProvider);

    /**
     * @dev Emit when the deposit limits are changed.
     *
     * @param newUserDepositLimit the new user deposit limit
     * @param newVaultDepositLimit the new vault deposit limit
     */
    event DepositLimitsChanged(
        uint256 newUserDepositLimit,
        uint256 newVaultDepositLimit
    );

    /**
     * @dev Emit when the vault is rebalanced.
     *
     * @param assetsFrom amount to be rebalanced
     * @param assetsTo amount to be rebalanced
     * @param from provider
     * @param to provider
     */
    event VaultRebalance(
        uint256 assetsFrom,
        uint256 assetsTo,
        address indexed from,
        address indexed to
    );

    /**
     * @dev Emit when the fees are changed.
     *
     * @param newWithdrawFee the new withdraw fee
     */
    event FeesChanged(uint256 newWithdrawFee);

    /**
     * @dev Emit when the treasury address is changed.
     *
     * @param newTreasury the new treasury address
     */
    event TreasuryChanged(address newTreasury);

    /**
     * @dev Emit when the minumum amount is changed.
     *
     * @param newMinAmount the new minimum amount
     */
    event MinAmountChanged(uint256 newMinAmount);

    /*///////////////////////////
    Asset management functions
  //////////////////////////*/

    /**
     * @notice Returns the amount of assets owned by `owner`.
     *
     * @param owner to check balance
     *
     * @dev This method avoids having to do external conversions from shares to
     * assets, since {IERC4626-balanceOf} returns shares.
     */
    function balanceOfAsset(
        address owner
    ) external view returns (uint256 assets);

    /*///////////////////
    General functions
  ///////////////////*/

    /**
     * @notice Returns the active provider of this vault.
     */
    function getProviders() external view returns (IProvider[] memory);

    /**
     * @notice Returns the active provider of this vault.
     */
    function activeProvider() external view returns (IProvider);

    /*/////////////////////////
     Rebalancing Function
  ////////////////////////*/

    /**
     * @notice Performs rebalancing of vault by moving funds across providers.
     *
     * @param assets amount of this vault to be rebalanced
     * @param from provider
     * @param to provider
     * @param fee expected from rebalancing operation
     * @param setToAsActiveProvider boolean
     *
     * @dev Requirements:
     * - Must check providers `from` and `to` are valid.
     * - Must be called from a {VaultManager} contract that makes all proper checks.
     * - Must revert if caller is not an approved rebalancer.
     * - Must emit the VaultRebalance event.
     * - Must check `fee` is a reasonable amount.
     */
    function rebalance(
        uint256 assets,
        IProvider from,
        IProvider to,
        uint256 fee,
        bool setToAsActiveProvider
    ) external returns (bool);

    /*/////////////////////
     Setter functions 
  ////////////////////*/

    /**
     * @notice Sets the active provider for this vault.
     *
     * @param activeProvider address
     *
     * @dev Requirements:
     * - Must be a provider previously set by `setProviders()`.
     * - Must be called from the admin.
     *
     * WARNING! Changing active provider without a `rebalance()` call
     * can result in denial of service for vault users.
     */
    function setActiveProvider(IProvider activeProvider) external;

    /**
     * @notice Sets the deposit limits for this vault.
     *
     * @param userDepositLimit_ new user deposit limit
     * @param vaultDepositLimit_ new vault deposit limit
     *
     * @dev Requirements:
     * - Must not be 0.
     * - Must be called from the admin.
     */
    function setDepositLimits(
        uint256 userDepositLimit_,
        uint256 vaultDepositLimit_
    ) external;

    /**
     * @notice Sets the treasury address for this vault.
     *
     * @param treasury address
     *
     * @dev Requirements:
     * - Must be called from admin
     */

    function setTreasury(address treasury) external;

    /**
     * @notice Sets the withdraw fee percent for this vault.
     *
     * @param withdrawFeePercent new withdraw fee percent
     *
     * @dev Requirements:
     * - Must be called from admin
     */

    function setWithdrawFee(uint256 withdrawFeePercent) external;

    /**
     * @notice Sets the minimum amount for: `deposit()`, `mint()`.
     *
     * @param amount to be as minimum.
     */
    function setMinAmount(uint256 amount) external;
}
