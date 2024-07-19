// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IInterestVault} from "../../interfaces/IInterestVault.sol";
import {IProvider} from "../../interfaces/IProvider.sol";
import {IProviderManager} from "../../interfaces/IProviderManager.sol";
import {ComptrollerInterface} from "../../interfaces/compoundV2/ComptrollerInterface.sol";
import {IJWrappedNative} from "../../interfaces/traderjoe/IJWrappedNative.sol";
import {IJErc20} from "../../interfaces/traderjoe/IJErc20.sol";
import {IJToken} from "../../interfaces/traderjoe/IJToken.sol";
import {IWETH} from "../../interfaces/IWETH.sol";
import {LibTraderJoe} from "../../libraries/LibTraderJoe.sol";

/**
 * @title TraderJoeAvalanche
 *
 * @notice This contract allows interaction with Trader Joe on Avalanche.
 *
 * @dev The IProviderManager needs to be properly configured for Trader Joe.
 */
contract TraderJoeAvalanche is IProvider {
    /**
     * @dev Errors
     */
    error TraderJoeAvalanche__AddressZero();

    IProviderManager private immutable _providerManager;

    constructor(address providerManager_) {
        if (providerManager_ == address(0)) {
            revert TraderJoeAvalanche__AddressZero();
        }
        _providerManager = IProviderManager(providerManager_);
    }

    /**
     * @inheritdoc IProvider
     */
    function deposit(
        uint256 amount,
        IInterestVault vault
    ) external override returns (bool success) {
        address asset = vault.asset();
        address jTokenAddress = _getInterestToken(asset);

        // Enter and/or ensure collateral market is enabled
        _enterMarket(jTokenAddress);

        if (_isWAVAX(asset)) {
            IWETH(asset).withdraw(amount);

            IJWrappedNative jToken = IJWrappedNative(jTokenAddress);

            jToken.mintNative{value: amount}();
        } else {
            IJErc20 jToken = IJErc20(jTokenAddress);

            jToken.mint(amount);
        }
        success = true;
    }

    /**
     * @inheritdoc IProvider
     */
    function withdraw(
        uint256 amount,
        IInterestVault vault
    ) external override returns (bool success) {
        address asset = vault.asset();
        address jTokenAddress = _getInterestToken(asset);

        if (_isWAVAX(asset)) {
            IJWrappedNative jToken = IJWrappedNative(jTokenAddress);

            jToken.redeemUnderlyingNative(amount);

            IWETH(asset).deposit{value: amount}();
        } else {
            IJErc20 jToken = IJErc20(jTokenAddress);

            jToken.redeemUnderlying(amount);
        }
        success = true;
    }

    /**
     * @dev Adds assets to be included in the account's liquidity calculation in Trader Joe.
     * @param jTokenAddress The address of the jToken market to be enabled.
     */
    function _enterMarket(address jTokenAddress) internal {
        ComptrollerInterface comptroller = ComptrollerInterface(
            _getComptroller()
        );

        address[] memory jTokenMarkets = new address[](1);
        jTokenMarkets[0] = jTokenAddress;
        comptroller.enterMarkets(jTokenMarkets);
    }

    /**
     * @dev Returns the underlying {IJToken} associated with the specified asset for interaction with Trader Joe.
     * @param asset The address of the token to be used as collateral.
     */
    function _getInterestToken(
        address asset
    ) internal view returns (address jToken) {
        jToken = _providerManager.getProtocolToken(getProviderName(), asset);
    }

    /**
     * @dev Checks if the given token is WAVAX.
     * @param token The address of the token to check.
     */
    function _isWAVAX(address token) internal pure returns (bool) {
        return token == 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;
    }

    /**
     * @notice Returns the Comptroller address of Trader Joe.
     */
    function _getComptroller() internal pure returns (address) {
        return 0xdc13687554205E5b89Ac783db14bb5bba4A1eDaC;
    }

    /**
     * @inheritdoc IProvider
     */
    function getDepositBalance(
        address user,
        IInterestVault vault
    ) external view override returns (uint256 balance) {
        address asset = vault.asset();
        IJToken jToken = IJToken(_getInterestToken(asset));
        balance = LibTraderJoe.viewUnderlyingBalanceOf(jToken, user);
    }

    /**
     * @inheritdoc IProvider
     */
    function getDepositRateFor(
        IInterestVault vault
    ) external view override returns (uint256 rate) {
        address jTokenAddress = _getInterestToken(vault.asset());

        // Scaled by 1e9 to return ray(1e27) per IProvider specs, Trader Joe uses base 1e18 number.
        uint256 sRatePerSecond = IJToken(jTokenAddress).supplyRatePerSecond() *
            10 ** 9;

        // The approximate number of seconds per year that is assumed by the Trader Joe's interest rate model
        uint256 secondsPerYear = 31536000;
        rate = sRatePerSecond * secondsPerYear;
    }

    /**
     * @inheritdoc IProvider
     */
    function getOperator(
        address,
        address asset,
        address
    ) external view override returns (address operator) {
        operator = _getInterestToken(asset);
    }

    /**
     * @notice Returns the {ProviderManager} contract applicable to this provider.
     */
    function getProviderManager() public view returns (IProviderManager) {
        return _providerManager;
    }

    /**
     * @inheritdoc IProvider
     */
    function getProviderName() public pure override returns (string memory) {
        return "Trader_Joe_Avalanche";
    }
}
