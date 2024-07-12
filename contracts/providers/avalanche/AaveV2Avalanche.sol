// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title AaveV2Avalanche
 *
 * @notice This contract allows interaction with AaveV2 on Avalanche.
 */

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IInterestVault} from "../../interfaces/IInterestVault.sol";
import {IProvider} from "../../interfaces/IProvider.sol";
import {ILendingPool} from "../../interfaces/aaveV2/ILendingPool.sol";

contract AaveV2Avalanche is IProvider {
    /**
     * @inheritdoc IProvider
     */
    function deposit(
        uint256 amount,
        IInterestVault vault
    ) external override returns (bool success) {
        ILendingPool aave = _getPool();
        aave.deposit(vault.asset(), amount, address(vault), 0);
        success = true;
    }

    /**
     * @inheritdoc IProvider
     */
    function withdraw(
        uint256 amount,
        IInterestVault vault
    ) external override returns (bool success) {
        ILendingPool aave = _getPool();
        aave.withdraw(vault.asset(), amount, address(vault));
        success = true;
    }

    /**
     * @dev Returns the {ILendingPool} pool to interact with AaveV2.
     */
    function _getPool() internal pure returns (ILendingPool) {
        return ILendingPool(0x4F01AeD16D97E3aB5ab2B501154DC9bb0F1A5A2C);
    }

    /**
     * @inheritdoc IProvider
     */
    function getDepositBalance(
        address user,
        IInterestVault vault
    ) external view override returns (uint256 balance) {
        ILendingPool aave = _getPool();
        ILendingPool.ReserveData memory reserveData = aave.getReserveData(
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
        ILendingPool aave = _getPool();
        ILendingPool.ReserveData memory reserveData = aave.getReserveData(
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
        return "Aave_V2_Avalanche";
    }
}
