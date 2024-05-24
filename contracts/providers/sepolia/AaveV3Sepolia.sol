// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title AaveV3Sepolia
 *
 * @notice This contract allows interaction with AaveV3 on Ethereum Sepolia.
 */

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPool} from "../../interfaces/aaveV3/IPool.sol";
import {IInterestVaultV2} from "../../interfaces/IInterestVaultV2.sol";
import {IProvider} from "../../interfaces/IProvider.sol";

contract AaveV3Sepolia is IProvider {
    /// @inheritdoc IProvider
    function deposit(
        uint256 amount,
        IInterestVaultV2 vault
    ) external override returns (bool success) {
        IPool aave = _getPool();
        aave.supply(vault.asset(), amount, address(vault), 0);
        success = true;
    }

    /// @inheritdoc IProvider
    function withdraw(
        uint256 amount,
        IInterestVaultV2 vault
    ) external override returns (bool success) {
        IPool aave = _getPool();
        aave.withdraw(vault.asset(), amount, address(vault));
        success = true;
    }

    /**
     * @dev Returns the {IPool} pool to interact with AaveV3.
     */
    function _getPool() internal pure returns (IPool) {
        return IPool(0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951);
    }

    /// @inheritdoc IProvider
    function getDepositBalance(
        address user,
        IInterestVaultV2 vault
    ) external view override returns (uint256 balance) {
        IPool aave = _getPool();
        IPool.ReserveData memory rdata = aave.getReserveData(vault.asset());
        balance = IERC20(rdata.aTokenAddress).balanceOf(user);
    }

    /// @inheritdoc IProvider
    function getDepositRateFor(
        IInterestVaultV2 vault
    ) external view override returns (uint256 rate) {
        IPool aave = _getPool();
        IPool.ReserveData memory rdata = aave.getReserveData(vault.asset());
        rate = rdata.currentLiquidityRate;
    }

    /// @inheritdoc IProvider
    function getOperator(
        address,
        address,
        address
    ) external pure override returns (address operator) {
        operator = address(_getPool());
    }

    /// @inheritdoc IProvider
    function getProviderName() public pure override returns (string memory) {
        return "Aave_V3_Sepolia";
    }
}
