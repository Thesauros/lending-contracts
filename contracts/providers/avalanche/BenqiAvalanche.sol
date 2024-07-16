// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IInterestVault} from "../../interfaces/IInterestVault.sol";
import {IProvider} from "../../interfaces/IProvider.sol";
import {IProviderManager} from "../../interfaces/IProviderManager.sol";
import {ComptrollerInterface} from "../../interfaces/compoundV2/ComptrollerInterface.sol";
import {IQiAvax} from "../../interfaces/benqi/IQiAvax.sol";
import {IQiErc20} from "../../interfaces/benqi/IQiErc20.sol";
import {IQiToken} from "../../interfaces/benqi/IQiToken.sol";
import {IWETH} from "../../interfaces/IWETH.sol";
import {LibBenqi} from "../../libraries/LibBenqi.sol";

/**
 * @title BenqiAvalanche
 *
 * @notice This contract allows interaction with Benqi on Avalanche.
 *
 * @dev The IProviderManager needs to be properly configured for Benqi.
 */
contract BenqiAvalanche is IProvider {
    /**
     * @dev Errors
     */
    error BenqiAvalanche__AddressZero();

    IProviderManager private immutable _providerManager;

    constructor(address providerManager_) {
        if (providerManager_ == address(0)) {
            revert BenqiAvalanche__AddressZero();
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
        address qiTokenAddress = _getInterestToken(asset);

        // Enter and/or ensure collateral market is enabled
        _enterMarket(qiTokenAddress);

        if (_isWAVAX(asset)) {
            IWETH(asset).withdraw(amount);

            IQiAvax qiToken = IQiAvax(qiTokenAddress);

            qiToken.mint{value: amount}();
        } else {
            IQiErc20 qiToken = IQiErc20(qiTokenAddress);

            qiToken.mint(amount);
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
        address qiTokenAddress = _getInterestToken(asset);

        IQiErc20 qiToken = IQiErc20(qiTokenAddress);

        qiToken.redeemUnderlying(amount);

        if (_isWAVAX(asset)) {
            IWETH(asset).deposit{value: amount}();
        }
        success = true;
    }

    /**
     * @dev Adds assets to be included in the account's liquidity calculation in Benqi.
     * @param qiTokenAddress The address of the qiToken market to be enabled.
     */
    function _enterMarket(address qiTokenAddress) internal {
        ComptrollerInterface comptroller = ComptrollerInterface(
            _getComptroller()
        );

        address[] memory qiTokenMarkets = new address[](1);
        qiTokenMarkets[0] = qiTokenAddress;
        comptroller.enterMarkets(qiTokenMarkets);
    }

    /**
     * @dev Returns the underlying {IQiToken} associated with the specified asset for interaction with Benqi.
     * @param asset The address of the token to be used as collateral.
     */
    function _getInterestToken(
        address asset
    ) internal view returns (address qiToken) {
        qiToken = _providerManager.getProtocolToken(getProviderName(), asset);
    }

    /**
     * @dev Checks if the given token is WAVAX.
     * @param token The address of the token to check.
     */
    function _isWAVAX(address token) internal pure returns (bool) {
        return token == 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;
    }

    /**
     * @notice Returns the Comptroller address of Benqi.
     */
    function _getComptroller() internal pure returns (address) {
        return 0x486Af39519B4Dc9a7fCcd318217352830E8AD9b4;
    }

    /**
     * @inheritdoc IProvider
     */
    function getDepositBalance(
        address user,
        IInterestVault vault
    ) external view override returns (uint256 balance) {
        address asset = vault.asset();
        IQiToken qiToken = IQiToken(_getInterestToken(asset));
        balance = LibBenqi.viewUnderlyingBalanceOf(qiToken, user);
    }

    /**
     * @inheritdoc IProvider
     */
    function getDepositRateFor(
        IInterestVault vault
    ) external view override returns (uint256 rate) {
        address qiTokenAddress = _getInterestToken(vault.asset());

        // Scaled by 1e9 to return ray(1e27) per IProvider specs, Benqi uses base 1e18 number.
        uint256 sRatePerTimestamp = IQiToken(qiTokenAddress)
            .supplyRatePerTimestamp() * 10 ** 9;

        // The approximate number of timestamps per year that is assumed by the Benqi's interest rate model
        uint256 timestampsPerYear = 31536000;
        rate = sRatePerTimestamp * timestampsPerYear;
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
        return "Benqi_Avalanche";
    }
}
