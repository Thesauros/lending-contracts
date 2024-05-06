// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title InterestVaultUpgradeable
 *
 * @notice Abstract contract that defines the basic common functions and interface
 * for all vault types. User state is kept in vaults via tokenized shares compliant to ERC4626.
 * The `_providers` of this vault are the liquidity source for yielding operations.
 * Setter functions are controlled by admin, and roles defined in {ProtocolAccessControl}.
 * Pausability in core functions is implemented for emergency cases.
 * Allowance and approvals for value extracting operations is possible via
 * signed messages defined in {VaultPermit}.
 */

import {ERC20Upgradeable, IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {IERC20MetadataUpgradeable as IERC20Metadata} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {MathUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import {AddressUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import {IERC4626Upgradeable} from "@openzeppelin/contracts-upgradeable/interfaces/IERC4626Upgradeable.sol";
import {IInterestVaultUpgradeable} from "../interfaces/IInterestVaultUpgradeable.sol";
import {IProvider} from "../interfaces/IProvider.sol";
import {ProtocolAccessControlUpgradeable} from "./ProtocolAccessControlUpgradeable.sol";
import {VaultPermitUpgradeable} from "./VaultPermitUpgradeable.sol";
import {VaultPausable} from "../abstracts/VaultPausable.sol";

abstract contract InterestVaultUpgradeable is
    ERC20Upgradeable,
    ProtocolAccessControlUpgradeable,
    VaultPausable,
    VaultPermitUpgradeable,
    UUPSUpgradeable,
    IInterestVaultUpgradeable
{
    using MathUpgradeable for uint256;
    using AddressUpgradeable for address;
    using SafeERC20Upgradeable for IERC20Metadata;

    /// @dev Custom Errors
    error InterestVault__InvalidInput();
    error InterestVault__VaultAlreadyInitialized();
    error InterestVault__UseIncreaseWithdrawAllowance();
    error InterestVault__UseDecreaseWithdrawAllowance();
    error InterestVault__AmountLessThanMin();
    error InterestVault__DepositMoreThanMax();
    error InterestVault__ExcessRebalanceFee();

    string public constant VERSION = string("1");

    bool public initialized;

    IERC20Metadata internal _asset;

    uint8 private _decimals;

    IProvider[] internal _providers;
    IProvider public activeProvider;

    uint256 public minAmount;

    uint256 private constant FEE_PRECISION = 1e18;
    uint256 private constant MAX_WITHDRAW_FEE = 0.05 * 1e18; // 5%
    uint256 private constant MAX_REBALANCE_FEE = 0.2 * 1e18; // 20%

    uint256 public vaultDepositLimit;
    uint256 public userDepositLimit;

    uint256 public withdrawFeePercent;

    address public treasury;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize a a new {InterestVaultUpgradeable}.
     *
     * @param asset_ this vault will handle as main asset
     * @param rebalanceProvider_ address of the rebalance provider
     * @param name_ of the token-shares handled in this vault
     * @param symbol_ of the token-shares handled in this vault
     * @param treasury_ address of the treasury
     * @dev Requirements:
     * - Must be called by children contract initialize function
     */
    function __InterestVault_init(
        address asset_,
        address rebalanceProvider_,
        string memory name_,
        string memory symbol_,
        uint256 withdrawFeePercent_,
        address treasury_
    ) internal onlyInitializing {
        __ERC20_init(name_, symbol_);
        __VaultPermit_init(name_, VERSION);

        if (asset_ == address(0) || rebalanceProvider_ == address(0)) {
            revert InterestVault__InvalidInput();
        }
        if (withdrawFeePercent_ > MAX_WITHDRAW_FEE) {
            revert InterestVault__InvalidInput();
        }

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REBALANCER_ROLE, rebalanceProvider_);

        _asset = IERC20Metadata(asset_);
        _decimals = IERC20Metadata(asset_).decimals();
        minAmount = 1e6;

        withdrawFeePercent = withdrawFeePercent_;
        treasury = treasury_;

        // @dev pause all actions that will be unpaused when initializing the vault
        _pauseForceAllActions();
    }

    /**
     * @notice Implement at children contract.
     *
     * @param assets amount to initialize asset shares
     *
     * Requirements:
     * - Must create shares and balance to avoid inflation attack.
     * - Must have `assets` be > `minAmount`.
     * - Must account any created shares to the address(this) and permanently lock them.
     * - Must pull assets from msg.sender
     * - Must unpause all actions at the end.
     * - Must emit a VaultInitialized event.
     */

    function initializeVaultShares(uint256 assets) public {
        if (initialized) {
            revert InterestVault__VaultAlreadyInitialized();
        }
        if (assets < minAmount) {
            revert InterestVault__AmountLessThanMin();
        }
        _unpauseForceAllActions();

        _deposit(msg.sender, address(this), assets, assets);
        initialized = true;
        emit VaultInitialized(msg.sender);
    }

    /*////////////////////////////////////////////////////
      Asset management: allowance {IERC20} overrides 
      Overrides to handle as `withdrawAllowance`
  ///////////////////////////////////////////////////*/

    /**
     * @notice Returns the shares amount allowed to transfer from
     *  `owner` to `receiver`.
     *
     * @param owner of the shares
     * @param receiver that can receive the shares
     *
     * @dev Requirements:
     * - Must be overriden to call {VaultPermit-withdrawAllowance}.
     */
    function allowance(
        address owner,
        address receiver
    )
        public
        view
        override(ERC20Upgradeable, IERC20Upgradeable)
        returns (uint256)
    {
        /// @dev operator = receiver
        return convertToShares(withdrawAllowance(owner, receiver, receiver));
    }

    /**
     * @notice Approve allowance of `shares` to `receiver`.
     *
     * @param receiver to whom share allowance is being set
     * @param shares amount of allowance
     *
     * @dev Recommend to use increase/decrease WithdrawAllowance methods.
     * - Must be overriden to call {VaultPermit-_setWithdrawAllowance}.
     * - Must convert `shares` into `assets` amount before calling internal functions.
     */
    function approve(
        address receiver,
        uint256 shares
    ) public override(ERC20Upgradeable, IERC20Upgradeable) returns (bool) {
        /// @dev operator = receiver and owner = msg.sender
        _setWithdrawAllowance(
            msg.sender,
            receiver,
            receiver,
            convertToAssets(shares)
        );
        emit Approval(msg.sender, receiver, shares);
        return true;
    }

    /**
     * @notice This method in OZ erc20-implementation has been disabled in favor of
     * {VaultPermissions-increaseWithdrawAllowance()}.
     */
    function increaseAllowance(
        address,
        uint256
    ) public pure override returns (bool) {
        revert InterestVault__UseIncreaseWithdrawAllowance();
    }

    /**
     * @notice This method in OZ erc20-implementation has been disabled in favor of
     * {VaultPermissions-decreaseWithdrawAllowance()}.
     */
    function decreaseAllowance(
        address,
        uint256
    ) public pure override returns (bool) {
        revert InterestVault__UseDecreaseWithdrawAllowance();
    }

    /**
     * @dev Called during {ERC20-transferFrom} to decrease allowance.
     * Requirements:
     * - Must be overriden to call {VaultPermit-_spendWithdrawAllowance}.
     * - Must convert `shares` to `assets` before calling internal functions.
     * - Must assume msg.sender as the operator.
     *
     * @param owner of `shares`
     * @param spender to whom `shares` will be spent
     * @param shares amount to spend
     */
    function _spendAllowance(
        address owner,
        address spender,
        uint256 shares
    ) internal override {
        _spendWithdrawAllowance(
            owner,
            msg.sender,
            spender,
            convertToAssets(shares)
        );
    }

    /*//////////////////////////////////////////
      Asset management: overrides IERC4626Upgradeable
  //////////////////////////////////////////*/

    /**
     * @notice Returns the number of decimals used to get number representation.
     */
    function decimals()
        public
        view
        virtual
        override(ERC20Upgradeable, IERC20Metadata)
        returns (uint8)
    {
        return _decimals;
    }

    /// @inheritdoc IERC4626Upgradeable
    function asset() public view virtual override returns (address) {
        return address(_asset);
    }

    /// @inheritdoc IInterestVaultUpgradeable
    function balanceOfAsset(
        address owner
    ) external view virtual override returns (uint256 assets) {
        return convertToAssets(balanceOf(owner));
    }

    /// @inheritdoc IERC4626Upgradeable
    function totalAssets()
        public
        view
        virtual
        override
        returns (uint256 assets)
    {
        return _checkProvidersBalance("getDepositBalance");
    }

    /// @inheritdoc IERC4626Upgradeable
    function convertToShares(
        uint256 assets
    ) public view virtual override returns (uint256 shares) {
        return _convertToShares(assets, MathUpgradeable.Rounding.Down);
    }

    /// @inheritdoc IERC4626Upgradeable
    function convertToAssets(
        uint256 shares
    ) public view virtual override returns (uint256 assets) {
        return _convertToAssets(shares, MathUpgradeable.Rounding.Down);
    }

    /// @inheritdoc IERC4626Upgradeable
    function maxDeposit(
        address owner
    ) public view virtual override returns (uint256);

    /// @inheritdoc IERC4626Upgradeable
    function maxMint(
        address owner
    ) public view virtual override returns (uint256);

    /// @inheritdoc IERC4626Upgradeable
    function maxWithdraw(
        address owner
    ) public view virtual override returns (uint256);

    /// @inheritdoc IERC4626Upgradeable
    function maxRedeem(
        address owner
    ) public view virtual override returns (uint256);

    /// @inheritdoc IERC4626Upgradeable
    function previewDeposit(
        uint256 assets
    ) public view virtual override returns (uint256) {
        return _convertToShares(assets, MathUpgradeable.Rounding.Down);
    }

    /// @inheritdoc IERC4626Upgradeable
    function previewMint(
        uint256 shares
    ) public view virtual override returns (uint256) {
        return _convertToAssets(shares, MathUpgradeable.Rounding.Up);
    }

    /// @inheritdoc IERC4626Upgradeable
    function previewWithdraw(
        uint256 assets
    ) public view virtual override returns (uint256) {
        return _convertToShares(assets, MathUpgradeable.Rounding.Up);
    }

    /// @inheritdoc IERC4626Upgradeable
    function previewRedeem(
        uint256 shares
    ) public view virtual override returns (uint256) {
        return _convertToAssets(shares, MathUpgradeable.Rounding.Down);
    }

    /// @inheritdoc IERC4626Upgradeable
    function deposit(
        uint256 assets,
        address receiver
    ) public virtual override returns (uint256) {
        uint256 shares = previewDeposit(assets);

        _depositChecks(receiver, assets, shares);
        _deposit(msg.sender, receiver, assets, shares);

        return shares;
    }

    /// @inheritdoc IERC4626Upgradeable
    function mint(
        uint256 shares,
        address receiver
    ) public virtual override returns (uint256) {
        uint256 assets = previewMint(shares);

        _depositChecks(receiver, assets, shares);
        _deposit(msg.sender, receiver, assets, shares);

        return assets;
    }

    /// @inheritdoc IERC4626Upgradeable
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public override returns (uint256) {
        uint256 shares = previewWithdraw(assets);
        (, shares) = _withdrawInternal(
            assets,
            shares,
            msg.sender,
            receiver,
            owner
        );
        return shares;
    }

    /// @inheritdoc IERC4626Upgradeable
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) public override returns (uint256) {
        uint256 assets = previewRedeem(shares);
        (assets, ) = _withdrawInternal(
            assets,
            shares,
            msg.sender,
            receiver,
            owner
        );
        return assets;
    }

    /**
     * @dev Conversion function from `assets` to shares equivalent with support for rounding direction.
     * Requirements:
     * - Must return `assets` if `assets` or `totalSupply()` == 0.
     * - Must revert if `totalAssets()` is not > 0.
     *   (Corresponds to a case where you divide by zero.)
     *
     * @param assets amount to convert to shares
     * @param rounding direction of division remainder
     */
    function _convertToShares(
        uint256 assets,
        MathUpgradeable.Rounding rounding
    ) internal view virtual returns (uint256 shares) {
        uint256 supply = totalSupply();
        return
            (assets == 0 || supply == 0)
                ? assets
                : assets.mulDiv(supply, totalAssets(), rounding);
    }

    /**
     * @dev Conversion function from `shares` to asset type with support for rounding direction.
     * Requirements:
     * - Must return `shares` if `totalSupply()` == 0.
     *
     * @param shares amount to convert to assets
     * @param rounding direction of division remainder
     */
    function _convertToAssets(
        uint256 shares,
        MathUpgradeable.Rounding rounding
    ) internal view virtual returns (uint256 assets) {
        uint256 supply = totalSupply();
        return
            (supply == 0)
                ? shares
                : shares.mulDiv(totalAssets(), supply, rounding);
    }

    /**
     * @dev Perform `_deposit()` at provider {IERC4626-deposit}.
     * Requirements:
     * - Must call `activeProvider` in `_executeProviderAction()`.
     * - Must emit a Deposit event.
     *
     * @param caller or {msg.sender}
     * @param receiver to whom `assets` are credited by `shares` amount
     * @param assets amount transferred during this deposit
     * @param shares amount credited to `receiver` during this deposit
     */
    function _deposit(
        address caller,
        address receiver,
        uint256 assets,
        uint256 shares
    ) internal whenNotPaused(VaultActions.Deposit) {
        _asset.safeTransferFrom(caller, address(this), assets);
        _executeProviderAction(assets, "deposit", activeProvider);
        _mint(receiver, shares);

        emit Deposit(caller, receiver, assets, shares);
    }

    /**
     * @dev Runs common checks for all "deposit" or "mint" actions in this vault.
     * Requirements:
     * - Must revert for all conditions not passed.
     *
     * @param receiver of the deposit
     * @param assets being deposited
     * @param shares being minted for `receiver`
     */
    function _depositChecks(
        address receiver,
        uint256 assets,
        uint256 shares
    ) private view {
        if (receiver == address(0) || assets == 0 || shares == 0) {
            revert InterestVault__InvalidInput();
        }
        if (assets > maxDeposit(receiver) || shares > maxMint(receiver)) {
            revert InterestVault__DepositMoreThanMax();
        }
        if (assets < minAmount) {
            revert InterestVault__AmountLessThanMin();
        }
    }

    /**
     * @dev Function to handle common flow for `withdraw(...)` and `redeem(...)`
     * It returns the updated `assets_` and `shares_` values if applicable.
     *
     * @param assets amount transferred during this withraw
     * @param shares amount burned to `owner` during this withdraw
     * @param caller or {msg.sender}
     * @param receiver to whom `assets` amount will be transferred to
     * @param owner to whom `shares` will be burned
     */
    function _withdrawInternal(
        uint256 assets,
        uint256 shares,
        address caller,
        address receiver,
        address owner
    ) internal returns (uint256 assets_, uint256 shares_) {
        /**
         * @dev If passed `assets` argument is greater than the max amount `owner` can withdraw
         * the maximum amount withdrawable will be withdrawn and returned from `withdrawChecks(...)`.
         */
        (assets_, shares_) = _withdrawChecks(
            caller,
            receiver,
            owner,
            assets,
            shares
        );
        _withdraw(caller, receiver, owner, assets_, shares_);
    }

    /**
     * @dev Perform `_withdraw()` at provider {IERC4626-withdraw}.
     * Requirements:
     * - Must call `activeProvider` in `_executeProviderAction()`.
     * - Must emit a Withdraw event.
     *
     * @param caller or {msg.sender}
     * @param receiver to whom `assets` amount will be transferred to
     * @param owner to whom `shares` will be burned
     * @param assets amount transferred during this withraw
     * @param shares amount burned to `owner` during this withdraw
     */
    function _withdraw(
        address caller,
        address receiver,
        address owner,
        uint256 assets,
        uint256 shares
    ) internal virtual whenNotPaused(VaultActions.Withdraw) {
        uint256 withdrawFee = assets.mulDiv(withdrawFeePercent, FEE_PRECISION);
        uint256 assetsToReceiver = assets - withdrawFee;

        _burn(owner, shares);
        _executeProviderAction(assets, "withdraw", activeProvider);

        _asset.safeTransfer(treasury, withdrawFee);
        _asset.safeTransfer(receiver, assetsToReceiver);

        emit FeesCharged(treasury, assets, withdrawFee);
        emit Withdraw(caller, receiver, owner, assetsToReceiver, shares);
    }

    /**
     * @dev Runs common checks for all "withdraw" or "redeem" actions in this vault and returns maximum
     * `assets_` and `shares_` to withdraw.
     * Requirements:
     * - Must revert for all conditions not passed.
     *
     * @param caller in msg.sender context
     * @param receiver of the withdrawn assets
     * @param owner of the withdrawn assets
     * @param assets being withdrawn
     * @param shares being burned for `owner`
     */
    function _withdrawChecks(
        address caller,
        address receiver,
        address owner,
        uint256 assets,
        uint256 shares
    ) private returns (uint256 assets_, uint256 shares_) {
        if (
            receiver == address(0) ||
            owner == address(0) ||
            assets == 0 ||
            shares == 0
        ) {
            revert InterestVault__InvalidInput();
        }

        uint256 maxWithdraw_ = maxWithdraw(owner);
        if (assets > maxWithdraw_) {
            assets_ = maxWithdraw_;
            shares_ = assets_.mulDiv(shares, assets);
        } else {
            assets_ = assets;
            shares_ = shares;
        }
        if (caller != owner) {
            _spendWithdrawAllowance(owner, caller, receiver, assets_);
        }
    }

    /*//////////////////////////
      REBALANCE Vault functions
  //////////////////////////*/

    /**
     * @dev Execute an action at provider.
     *
     * @param assets amount handled in this action
     * @param name string of the method to call
     * @param provider to whom action is being called
     */
    function _executeProviderAction(
        uint256 assets,
        string memory name,
        IProvider provider
    ) internal {
        bytes memory data = abi.encodeWithSignature(
            string(abi.encodePacked(name, "(uint256,address)")),
            assets,
            address(this)
        );
        address(provider).functionDelegateCall(
            data,
            string(abi.encodePacked(name, ": delegate call failed"))
        );
    }

    /**
     * @dev Returns balance of `asset` of this vault at all
     * listed providers in `_providers` array.
     *
     * @param method string method to call: "getDepositBalance".
     */
    function _checkProvidersBalance(
        string memory method
    ) internal view returns (uint256 assets) {
        uint256 len = _providers.length;
        bytes memory callData = abi.encodeWithSignature(
            string(abi.encodePacked(method, "(address,address)")),
            address(this),
            address(this)
        );
        bytes memory returnedBytes;
        for (uint256 i = 0; i < len; ) {
            returnedBytes = address(_providers[i]).functionStaticCall(
                callData,
                ": balance call failed"
            );
            assets += uint256(bytes32(returnedBytes));
            unchecked {
                ++i;
            }
        }
    }

    /*////////////////////
      Public getters
  /////////////////////*/

    /**
     * @notice Returns the remaining capacity of this vault.
     */
    function getVaultCapacity() public view returns (uint256) {
        if (paused(VaultActions.Deposit)) {
            return 0;
        }
        return
            vaultDepositLimit > totalAssets()
                ? vaultDepositLimit - totalAssets()
                : 0;
    }

    /**
     * @notice Returns the array of providers of this vault.
     */
    function getProviders() external view returns (IProvider[] memory list) {
        list = _providers;
    }

    /*/////////////////////////
       Admin setter functions
  /////////////////////////*/

    /// @inheritdoc IInterestVaultUpgradeable
    function setProviders(
        IProvider[] memory providers
    ) external override onlyAdmin {
        _setProviders(providers);
    }

    /// @inheritdoc IInterestVaultUpgradeable
    function setActiveProvider(
        IProvider activeProvider_
    ) external override onlyAdmin {
        _setActiveProvider(activeProvider_);
    }

    /// @inheritdoc IInterestVaultUpgradeable
    function setDepositLimits(
        uint256 userDepositLimit_,
        uint256 vaultDepositLimit_
    ) external override onlyAdmin {
        _setDepositLimits(userDepositLimit_, vaultDepositLimit_);
    }

    /// @inheritdoc IInterestVaultUpgradeable
    function setTreasury(address treasury_) external override onlyAdmin {
        treasury = treasury_;
        emit TreasuryChanged(treasury_);
    }

    /// @inheritdoc IInterestVaultUpgradeable
    function setWithdrawFee(
        uint256 withdrawFeePercent_
    ) external override onlyAdmin {
        if (withdrawFeePercent_ > MAX_WITHDRAW_FEE) {
            revert InterestVault__InvalidInput();
        }
        withdrawFeePercent = withdrawFeePercent_;
        emit FeesChanged(withdrawFeePercent_);
    }

    /// @inheritdoc IInterestVaultUpgradeable
    function setMinAmount(uint256 amount) external override onlyAdmin {
        minAmount = amount;
        emit MinAmountChanged(amount);
    }

    /// @inheritdoc VaultPausable
    function pauseForceAll() external override onlyAdmin {
        _pauseForceAllActions();
    }

    /// @inheritdoc VaultPausable
    function unpauseForceAll() external override onlyAdmin {
        _unpauseForceAllActions();
    }

    /// @inheritdoc VaultPausable
    function pause(VaultActions action) external virtual override onlyAdmin {
        _pause(action);
    }

    /// @inheritdoc VaultPausable
    function unpause(VaultActions action) external virtual override onlyAdmin {
        _unpause(action);
    }

    /**
     * @dev Sets the providers of this vault.
     * Requirements:
     * - Must be implemented at {VaultRebalancer} level.
     * - Must infinite approve erc20 transfers of `asset`.
     * - Must emit a ProvidersChanged event.
     *
     * @param providers array of addresses
     */
    function _setProviders(IProvider[] memory providers) internal virtual;

    /**
     * @dev Sets the `activeProvider` of this vault.
     * Requirements:
     * - Must emit an ActiveProviderChanged event.
     *
     * @param activeProvider_ address to be set
     */
    function _setActiveProvider(IProvider activeProvider_) internal {
        // @dev skip validity check when setting it for the 1st time
        if (
            !_isValidProvider(address(activeProvider_)) &&
            address(activeProvider) != address(0)
        ) {
            revert InterestVault__InvalidInput();
        }
        activeProvider = activeProvider_;
        emit ActiveProviderChanged(activeProvider_);
    }

    /**
     * @dev Sets the deposit limits for this vault.
     * Requirements:
     * - Must emit an DepositLimitsChanged event.
     *
     * @param userDepositLimit_ to be set
     * @param vaultDepositLimit_ to be set
     */
    function _setDepositLimits(
        uint256 userDepositLimit_,
        uint256 vaultDepositLimit_
    ) internal {
        if (
            userDepositLimit_ == 0 ||
            vaultDepositLimit_ == 0 ||
            userDepositLimit_ >= vaultDepositLimit_
        ) {
            revert InterestVault__InvalidInput();
        }
        userDepositLimit = userDepositLimit_;
        vaultDepositLimit = vaultDepositLimit_;
        emit DepositLimitsChanged(userDepositLimit_, vaultDepositLimit_);
    }

    /**
     * @dev Returns true if `provider` is in `_providers` array.
     *
     * @param provider address
     */
    function _isValidProvider(
        address provider
    ) internal view returns (bool check) {
        uint256 len = _providers.length;
        for (uint256 i = 0; i < len; ) {
            if (provider == address(_providers[i])) {
                check = true;
                break;
            }
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @dev Check rebalance fee is reasonable.
     * Requirements:
     * - Must be equal to or less than %0.10 of `amount`.
     *
     * @param fee amount to be checked
     * @param amount being rebalanced to check against
     */
    function _checkRebalanceFee(uint256 fee, uint256 amount) internal pure {
        uint256 reasonableFee = amount.mulDiv(MAX_REBALANCE_FEE, FEE_PRECISION);
        if (fee > reasonableFee) {
            revert InterestVault__ExcessRebalanceFee();
        }
    }

    function _authorizeUpgrade(address) internal override onlyAdmin {}

    uint256[49] private __gap;
}
