// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title SiloArbitrum
 *
 * @notice This contract allows interaction with ARB token Silo on Arbitrum mainnet.
 */

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ISilo} from "../../interfaces/silo/ISilo.sol";
import {ISiloLens} from "../../interfaces/silo/ISiloLens.sol";
import {IShareToken} from "../../interfaces/silo/IShareToken.sol";
import {IInterestVault} from "../../interfaces/IInterestVault.sol";
import {IProvider} from "../../interfaces/IProvider.sol";

contract SiloArbitrum is IProvider {
    error SiloArbitrum__AssetsZero();

    /**
     * @inheritdoc IProvider
     */
    function deposit(
        uint256 amount,
        IInterestVault vault
    ) external override returns (bool success) {
        ISilo silo = _getSilo();
        silo.deposit(vault.asset(), amount, false);
        success = true;
    }

    /**
     * @inheritdoc IProvider
     */
    function withdraw(
        uint256 amount,
        IInterestVault vault
    ) external override returns (bool success) {
        ISilo silo = _getSilo();
        silo.withdraw(vault.asset(), amount, false);
        success = true;
    }

    /**
     * @dev Returns the {ISilo} to interact with ARB token Silo.
     */
    function _getSilo() internal pure returns (ISilo) {
        return ISilo(0x0696E6808EE11a5750733a3d821F9bB847E584FB);
    }

    /**
     * @dev Returns the {ISiloLens} to interact with SiloLens contract.
     */
    function _getLens() internal pure returns (ISiloLens) {
        return ISiloLens(0xBDb843c7a7e48Dc543424474d7Aa63b61B5D9536);
    }

    /**
     * @dev Converts a specified amount of shares to an equivalent amount of assets.
     * @param share The amount of shares to be converted.
     * @param totalAmount The total amount of assets.
     * @param totalShares The total amount of shares.
     */
    function _convertToAmount(
        uint256 share,
        uint256 totalAmount,
        uint256 totalShares
    ) internal pure returns (uint256 result) {
        if (totalShares == 0 || totalAmount == 0) {
            return 0;
        }

        result = (share * totalAmount) / totalShares;
    }

    /**
     * @inheritdoc IProvider
     */
    function getDepositBalance(
        address user,
        IInterestVault vault
    ) external view override returns (uint256 balance) {
        ISilo silo = _getSilo();
        IShareToken shareToken = silo
            .assetStorage(vault.asset())
            .collateralToken;
        uint256 assetTotalDeposits = silo
            .assetStorage(vault.asset())
            .totalDeposits;
        balance = _convertToAmount(
            shareToken.balanceOf(user),
            assetTotalDeposits,
            shareToken.totalSupply()
        );
    }

    /**
     * @inheritdoc IProvider
     */
    function getDepositRateFor(
        IInterestVault vault
    ) external view override returns (uint256 rate) {
        ISiloLens lens = _getLens();
        // Scaled by 1e9 to return ray(1e27) per IProvider specs, Silo uses base 1e18 number.
        rate = lens.depositAPY(_getSilo(), vault.asset()) * 10 ** 9;
    }

    /**
     * @inheritdoc IProvider
     */
    function getOperator(
        address,
        address,
        address
    ) external pure override returns (address operator) {
        operator = address(_getSilo());
    }

    /**
     * @inheritdoc IProvider
     */
    function getProviderName() public pure override returns (string memory) {
        return "Silo_Arbitrum";
    }
}
