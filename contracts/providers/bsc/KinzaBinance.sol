// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPool} from "../../interfaces/aaveV3/IPool.sol";
import {IInterestVault} from "../../interfaces/IInterestVault.sol";
import {IProvider} from "../../interfaces/IProvider.sol";

/**
 * @title KinzaBinance
 *
 * @notice This contract allows interaction with Kinza Finance on Binance Smart Chain.
 */
contract KinzaBinance is IProvider {
    /**
     * @inheritdoc IProvider
     */
    function deposit(
        uint256 amount,
        IInterestVault vault
    ) external override returns (bool success) {
        IPool kinza = _getPool();
        kinza.supply(vault.asset(), amount, address(vault), 0);
        success = true;
    }

    /**
     * @inheritdoc IProvider
     */
    function withdraw(
        uint256 amount,
        IInterestVault vault
    ) external override returns (bool success) {
        IPool kinza = _getPool();
        kinza.withdraw(vault.asset(), amount, address(vault));
        success = true;
    }

    /**
     * @dev Returns the {IPool} pool to interact with Kinza Finance.
     */
    function _getPool() internal pure returns (IPool) {
        return IPool(0xcB0620b181140e57D1C0D8b724cde623cA963c8C);
    }

    /**
     * @inheritdoc IProvider
     */
    function getDepositBalance(
        address user,
        IInterestVault vault
    ) external view override returns (uint256 balance) {
        IPool kinza = _getPool();
        IPool.ReserveData memory rdata = kinza.getReserveData(vault.asset());
        balance = IERC20(rdata.aTokenAddress).balanceOf(user);
    }

    /**
     * @inheritdoc IProvider
     */
    function getDepositRateFor(
        IInterestVault vault
    ) external view override returns (uint256 rate) {
        IPool kinza = _getPool();
        IPool.ReserveData memory rdata = kinza.getReserveData(vault.asset());
        rate = rdata.currentLiquidityRate;
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
        return "Kinza_Binance";
    }
}
