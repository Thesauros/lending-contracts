// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title VaultRebalancer
 *
 * @notice Implementation vault that handles pooled single sided asset for
 * lending strategies seeking yield.
 *
 */

import {IERC20, IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IInterestVault} from "./interfaces/IInterestVault.sol";
import {IProvider} from "./interfaces/IProvider.sol";
import {InterestVaultV1} from "./abstracts/InterestVaultV1.sol";

contract VaultRebalancerV1 is InterestVaultV1 {
    using SafeERC20 for IERC20Metadata;
    using Math for uint256;

    /**
     * @dev Errors
     */
    error VaultRebalancer__InvalidProvider();
    error VaultRebalancer__ExcessRebalanceFee();

    /**
     * @notice Constructor for a new VaultRebalancer contract.
     *
     * @param rebalancer_ The address of the rebalancer.
     * @param asset_ The main asset managed by this vault.
     * @param name_ The name of the token-shares managed in this vault.
     * @param symbol_ The symbol of the token-shares managed in this vault.
     * @param providers_ An array of providers responsible for yield generation.
     * @param userDepositLimit_ The maximum amount of assets that can be deposited by a user.
     * @param vaultDepositLimit_ The maximum amount of assets that can be deposited in the vault.
     * @param withdrawFeePercent_ The percentage of fee to be charged on withdraw.
     * @param treasury_ The address of the treasury.
     *
     * @dev Requirements:
     * - Must be initialized with a set of providers.
     * - Must set the first provider in `providers_` array as `activeProvider`.
     * - Initial `minAmount` must be greater than or equal to 1e6. Refer to https://rokinot.github.io/hatsfinance.
     */
    constructor(
        address rebalancer_,
        address asset_,
        string memory name_,
        string memory symbol_,
        IProvider[] memory providers_,
        uint256 userDepositLimit_,
        uint256 vaultDepositLimit_,
        uint256 withdrawFeePercent_,
        address treasury_
    ) InterestVaultV1(rebalancer_, asset_, name_, symbol_) {
        _setProviders(providers_);
        _setActiveProvider(providers_[0]);
        _setDepositLimits(userDepositLimit_, vaultDepositLimit_);
        _setMinAmount(1e6);
        _setTreasury(treasury_);
        _setWithdrawFee(withdrawFeePercent_);
    }

    receive() external payable {}

    /**
     * @inheritdoc IInterestVault
     */
    function rebalance(
        uint256 assets,
        IProvider from,
        IProvider to,
        uint256 fee,
        bool activateToProvider
    ) external onlyRebalancer returns (bool) {
        if (
            !_validateProvider(address(from)) || !_validateProvider(address(to))
        ) {
            revert VaultRebalancer__InvalidProvider();
        }

        _checkRebalanceFee(fee, assets);

        _delegateActionToProvider(assets, "withdraw", from);
        _delegateActionToProvider(assets - fee, "deposit", to);

        if (fee > 0) {
            _asset.safeTransfer(treasury, fee);
            emit FeesCharged(treasury, assets, fee);
        }

        if (activateToProvider) {
            _setActiveProvider(to);
        }

        emit VaultRebalance(assets, assets - fee, address(from), address(to));
        return true;
    }

    /**
     * @dev Ensures the rebalance fee is within a reasonable limit.
     *
     * Requirements:
     * - The fee must be less than or equal to the maximum allowable rebalance fee
     *
     * @param fee The fee amount to check.
     * @param amount The amount used to calculate the allowable fee.
     */
    function _checkRebalanceFee(uint256 fee, uint256 amount) internal pure {
        uint256 reasonableFee = amount.mulDiv(MAX_REBALANCE_FEE, FEE_PRECISION);
        if (fee > reasonableFee) {
            revert VaultRebalancer__ExcessRebalanceFee();
        }
    }
}
