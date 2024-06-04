// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title VaultManager
 *
 * @notice Manages the rebalancing of vaults.
 */

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IProvider} from "./interfaces/IProvider.sol";
import {IInterestVault} from "./interfaces/IInterestVault.sol";
import {ProtocolAccessControl} from "./access/ProtocolAccessControl.sol";

contract VaultManager is ProtocolAccessControl {
    using SafeERC20 for IERC20;

    /**
     * @dev Errors
     */
    error VaultManager__InvalidAssetAmount();

    constructor(address admin, address executor) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(EXECUTOR_ROLE, executor);
    }

    /**
     * @notice Performs rebalancing of the vault by moving funds across providers.
     *
     * @param vault The vault undergoing rebalancing.
     * @param assets The amount of assets to be rebalanced.
     * @param from The provider currently holding the assets.
     * @param to The provider receiving assets.
     * @param fee The fee amount charged for the rebalancing operation.
     * @param activateToProvider A flag indicating whether the receiving provider should be marked as active.
     *
     * @dev Requirements:
     * - This function must only be called by an authorized executor.
     * - The amount of 'assets' must be less than the amount managed by the 'vault'.
     */
    function rebalanceVault(
        IInterestVault vault,
        uint256 assets,
        IProvider from,
        IProvider to,
        uint256 fee,
        bool activateToProvider
    ) external onlyExecutor returns (bool success) {
        uint256 assetsAtFrom = from.getDepositBalance(address(vault), vault);

        if (assets == type(uint256).max) {
            assets = assetsAtFrom;
        }
        if (assets == 0 || assets > assetsAtFrom) {
            revert VaultManager__InvalidAssetAmount();
        }

        vault.rebalance(assets, from, to, fee, activateToProvider);

        success = true;
    }
}
