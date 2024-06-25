// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title InterestVault
 *
 * @notice An abstract ERC4626-compliant vault contract defining common functions and
 * interfaces for all vault types. User state is managed via tokenized shares and
 * liquidity for yield generation is provided by the `_providers`.
 * Setter functions are controlled by admin roles defined in {ProtocolAccessControl}.
 * Additionally, allowance and approvals for value extraction can be facilitated by
 * signed messages using {VaultPermit}.
 *
 * @dev Inspired and modified from OpenZeppelin {ERC4626}.
 */
import {ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {IInterestVault} from "../interfaces/IInterestVault.sol";
import {IProvider} from "../interfaces/IProvider.sol";
import {ProtocolAccessControl} from "../access/ProtocolAccessControl.sol";
import {VaultPermit} from "../abstracts/VaultPermit.sol";

abstract contract InterestVaultV1 is
    VaultPermit,
    ProtocolAccessControl,
    IInterestVault
{
    using Math for uint256;
    using Address for address;
    using SafeERC20 for IERC20Metadata;

    /**
     * @dev Errors
     */
    error InterestVault__InvalidInput();
    error InterestVault__VaultAlreadyInitialized();
    error InterestVault__AmountLessThanMin();
    error InterestVault__DepositMoreThanMax();

    uint256 internal constant FEE_PRECISION = 1e18;
    uint256 internal constant MAX_WITHDRAW_FEE = 0.05 * 1e18; // 5%
    uint256 internal constant MAX_REBALANCE_FEE = 0.2 * 1e18; // 20%

    IERC20Metadata internal immutable _asset;
    uint8 private immutable _underlyingDecimals;

    IProvider[] internal _providers;
    IProvider public activeProvider;

    uint256 public minAmount;

    uint256 public vaultDepositLimit;
    uint256 public userDepositLimit;

    uint256 public withdrawFeePercent;

    address public treasury;

    bool public initialized;

    /**
     * @notice Constructor for a new InterestVault contract.
     *
     * @param rebalancer_ The address of the rebalancer.
     * @param asset_ The main asset managed by this vault.
     * @param name_ The name of the token-shares managed in this vault.
     * @param symbol_ The symbol of the token-shares managed in this vault.
     *
     * @dev Requirements:
     * - The `asset_` ERC20 token must have the same decimals as `_underlyingDecimals`.
     * - The `asset_` and `rebalancer_` must not be address(0).
     *
     */
    constructor(
        address rebalancer_,
        address asset_,
        string memory name_,
        string memory symbol_
    ) ERC20(name_, symbol_) VaultPermit(name_) {
        if (asset_ == address(0) || rebalancer_ == address(0)) {
            revert InterestVault__InvalidInput();
        }

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REBALANCER_ROLE, rebalancer_);

        _asset = IERC20Metadata(asset_);
        _underlyingDecimals = IERC20Metadata(asset_).decimals();
    }

    /*////////////////////
      ERC4626 Management
    ////////////////////*/

    /**
     * @notice Returns the number of decimals used to get its user representation.
     */
    function decimals()
        public
        view
        override(IERC20Metadata, ERC20)
        returns (uint8)
    {
        return _underlyingDecimals;
    }

    /**
     * @inheritdoc IERC4626
     */
    function asset() public view override returns (address) {
        return address(_asset);
    }

    /**
     * @inheritdoc IERC4626
     */
    function totalAssets() public view override returns (uint256 assets) {
        return _checkProvidersBalance("getDepositBalance");
    }

    /**
     * @inheritdoc IERC4626
     */
    function convertToShares(
        uint256 assets
    ) public view override returns (uint256 shares) {
        return _convertToShares(assets, Math.Rounding.Down);
    }

    /**
     * @inheritdoc IERC4626
     */
    function convertToAssets(
        uint256 shares
    ) public view override returns (uint256 assets) {
        return _convertToAssets(shares, Math.Rounding.Down);
    }

    /**
     * @inheritdoc IERC4626
     */
    function maxDeposit(address owner) public view override returns (uint256) {
        if (getVaultCapacity() == 0) {
            return 0;
        }
        return _computeMaxDeposit(owner);
    }

    /**
     * @inheritdoc IERC4626
     */
    function maxMint(address owner) public view override returns (uint256) {
        if (getVaultCapacity() == 0) {
            return 0;
        }
        return _convertToShares(_computeMaxDeposit(owner), Math.Rounding.Down);
    }

    /**
     * @inheritdoc IERC4626
     */
    function maxWithdraw(address owner) public view override returns (uint256) {
        return _convertToAssets(balanceOf(owner), Math.Rounding.Down);
    }

    /**
     * @inheritdoc IERC4626
     */
    function maxRedeem(address owner) public view override returns (uint256) {
        return balanceOf(owner);
    }

    /**
     * @inheritdoc IERC4626
     */
    function previewDeposit(
        uint256 assets
    ) public view override returns (uint256) {
        return _convertToShares(assets, Math.Rounding.Down);
    }

    /**
     * @inheritdoc IERC4626
     */
    function previewMint(
        uint256 shares
    ) public view override returns (uint256) {
        return _convertToAssets(shares, Math.Rounding.Up);
    }

    /**
     * @inheritdoc IERC4626
     */
    function previewWithdraw(
        uint256 assets
    ) public view override returns (uint256) {
        return _convertToShares(assets, Math.Rounding.Up);
    }

    /**
     * @inheritdoc IERC4626
     */
    function previewRedeem(
        uint256 shares
    ) public view override returns (uint256) {
        return _convertToAssets(shares, Math.Rounding.Down);
    }

    /**
     * @inheritdoc IERC4626
     */
    function deposit(
        uint256 assets,
        address receiver
    ) public override returns (uint256) {
        uint256 shares = previewDeposit(assets);

        _validateDeposit(receiver, assets, shares);
        _deposit(msg.sender, receiver, assets, shares);

        return shares;
    }

    /**
     * @inheritdoc IERC4626
     */
    function mint(
        uint256 shares,
        address receiver
    ) public override returns (uint256) {
        uint256 assets = previewMint(shares);

        _validateDeposit(receiver, assets, shares);
        _deposit(msg.sender, receiver, assets, shares);

        return assets;
    }

    /**
     * @inheritdoc IERC4626
     */
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public override returns (uint256) {
        uint256 shares = previewWithdraw(assets);
        (uint256 validatedAssets, uint256 validatedShares) = _validateWithdraw(
            assets,
            shares,
            msg.sender,
            receiver,
            owner
        );
        _withdraw(
            msg.sender,
            receiver,
            owner,
            validatedAssets,
            validatedShares
        );
        return validatedShares;
    }

    /**
     * @inheritdoc IERC4626
     */
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) public override returns (uint256) {
        uint256 assets = previewRedeem(shares);
        (uint256 validatedAssets, uint256 validatedShares) = _validateWithdraw(
            assets,
            shares,
            msg.sender,
            receiver,
            owner
        );
        _withdraw(
            msg.sender,
            receiver,
            owner,
            validatedAssets,
            validatedShares
        );
        return validatedAssets;
    }

    /**
     * @dev Converts `assets` to shares equivalent with support for rounding direction.
     *
     * @param assets The amount to convert to shares.
     * @param rounding The direction of division remainder.
     *
     * @dev Requirements:
     * - Must return `assets` if `assets` or `totalSupply()` equals 0.
     * - Must revert if `totalAssets()` is not greater than 0.
     *   (Corresponds to a case where division by zero occurs.)
     */
    function _convertToShares(
        uint256 assets,
        Math.Rounding rounding
    ) internal view virtual returns (uint256 shares) {
        uint256 supply = totalSupply();
        return
            (assets == 0 || supply == 0)
                ? assets
                : assets.mulDiv(supply, totalAssets(), rounding);
    }

    /**
     * @dev Converts `shares` to asset type with support for rounding direction.
     *
     * @param shares The amount to convert to assets.
     * @param rounding The direction of division remainder.
     *
     * @dev Requirements:
     * - Must return `shares` if `totalSupply()` equals 0.
     */
    function _convertToAssets(
        uint256 shares,
        Math.Rounding rounding
    ) internal view virtual returns (uint256 assets) {
        uint256 supply = totalSupply();
        return
            (supply == 0)
                ? shares
                : shares.mulDiv(totalAssets(), supply, rounding);
    }

    /**
     * @dev Runs checks for all "deposit" or "mint" actions in this vault.
     *
     * @param receiver The receiver of the deposit.
     * @param assets The amount being deposited.
     * @param shares The amount being minted for `receiver`.
     *
     * @dev Requirements:
     * - Must revert for all conditions not passed.
     */
    function _validateDeposit(
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
     * @notice Executes a deposit at the provider {IERC4626-deposit}.
     *
     * @param caller The caller or {msg.sender}.
     * @param receiver The address to whom `assets` are credited by `shares` amount.
     * @param assets The amount transferred during this deposit.
     * @param shares The amount credited to `receiver` during this deposit.
     *
     * @dev Requirements:
     * - Must call `activeProvider` in `_delegateActionToProvider()`.
     * - Must emit a Deposit event after successful execution.
     */
    function _deposit(
        address caller,
        address receiver,
        uint256 assets,
        uint256 shares
    ) internal {
        _asset.safeTransferFrom(caller, address(this), assets);
        _delegateActionToProvider(assets, "deposit", activeProvider);
        _mint(receiver, shares);

        emit Deposit(caller, receiver, assets, shares);
    }

    /**
     * @notice Runs checks and handles common flow for all "withdraw" or "redeem" actions in this vault.
     *
     * @param assets The amount transferred during this withdrawal.
     * @param shares The amount burned to `owner` during this withdrawal.
     * @param caller The caller or {msg.sender}.
     * @param receiver The address to whom `assets` amount will be transferred to.
     * @param owner The address to whom `shares` will be burned.
     *
     * @dev Requirements:
     * - Must revert for all conditions not passed.
     */
    function _validateWithdraw(
        uint256 assets,
        uint256 shares,
        address caller,
        address receiver,
        address owner
    ) internal returns (uint256 assets_, uint256 shares_) {
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
            _spendAllowance(owner, caller, shares_);
        }
    }

    /**
     * @notice Executes a withdraw at the provider {IERC4626-withdraw}.
     *
     * @param caller The caller or {msg.sender}.
     * @param receiver The address to whom `assets` amount will be transferred to.
     * @param owner The address to whom `shares` will be burned.
     * @param assets The amount transferred during this withdrawal.
     * @param shares The amount burned to `owner` during this withdrawal.
     *
     * @dev Requirements:
     * - Must call `activeProvider` in `_delegateActionToProvider()`.
     * - Must emit a Withdraw event after successful execution.
     */
    function _withdraw(
        address caller,
        address receiver,
        address owner,
        uint256 assets,
        uint256 shares
    ) internal virtual {
        uint256 withdrawFee = assets.mulDiv(withdrawFeePercent, FEE_PRECISION);
        uint256 assetsToReceiver = assets - withdrawFee;

        _burn(owner, shares);
        _delegateActionToProvider(assets, "withdraw", activeProvider);

        _asset.safeTransfer(treasury, withdrawFee);
        _asset.safeTransfer(receiver, assetsToReceiver);

        emit FeesCharged(treasury, assets, withdrawFee);
        emit Withdraw(caller, receiver, owner, assetsToReceiver, shares);
    }

    /*/////////////////////
      REBALANCE functions
    /////////////////////*/

    /**
     * @notice Initializes vault shares with a specified amount of assets.
     *
     * @param assets The amount to initialize asset shares.
     *
     * @dev Requirements:
     * - Must create shares and balance to prevent inflation attack.
     * - The `assets` must be greater than `minAmount`.
     * - Any created shares must be accounted to the address(this) and permanently locked.
     * - Must pull assets from the msg.sender.
     * - Must emit a VaultInitialized event after successful execution.
     */
    function initializeVaultShares(uint256 assets) public {
        if (initialized) {
            revert InterestVault__VaultAlreadyInitialized();
        }
        if (assets < minAmount) {
            revert InterestVault__AmountLessThanMin();
        }

        _deposit(msg.sender, address(this), assets, assets);
        initialized = true;
        emit VaultInitialized(msg.sender);
    }

    /**
     * @notice Sets the active provider for this vault.
     *
     * @param activeProvider_ The address of the new active provider.
     *
     * @dev Requirements:
     * - Must be called by the admin.
     *
     * NOTE: Changing the active provider without calling `rebalance()`
     * can result in a denial of service for vault users.
     */
    function setActiveProvider(IProvider activeProvider_) external onlyAdmin {
        _setActiveProvider(activeProvider_);
    }

    /**
     * @notice Sets the deposit limits for this vault.
     *
     * @param userDepositLimit_ The new user deposit limit.
     * @param vaultDepositLimit_ The new vault deposit limit.
     *
     * @dev Requirements:
     * - Must be called by the admin.
     */
    function setDepositLimits(
        uint256 userDepositLimit_,
        uint256 vaultDepositLimit_
    ) external onlyAdmin {
        _setDepositLimits(userDepositLimit_, vaultDepositLimit_);
    }

    /**
     * @notice Sets the treasury address for this vault.
     *
     * @param treasury_ The new treasury address.
     *
     * @dev Requirements:
     * - Must be called by the admin.
     */
    function setTreasury(address treasury_) external onlyAdmin {
        _setTreasury(treasury_);
    }

    /**
     * @notice Sets the withdrawal fee percentage for this vault.
     *
     * @param withdrawFeePercent_ The new withdrawal fee percentage.
     *
     * @dev Requirements:
     * - Must be called by the admin.
     */

    function setWithdrawFee(uint256 withdrawFeePercent_) external onlyAdmin {
        _setWithdrawFee(withdrawFeePercent_);
    }

    /**
     * @notice Sets the minimum amount required for deposit and mint actions.
     *
     * @param minAmount_ The new minimum amount.
     *
     * @dev Requirements:
     * - Must be called by the admin.
     */
    function setMinAmount(uint256 minAmount_) external onlyAdmin {
        _setMinAmount(minAmount_);
    }

    /**
     * @notice Internal function to set the providers for this vault.
     *
     * @param providers An array of provider addresses.
     *
     * @dev Requirements:
     * - Must emit a ProvidersChanged event after successful execution.
     */
    function _setProviders(IProvider[] memory providers) internal {
        for (uint256 i = 0; i < providers.length; i++) {
            if (address(providers[i]) == address(0)) {
                revert InterestVault__InvalidInput();
            }
            _asset.forceApprove(
                providers[i].getOperator(asset(), asset(), address(0)),
                type(uint256).max
            );
        }
        _providers = providers;

        emit ProvidersChanged(providers);
    }

    /**
     * @notice Internal function to set the active provider for this vault.
     *
     * @param activeProvider_ The address of the new active provider.
     *
     * @dev Requirements:
     * - The active provider must be previously set by `setProviders()`.
     * - Must emit a ActiveProviderChanged event after successful execution.
     */
    function _setActiveProvider(IProvider activeProvider_) internal {
        if (
            !_validateProvider(address(activeProvider_)) &&
            address(activeProvider) != address(0)
        ) {
            revert InterestVault__InvalidInput();
        }
        activeProvider = activeProvider_;
        emit ActiveProviderChanged(activeProvider_);
    }

    /**
     * @notice Internal function to set the deposit limits for this vault.
     *
     * @param userDepositLimit_ The new user deposit limit.
     * @param vaultDepositLimit_ The new vault deposit limit.
     *
     * @dev Requirements:
     * - Both limits must not be zero.
     * - The user deposit limit must be less than the vault deposit limit.
     * - Must emit a DepositLimitsChanged event after successful execution.
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
     * @notice Internal function to set the treasury address for this vault.
     *
     * @param treasury_ The new treasury address.
     *
     * @dev Requirements:
     * - The treasury address must not be address(0).
     * - Must emit a TreasuryChanged event after successful execution.
     */
    function _setTreasury(address treasury_) internal {
        if (treasury_ == address(0)) {
            revert InterestVault__InvalidInput();
        }
        treasury = treasury_;
        emit TreasuryChanged(treasury_);
    }

    /**
     * @notice Internal function to set the withdrawal fee percentage for this vault.
     *
     * @param withdrawFeePercent_ The new withdrawal fee percentage.
     *
     * @dev Requirements:
     * - The withdrawal fee percentage must not exceed the maximum allowed.
     * - Must emit a WithdrawFeeChanged event after successful execution.
     */
    function _setWithdrawFee(uint256 withdrawFeePercent_) internal {
        if (withdrawFeePercent_ > MAX_WITHDRAW_FEE) {
            revert InterestVault__InvalidInput();
        }
        withdrawFeePercent = withdrawFeePercent_;
        emit WithdrawFeeChanged(withdrawFeePercent_);
    }

    /**
     * @notice Internal function to set the minimum amount required for deposit and
     * mint actions.
     *
     * @param minAmount_ The new minimum amount.
     *
     * @dev Requirements:
     *
     * - Must emit a MinAmountChanged event after successful execution.
     */

    function _setMinAmount(uint256 minAmount_) internal {
        minAmount = minAmount_;
        emit MinAmountChanged(minAmount_);
    }

    /**
     * @dev Delegate an action to a provider.
     *
     * @param assets The amount of assets involved in the action.
     * @param actionName The string identifier of the method to call.
     * @param provider The address of the provider to whom the action is
     * delegated.
     */
    function _delegateActionToProvider(
        uint256 assets,
        string memory actionName,
        IProvider provider
    ) internal {
        bytes memory data = abi.encodeWithSignature(
            string(abi.encodePacked(actionName, "(uint256,address)")),
            assets,
            address(this)
        );
        address(provider).functionDelegateCall(
            data,
            string(abi.encodePacked(actionName, ": delegate call failed"))
        );
    }

    /**
     * @notice Computes the maximum deposit amount for a given depositor.
     *
     * @param depositor The address of the depositor whose maximum deposit amount is being calculated.
     */
    function _computeMaxDeposit(
        address depositor
    ) internal view returns (uint256 max) {
        uint256 balance = _convertToAssets(
            balanceOf(depositor),
            Math.Rounding.Down
        );
        uint256 maxDepositor = userDepositLimit > balance
            ? userDepositLimit - balance
            : 0;

        max = maxDepositor > getVaultCapacity()
            ? getVaultCapacity()
            : maxDepositor;
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
        bytes memory data = abi.encodeWithSignature(
            string(abi.encodePacked(method, "(address,address)")),
            address(this),
            address(this)
        );
        bytes memory returnedBytes;
        uint256 length = _providers.length;
        for (uint256 i = 0; i < length; i++) {
            returnedBytes = address(_providers[i]).functionStaticCall(
                data,
                ": balance call failed"
            );
            assets += uint256(bytes32(returnedBytes));
        }
    }

    /**
     * @dev Returns true if `provider` is in `_providers` array.
     *
     * @param provider The address of the provider to validate.
     */
    function _validateProvider(
        address provider
    ) internal view returns (bool isValid) {
        uint256 length = _providers.length;
        for (uint256 i = 0; i < length; i++) {
            if (provider == address(_providers[i])) {
                isValid = true;
            }
        }
    }

    /**
     * @notice Returns the amount of assets owned by `owner`.
     *
     * @param owner The address to check the balance for.
     *
     */
    function getBalanceOfAsset(
        address owner
    ) public view returns (uint256 assets) {
        return _convertToAssets(balanceOf(owner), Math.Rounding.Down);
    }

    /**
     * @notice Returns the remaining capacity of this vault.
     */
    function getVaultCapacity() public view returns (uint256) {
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
}
