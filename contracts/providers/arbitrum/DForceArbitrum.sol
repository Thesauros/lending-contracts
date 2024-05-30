// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title DForceArbitrum
 *
 * @notice This contract allows interaction with DForce on Arbitrum mainnet.
 *
 * @dev The IProviderManager needs to be properly configured for DForce.
 */

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IInterestVault} from "../../interfaces/IInterestVault.sol";
import {IProvider} from "../../interfaces/IProvider.sol";
import {IProviderManager} from "../../interfaces/IProviderManager.sol";
import {ComptrollerInterface} from "../../interfaces/compoundV2/ComptrollerInterface.sol";
import {IiToken} from "../../interfaces/dforce/IiToken.sol";
import {IiERC20} from "../../interfaces/dforce/IiERC20.sol";
import {IiETH} from "../../interfaces/dforce/IiETH.sol";
import {IWETH} from "../../interfaces/IWETH.sol";
import {LibDForce} from "../../libraries/LibDForce.sol";

contract DForceArbitrum is IProvider {
    IProviderManager private immutable _providerManager;

    constructor(address providerManager_) {
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
        _enterCollatMarket(iTokenAddress);

        if (_isWETH(asset)) {
            IWETH(asset).withdraw(amount);

            IiETH iToken = IiETH(iTokenAddress);
            // dForce protocol Mints iTokens, ETH method
            iToken.mint{value: amount}(address(this));
        } else {
            IiERC20 iToken = IiERC20(iTokenAddress);
            // dForce Protocol mints iTokens
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

        // DForce Protocol Redeem Process, throws errow if not.
        iToken.redeemUnderlying(address(this), amount);

        if (_isWETH(asset)) {
            IWETH(asset).deposit{value: amount}();
        }
        success = true;
    }

    /**
     * @dev Approves vault's assets as collateral for dForce Protocol.
     *
     * @param _iTokenAddress address of the underlying {IiToken} to be approved as collateral
     */
    function _enterCollatMarket(address _iTokenAddress) internal {
        ComptrollerInterface controller = ComptrollerInterface(
            _getControllerAddress()
        );

        address[] memory iTokenMarkets = new address[](1);
        iTokenMarkets[0] = _iTokenAddress;
        controller.enterMarkets(iTokenMarkets);
    }

    /**
     * @dev Returns DForce's underlying {IiToken} associated with the 'asset' to interact with DForce.
     *
     * @param asset address of the token to be used as collateral/debt
     */
    function _getInterestToken(
        address asset
    ) internal view returns (address iToken) {
        iToken = _providerManager.getProtocolToken(getProviderName(), asset);
    }

    /**
     * @dev Returns true/false wether the given token is/isn't WETH.
     *
     * @param token address of the 'token'
     */
    function _isWETH(address token) internal pure returns (bool) {
        return token == 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    }

    /**
     * @dev Returns the Controller address of DForce.
     */
    function _getControllerAddress() internal pure returns (address) {
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

        // Block Rate transformed for common mantissa for Rebalance in ray (1e27), Note: dForce uses base 1e18
        uint256 bRateperBlock = IiToken(iTokenAddress).supplyRatePerBlock() *
            10 ** 9;

        // The approximate number of blocks per year that is assumed by the dForce interest rate model
        uint256 blocksperYear = 2102400;
        rate = bRateperBlock * blocksperYear;
    }

    /**
     * @inheritdoc IProvider
     */
    function getOperator(
        address keyAsset,
        address,
        address
    ) external view override returns (address operator) {
        operator = _getInterestToken(keyAsset);
    }

    /**
     * @dev Returns the {IProviderManager}.
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
