// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title AaveV3Arbitrum
 *
 * @notice This contract allows interaction with AaveV3 on Arbitrum mainnet.
 */

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPool} from "../../interfaces/aaveV3/IPool.sol";
import {IInterestVault} from "../../interfaces/IInterestVault.sol";
import {IProvider} from "../../interfaces/IProvider.sol";

contract AaveV3Arbitrum is IProvider {
    /// @inheritdoc IProvider
    function deposit(
        uint256 amount,
        IInterestVault vault
    ) external override returns (bool success) {
        IPool aave = _getPool();
        address asset = vault.asset();
        aave.supply(asset, amount, address(vault), 0);
        success = true;
    }

    /// @inheritdoc IProvider
    function withdraw(
        uint256 amount,
        IInterestVault vault
    ) external override returns (bool success) {
        IPool aave = _getPool();
        aave.withdraw(vault.asset(), amount, address(vault));
        success = true;
    }

    function _getPool() internal pure returns (IPool) {
        return IPool(0x794a61358D6845594F94dc1DB02A252b5b4814aD);
    }

    /// @inheritdoc IProvider
    function getDepositBalance(
        address user,
        IInterestVault vault
    ) external view override returns (uint256 balance) {
        IPool aaveData = _getPool();
        IPool.ReserveData memory rdata = aaveData.getReserveData(vault.asset());
        balance = IERC20(rdata.aTokenAddress).balanceOf(user);
    }

    /// @inheritdoc IProvider
    function getDepositRateFor(
        IInterestVault vault
    ) external view override returns (uint256 rate) {
        IPool aaveData = _getPool();
        IPool.ReserveData memory rdata = aaveData.getReserveData(vault.asset());
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
        return "Aave_V3_Arbitrum";
    }
}
