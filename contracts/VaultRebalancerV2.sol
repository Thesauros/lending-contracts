// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title VaultRebalancerV2
 *
 * @notice Implementation vault that handles pooled single sided asset for
 * lending and strategies seeking yield.
 * User state is kept at vaults via token-shares compliant to ERC4626.
 * This vault can aggregate protocols that implement yield strategies.
 */

import {IERC20, IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IInterestVault} from "./interfaces/IInterestVaultV2.sol";
import {IProvider} from "./interfaces/IProvider.sol";
import {InterestVaultV2} from "./abstracts/InterestVaultV2.sol";

contract VaultRebalancerV2 is InterestVaultV2 {
    using SafeERC20 for IERC20Metadata;

    /// @dev Custom Errors
    error VaultRebalancer__InvalidProvider();

    /**
     * @notice Constructor of a new {VaultRebalancer}.
     *
     * @param asset_ this vault will handle as main asset
     * @param rebalanceProvider_ address of the rebalance provider
     * @param name_ string of the token-shares handled in this vault
     * @param symbol_ string of the token-shares handled in this vault
     * @param providers_ array that will initialize this vault
     * @param userDepositLimit_ max amount of assets that can be deposited by a user
     * @param vaultDepositLimit_ max amount of assets that can be deposited in the vault
     * @param withdrawFeePercent_ percentage of fee to be charged on withdraw
     * @param treasury_ address of the treasury
     *
     * @dev Requirements:
     * - Must be initialized with a set of providers.
     * - Must set first provider in `providers_` array as `activeProvider`.
     *
     */
    constructor(
        address asset_,
        address rebalanceProvider_,
        string memory name_,
        string memory symbol_,
        IProvider[] memory providers_,
        uint256 userDepositLimit_,
        uint256 vaultDepositLimit_,
        uint256 withdrawFeePercent_,
        address treasury_
    )
        InterestVault(
            asset_,
            rebalanceProvider_,
            name_,
            symbol_,
            withdrawFeePercent_,
            treasury_
        )
    {
        _setProviders(providers_);
        _setActiveProvider(providers_[0]);
        _setDepositLimits(userDepositLimit_, vaultDepositLimit_);
    }

    receive() external payable {}

    /*//////////////////////////////////////////
      Asset management: overrides IERC4626
  //////////////////////////////////////////*/

    function _computeMaxDeposit(
        address depositor
    ) internal view returns (uint256 max) {
        uint256 balance = convertToAssets(balanceOf(depositor));
        uint256 maxDepositor = userDepositLimit > balance
            ? userDepositLimit - balance
            : 0;

        max = maxDepositor > getVaultCapacity()
            ? getVaultCapacity()
            : maxDepositor;
    }

    /// @inheritdoc InterestVault
    function maxDeposit(
        address owner
    ) public view virtual override returns (uint256) {
        if (paused(VaultActions.Deposit) || getVaultCapacity() == 0) {
            return 0;
        }
        return _computeMaxDeposit(owner);
    }

    /// @inheritdoc InterestVault
    function maxMint(
        address owner
    ) public view virtual override returns (uint256) {
        if (paused(VaultActions.Deposit) || getVaultCapacity() == 0) {
            return 0;
        }
        return convertToShares(_computeMaxDeposit(owner));
    }

    /// @inheritdoc InterestVault
    function maxWithdraw(address owner) public view override returns (uint256) {
        if (paused(VaultActions.Withdraw)) {
            return 0;
        }
        return convertToAssets(balanceOf(owner));
    }

    /// @inheritdoc InterestVault
    function maxRedeem(address owner) public view override returns (uint256) {
        if (paused(VaultActions.Withdraw)) {
            return 0;
        }
        return balanceOf(owner);
    }

    /*/////////////////
      Rebalancing
  /////////////////*/

    /// @inheritdoc IInterestVault
    function rebalance(
        uint256 assets,
        IProvider from,
        IProvider to,
        uint256 fee,
        bool setToAsActiveProvider
    ) external onlyRebalancer returns (bool) {
        if (
            !_isValidProvider(address(from)) || !_isValidProvider(address(to))
        ) {
            revert VaultRebalancer__InvalidProvider();
        }

        _checkRebalanceFee(fee, assets);

        _executeProviderAction(assets, "withdraw", from);
        _executeProviderAction(assets - fee, "deposit", to);

        if (fee > 0) {
            _asset.safeTransfer(treasury, fee);
        }

        if (setToAsActiveProvider) {
            _setActiveProvider(to);
        }

        emit VaultRebalance(assets, assets - fee, address(from), address(to));
        return true;
    }

    /*/////////////////////////
      Admin set functions
  /////////////////////////*/

    /// @inheritdoc InterestVault
    function _setProviders(IProvider[] memory providers) internal override {
        uint256 len = providers.length;
        for (uint256 i = 0; i < len; ) {
            if (address(providers[i]) == address(0)) {
                revert InterestVault__InvalidInput();
            }

            _asset.forceApprove(
                providers[i].getOperator(asset(), asset(), address(0)),
                type(uint256).max
            );
            unchecked {
                ++i;
            }
        }
        _providers = providers;

        emit ProvidersChanged(providers);
    }
}
