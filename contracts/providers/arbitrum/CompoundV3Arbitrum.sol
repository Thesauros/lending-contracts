// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title CompoundV3Arbitrum
 *
 * @notice This contract allows interaction with CompoundV3 on Arbitrum mainnet.
 *
 * @dev The IProviderManager needs to be properly configured for CompoundV3.
 */

import {IProvider} from "../../interfaces/IProvider.sol";
import {IInterestVault} from "../../interfaces/IInterestVault.sol";
import {CometInterface} from "../../interfaces/compoundV3/CometInterface.sol";
import {IProviderManager} from "../../interfaces/IProviderManager.sol";

contract CompoundV3Arbitrum is IProvider {
    /**
     * @dev Errors
     */
    error CompoundV3Arbitrum__AddressZero();

    IProviderManager private immutable _providerManager;

    constructor(address providerManager_) {
        if (providerManager_ == address(0)) {
            revert CompoundV3Arbitrum__AddressZero();
        }
        _providerManager = IProviderManager(providerManager_);
    }

    /**
     * @inheritdoc IProvider
     */
    function deposit(
        uint256 amount,
        IInterestVault vault
    ) external returns (bool success) {
        (CometInterface cMarketV3, address asset) = _getMarketAndAssets(vault);
        cMarketV3.supply(asset, amount);
        success = true;
    }

    /**
     * @inheritdoc IProvider
     */
    function withdraw(
        uint256 amount,
        IInterestVault vault
    ) external returns (bool success) {
        (CometInterface cMarketV3, address asset) = _getMarketAndAssets(vault);
        cMarketV3.withdraw(asset, amount);
        success = true;
    }

    /**
     * @dev Returns corresponding Comet Market from passed `vault` address.
     */
    function _getMarketAndAssets(
        IInterestVault vault
    ) private view returns (CometInterface cMarketV3, address asset) {
        asset = vault.asset();
        // market == baseToken for Comet if we want to earn interest
        address market = _providerManager.getProtocolToken(
            getProviderName(),
            asset
        );

        cMarketV3 = CometInterface(market);
    }

    /**
     * @inheritdoc IProvider
     */
    function getDepositBalance(
        address user,
        IInterestVault vault
    ) external view returns (uint256 balance) {
        (CometInterface cMarketV3, ) = _getMarketAndAssets(vault);
        balance = cMarketV3.balanceOf(user);
    }

    /**
     * @inheritdoc IProvider
     */
    function getDepositRateFor(
        IInterestVault vault
    ) external view returns (uint256 rate) {
        (CometInterface cMarketV3, ) = _getMarketAndAssets(vault);
        uint256 utilization = cMarketV3.getUtilization();
        // Scaled by 1e9 to return ray(1e27) per IProvider specs, Compound uses base 1e18 number.
        uint256 ratePerSecond = cMarketV3.getSupplyRate(utilization) * 10 ** 9;
        // 31536000 seconds in a `year` = 60 * 60 * 24 * 365.
        rate = ratePerSecond * 31536000;
    }

    /**
     * @inheritdoc IProvider
     */
    function getOperator(
        address,
        address asset,
        address
    ) external view returns (address operator) {
        operator = _providerManager.getProtocolToken(getProviderName(), asset);
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
        return "Compound_V3_Arbitrum";
    }
}
