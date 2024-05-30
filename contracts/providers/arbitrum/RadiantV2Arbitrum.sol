// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title RadiantV2Arbitrum
 *
 * @notice This contract allows interaction with RadiantV2 on Arbitrum mainnet.
 */

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IInterestVault} from "../../interfaces/IInterestVault.sol";
import {IProvider} from "../../interfaces/IProvider.sol";
import {ILendingPool} from "../../interfaces/aaveV2/ILendingPool.sol";

contract RadiantV2Arbitrum is IProvider {
    /**
     * @inheritdoc IProvider
     */
    function deposit(
        uint256 amount,
        IInterestVault vault
    ) external override returns (bool success) {
        ILendingPool radiant = _getPool();
        radiant.deposit(vault.asset(), amount, address(vault), 0);
        success = true;
    }

    /**
     * @inheritdoc IProvider
     */
    function withdraw(
        uint256 amount,
        IInterestVault vault
    ) external override returns (bool success) {
        ILendingPool radiant = _getPool();
        radiant.withdraw(vault.asset(), amount, address(vault));
        success = true;
    }

    /**
     * @dev Returns the {ILendingPool} pool to interact with RadiantV2.
     */
    function _getPool() internal pure returns (ILendingPool) {
        return ILendingPool(0xF4B1486DD74D07706052A33d31d7c0AAFD0659E1);
    }

    /**
     * @inheritdoc IProvider
     */
    function getDepositBalance(
        address user,
        IInterestVault vault
    ) external view override returns (uint256 balance) {
        ILendingPool radiant = _getPool();
        ILendingPool.ReserveData memory reserveData = radiant.getReserveData(
            vault.asset()
        );
        balance = IERC20(reserveData.aTokenAddress).balanceOf(user);
    }

    /**
     * @inheritdoc IProvider
     */
    function getDepositRateFor(
        IInterestVault vault
    ) external view override returns (uint256 rate) {
        ILendingPool radiant = _getPool();
        ILendingPool.ReserveData memory reserveData = radiant.getReserveData(
            vault.asset()
        );
        rate = reserveData.currentLiquidityRate;
    }

    /**
     * @inheritdoc IProvider
     */
    function getOperator(
        address,
        address,
        address
    ) external pure override returns (address operator) {
        operator = address(_getPool());
    }

    /**
     * @inheritdoc IProvider
     */
    function getProviderName() public pure override returns (string memory) {
        return "Radiant_V2_Arbitrum";
    }
}
