// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IInterestVault} from "../../interfaces/IInterestVault.sol";
import {IProvider} from "../../interfaces/IProvider.sol";
import {IProviderManager} from "../../interfaces/IProviderManager.sol";
import {ControllerInterface} from "../../interfaces/dforce/ControllerInterface.sol";
import {IiToken} from "../../interfaces/dforce/IiToken.sol";
import {IiETH} from "../../interfaces/dforce/IiETH.sol";
import {IWETH} from "../../interfaces/IWETH.sol";
import {LibDForce} from "../../libraries/LibDForce.sol";

/**
 * @title DForceArbitrum
 *
 * @notice This contract allows interaction with DForce on Arbitrum mainnet.
 *
 * @dev The IProviderManager needs to be properly configured for DForce.
 */
contract DForceArbitrum is IProvider {
    /**
     * @dev Errors
     */
    error DForceArbitrum__AddressZero();

    IProviderManager private immutable _providerManager;

    constructor(address providerManager_) {
        if (providerManager_ == address(0)) {
            revert DForceArbitrum__AddressZero();
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
        address iTokenAddress = _getInterestToken(asset);

        // Enter and/or ensure collateral market is enacted
        _enterMarket(iTokenAddress);

        if (_isWETH(asset)) {
            IWETH(asset).withdraw(amount);

            IiETH iToken = IiETH(iTokenAddress);

            iToken.mint{value: amount}(address(this));
        } else {
            IiToken iToken = IiToken(iTokenAddress);

            iToken.mint(address(this), amount);
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
        address iTokenAddress = _getInterestToken(asset);

        IiToken iToken = IiToken(iTokenAddress);

        iToken.redeemUnderlying(address(this), amount);

        if (_isWETH(asset)) {
            IWETH(asset).deposit{value: amount}();
        }
        success = true;
    }

    /**
     * @dev Adds assets to be included in the account's liquidity calculation in DForce.
     * @param iTokenAddress The address of the iToken market to be enabled.
     */
    function _enterMarket(address iTokenAddress) internal {
        ControllerInterface controller = ControllerInterface(_getController());

        address[] memory iTokenMarkets = new address[](1);
        iTokenMarkets[0] = iTokenAddress;
        controller.enterMarkets(iTokenMarkets);
    }

    /**
     * @dev Returns the underlying {IiToken} associated with the specified asset for interaction with DForce.
     * @param asset The address of the token to be used as collateral.
     */
    function _getInterestToken(
        address asset
    ) internal view returns (address iToken) {
        iToken = _providerManager.getProtocolToken(getProviderName(), asset);
    }

    /**
     * @dev Checks if the given token is WETH.
     * @param token The address of the token to check.
     */
    function _isWETH(address token) internal pure returns (bool) {
        return token == 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    }

    /**
     * @dev Returns the Controller address of DForce.
     */
    function _getController() internal pure returns (address) {
        return 0x8E7e9eA9023B81457Ae7E6D2a51b003D421E5408;
    }

    /**
     * @inheritdoc IProvider
     */
    function getDepositBalance(
        address user,
        IInterestVault vault
    ) external view override returns (uint256 balance) {
        address asset = vault.asset();
        IiToken iToken = IiToken(_getInterestToken(asset));
        balance = LibDForce.viewUnderlyingBalanceOf(iToken, user);
    }

    /**
     * @inheritdoc IProvider
     */
    function getDepositRateFor(
        IInterestVault vault
    ) external view override returns (uint256 rate) {
        address iTokenAddress = _getInterestToken(vault.asset());

        // Scaled by 1e9 to return ray(1e27) per IProvider specs, DForce uses base 1e18 number.
        uint256 sRatePerBlock = IiToken(iTokenAddress).supplyRatePerBlock() *
            10 ** 9;

        // The approximate number of blocks per year that is assumed by the dForce's interest rate model
        uint256 blocksPerYear = 2425846;
        rate = sRatePerBlock * blocksPerYear;
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
        return "DForce_Arbitrum";
    }
}
