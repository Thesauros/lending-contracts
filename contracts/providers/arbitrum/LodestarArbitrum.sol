// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title LodestarArbitrum
 *
 * @notice This contract allows interaction with Lodestar.
 *
 * @dev The IProviderManager needs to be properly configured for Lodestar.
 */

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IInterestVault} from "../../interfaces/IInterestVault.sol";
import {IProvider} from "../../interfaces/IProvider.sol";
import {IProviderManager} from "../../interfaces/IProviderManager.sol";
import {ComptrollerInterface} from "../../interfaces/compoundV2/ComptrollerInterface.sol";
import {ICETH} from "../../interfaces/compoundV2/ICETH.sol";
import {ICERC20} from "../../interfaces/compoundV2/ICERC20.sol";
import {ICToken} from "../../interfaces/compoundV2/ICToken.sol";
import {IWETH} from "../../interfaces/IWETH.sol";
import {LibCompoundV2} from "../../libraries/LibCompoundV2.sol";

contract LodestarArbitrum is IProvider {
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
        address cTokenAddress = _getCToken(asset);

        _enterCollatMarket(cTokenAddress);

        if (_isWETH(asset)) {
            IWETH(asset).withdraw(amount);

            ICETH cToken = ICETH(cTokenAddress);
            // Compound protocol Mints cTokens, ETH method

            cToken.mint{value: amount}();
        } else {
            ICERC20 cToken = ICERC20(cTokenAddress);

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
        address cTokenAddress = _getCToken(asset);

        ICToken cToken = ICToken(cTokenAddress);

        cToken.redeemUnderlying(amount);

        if (_isWETH(asset)) {
            IWETH(asset).deposit{value: amount}();
        }
        success = true;
    }

    /**
     * @dev Approves vault's assets as collateral for Lodestar Protocol.
     *
     * @param _cTokenAddress address of the underlying {ICToken} to be approved as collateral.   *
     */
    function _enterCollatMarket(address _cTokenAddress) internal {
        ComptrollerInterface comptroller = ComptrollerInterface(
            _getComptrollerAddress()
        );

        address[] memory cTokenMarkets = new address[](1);
        cTokenMarkets[0] = _cTokenAddress;
        comptroller.enterMarkets(cTokenMarkets);
    }

    /**
     * @dev Returns Lodestar's underlying {ICToken} associated with the 'asset' to interact with Lodestar.
     *
     * @param asset address of the token to be used as collateral/debt.
     */
    function _getCToken(address asset) internal view returns (address cToken) {
        cToken = _providerManager.getProtocolToken(getProviderName(), asset);
    }

    /**
     * @dev Returns true/false wether the given 'token' is/isn't WETH.
     *
     * @param token address of the token
     */
    function _isWETH(address token) internal pure returns (bool) {
        return token == 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    }

    /**
     * @dev Returns the Controller address of Lodestar.
     */
    function _getComptrollerAddress() internal pure returns (address) {
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
        ICToken cToken = ICToken(_getCToken(asset));
        balance = LibCompoundV2.viewUnderlyingBalanceOf(cToken, user);
    }

    /**
     * @inheritdoc IProvider
     */
    function getDepositRateFor(
        IInterestVault vault
    ) external view override returns (uint256 rate) {
        address cTokenAddress = _getCToken(vault.asset());

        // Block Rate transformed for common mantissa for Rebalance in ray (1e27), Note: Compound uses base 1e18
        uint256 bRateperBlock = ICToken(cTokenAddress).supplyRatePerBlock() *
            10 ** 9;

        // The approximate number of blocks per year that is assumed by the Compound interest rate model
        uint256 blocksperYear = 2336000;
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
        operator = _getCToken(keyAsset);
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
        return "Lodestar_Arbitrum";
    }
}
