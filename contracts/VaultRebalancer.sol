// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title VaultRebalancer
 *
 * @notice Implementation vault that handles pooled single sided asset for
 * lending and strategies seeking yield.
 * User state is kept at vaults via token-shares compliant to ERC4626.
 * This vault can aggregate protocols that implement yield strategies.
 */

import {
  IERC20,
  IERC20Metadata
} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IInterestVault} from "./interfaces/IInterestVault.sol";
import {IProvider} from "./interfaces/IProvider.sol";
import {InterestVault} from "./abstracts/InterestVault.sol";

contract VaultRebalancer is InterestVault {
  using SafeERC20 for IERC20Metadata;

  /// @dev Custom Errors
  error VaultRebalancer__InvalidInput();
  error VaultRebalancer__InvalidProvider();

  /**
   * @notice Constructor of a new {VaultRebalancer}.
   *
   * @param asset_ this vault will handle as main asset
   * @param rebalanceProvider_ address of the rebalance provider
   * @param name_ string of the token-shares handled in this vault
   * @param symbol_ string of the token-shares handled in this vault
   * @param providers_ array that will initialize this vault
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
    InterestVault(asset_, rebalanceProvider_, name_, symbol_, withdrawFeePercent_, treasury_)
  {
    if(userDepositLimit_ == 0 || vaultDepositLimit_ == 0 || userDepositLimit_ >= vaultDepositLimit_){
      revert VaultRebalancer__InvalidInput();
    }

    _setProviders(providers_);
    _setActiveProvider(providers_[0]);
    _setDepositLimits(userDepositLimit_, vaultDepositLimit_);

    _pauseForceAllActions();
  }

  receive() external payable {}

  /*//////////////////////////////////////////
      Asset management: overrides IERC4626
  //////////////////////////////////////////*/

  function _computeMaxDeposit(address depositor) internal view returns(uint256 max){
    uint256 balance = convertToAssets(balanceOf(depositor));
    uint256 maxDepositor = userDepositLimit > balance ? userDepositLimit - balance : 0;

    if(maxDepositor > 0){
      max = maxDepositor > maxDepositVault() ? maxDepositVault() : maxDepositor;
    } else {
      max = 0;
    }
  }

  /// @inheritdoc InterestVault
  function maxDeposit(address owner) public view virtual override returns (uint256) {
    if (paused(VaultActions.Deposit) || maxDepositVault() == 0) {
      return 0;
    }
    return _computeMaxDeposit(owner);
  }

  /// @inheritdoc InterestVault
  function maxMint(address owner) public view virtual override returns (uint256) {
    if (paused(VaultActions.Deposit) || maxDepositVault() == 0){
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
  )
    external
    onlyRebalancer
    returns (bool)
  {
    if (!_isValidProvider(address(from)) || !_isValidProvider(address(to))) {
      revert VaultRebalancer__InvalidProvider();
    }

    // q: Why is this check here?
    // a: It's for flasher, it's not needed for rebalancer, however maybe we will use it 
    _checkRebalanceFee(fee, assets);

    _executeProviderAction(assets, "withdraw", from);
    _executeProviderAction(assets, "deposit", to);

    if (setToAsActiveProvider) {
      _setActiveProvider(to);
    }

    emit VaultRebalance(assets, address(from), address(to));
    return true;
  }

  /*/////////////////////////
      Admin set functions
  /////////////////////////*/

  /// @inheritdoc InterestVault
  function _setProviders(IProvider[] memory providers) internal override {
    uint256 len = providers.length;
    for (uint256 i = 0; i < len;) {
      if (address(providers[i]) == address(0)) {
        revert InterestVault__InvalidInput();
      }
      // q: do we need debtAsset() here? address 0 for now as it's not used
      _asset.forceApprove(
        providers[i].getOperator(asset(), asset(), address(0)), type(uint256).max
      );
      unchecked {
        ++i;
      }
    }
    _providers = providers;

    emit ProvidersChanged(providers);
  }
}
