// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title RebalancerManager
 *
 * @notice Contract that faciliates rebalancing of the vaults.
 */

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IProvider} from "./interfaces/IProvider.sol";
import {IInterestVault} from "./interfaces/IInterestVault.sol";
import {IRebalancerManager} from "./interfaces/IRebalancerManager.sol";
import {ProtocolAccessControl} from "./access/ProtocolAccessControl.sol";

contract RebalancerManager is IRebalancerManager, ProtocolAccessControl {
    using SafeERC20 for IERC20;

    /// @dev Custom errors
    error RebalancerManager__InvalidExecutor();
    error RebalancerManager__ExecutorAlreadyAllowed();
    error RebalancerManager__InvalidRebalanceAmount();
    error RebalancerManager__InvalidAssetAmount();
    error RebalancerManager__AddressZero();

    mapping(address => bool) public allowedExecutor;

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /// @inheritdoc IRebalancerManager
    function rebalanceVault(
        IInterestVault vault,
        uint256 assets,
        IProvider from,
        IProvider to,
        uint256 fee,
        bool setToAsActiveProvider
    ) external override returns (bool success) {
        if (!allowedExecutor[msg.sender]) {
            revert RebalancerManager__InvalidExecutor();
        }

        if (assets == type(uint256).max) {
            assets = from.getDepositBalance(address(vault), vault);
        }

        _checkAssetsAmount(vault, assets, from);

        if (assets == 0) {
            // Should at least move some assets across providers.
            revert RebalancerManager__InvalidRebalanceAmount();
        }

        vault.rebalance(assets, from, to, fee, setToAsActiveProvider);

        success = true;
    }

    /// @inheritdoc IRebalancerManager
    function allowExecutor(
        address executor,
        bool allowed
    ) external override onlyAdmin {
        if (executor == address(0)) {
            revert RebalancerManager__AddressZero();
        }
        if (allowedExecutor[executor] == allowed) {
            revert RebalancerManager__ExecutorAlreadyAllowed();
        }
        allowedExecutor[executor] = allowed;
        emit AllowExecutor(executor, allowed);
    }

    /**
     * @dev Checks `amount` is < than current asset balance of `vault` at provider `from`.
     *
     * @param vault address
     * @param amount to be rebalanced to check against
     * @param from provider address
     */
    function _checkAssetsAmount(
        IInterestVault vault,
        uint256 amount,
        IProvider from
    ) internal view {
        uint256 assetsAtProvider = from.getDepositBalance(
            address(vault),
            vault
        );
        if (amount > assetsAtProvider) {
            revert RebalancerManager__InvalidAssetAmount();
        }
    }
}
