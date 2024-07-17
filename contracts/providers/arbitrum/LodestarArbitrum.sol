// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IInterestVault} from "../../interfaces/IInterestVault.sol";
import {IProvider} from "../../interfaces/IProvider.sol";
import {IProviderManager} from "../../interfaces/IProviderManager.sol";
import {ComptrollerInterface} from "../../interfaces/compoundV2/ComptrollerInterface.sol";
import {ICEther} from "../../interfaces/compoundV2/ICEther.sol";
import {ICErc20} from "../../interfaces/compoundV2/ICErc20.sol";
import {ICToken} from "../../interfaces/compoundV2/ICToken.sol";
import {IWETH} from "../../interfaces/IWETH.sol";
import {LibCompoundV2} from "../../libraries/LibCompoundV2.sol";

/**
 * @title LodestarArbitrum
 *
 * @notice This contract allows interaction with Lodestar on Arbitrum mainnet.
 *
 * @dev The IProviderManager needs to be properly configured for Lodestar.
 */
contract LodestarArbitrum is IProvider {
    /**
     * @dev Errors
     */
    error LodestarArbitrum__AddressZero();

    IProviderManager private immutable _providerManager;

    constructor(address providerManager_) {
        if (providerManager_ == address(0)) {
            revert LodestarArbitrum__AddressZero();
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
        address cTokenAddress = _getInterestToken(asset);

        // Enter and/or ensure collateral market is enabled
        _enterMarket(cTokenAddress);

        if (_isWETH(asset)) {
            IWETH(asset).withdraw(amount);

            ICEther cToken = ICEther(cTokenAddress);

            cToken.mint{value: amount}();
        } else {
            ICErc20 cToken = ICErc20(cTokenAddress);

            cToken.mint(amount);
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
        address cTokenAddress = _getInterestToken(asset);

        ICErc20 cToken = ICErc20(cTokenAddress);

        cToken.redeemUnderlying(amount);

        if (_isWETH(asset)) {
            IWETH(asset).deposit{value: amount}();
        }
        success = true;
    }

    /**
     * @dev Adds assets to be included in the account's liquidity calculation in Lodestar.
     * @param cTokenAddress The address of the cToken market to be enabled.
     */
    function _enterMarket(address cTokenAddress) internal {
        ComptrollerInterface comptroller = ComptrollerInterface(
            _getComptroller()
        );

        address[] memory cTokenMarkets = new address[](1);
        cTokenMarkets[0] = cTokenAddress;
        comptroller.enterMarkets(cTokenMarkets);
    }

    /**
     * @dev Returns the underlying {ICToken} associated with the specified asset for interaction with Lodestar.
     * @param asset The address of the token to be used as collateral.
     */
    function _getInterestToken(
        address asset
    ) internal view returns (address cToken) {
        cToken = _providerManager.getProtocolToken(getProviderName(), asset);
    }

    /**
     * @dev Checks if the given token is WETH.
     * @param token The address of the token to check.
     */
    function _isWETH(address token) internal pure returns (bool) {
        return token == 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    }

    /**
     * @notice Returns the Comptroller address of Lodestar.
     */
    function _getComptroller() internal pure returns (address) {
        return 0xa86DD95c210dd186Fa7639F93E4177E97d057576;
    }

    /**
     * @inheritdoc IProvider
     */
    function getDepositBalance(
        address user,
        IInterestVault vault
    ) external view override returns (uint256 balance) {
        address asset = vault.asset();
        ICToken cToken = ICToken(_getInterestToken(asset));
        balance = LibCompoundV2.viewUnderlyingBalanceOf(cToken, user);
    }

    /**
     * @inheritdoc IProvider
     */
    function getDepositRateFor(
        IInterestVault vault
    ) external view override returns (uint256 rate) {
        address cTokenAddress = _getInterestToken(vault.asset());

        // Scaled by 1e9 to return ray(1e27) per IProvider specs, Lodestar uses base 1e18 number.
        uint256 sRatePerBlock = ICToken(cTokenAddress).supplyRatePerBlock() *
            10 ** 9;

        // The approximate number of blocks per year that is assumed by the Lodestar's interest rate model
        uint256 blocksPerYear = 2628000;
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
        return "Lodestar_Arbitrum";
    }
}
