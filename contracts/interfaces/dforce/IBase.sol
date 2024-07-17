// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IBase
 *
 * @notice Interface to interact with DForce's Base contract.
 *
 */
interface IBase is IERC20 {
    function exchangeRateStored() external view returns (uint256);

    function controller() external view returns (address);

    function borrowRatePerBlock() external view returns (uint256);

    function supplyRatePerBlock() external view returns (uint256);

    function totalBorrows() external view returns (uint256);

    function borrowIndex() external view returns (uint256);

    function getCash() external view returns (uint256);

    function accrualBlockNumber() external view returns (uint256);

    function totalReserves() external view returns (uint256);

    function reserveRatio() external view returns (uint256);

    function balanceOfUnderlying(address user) external returns (uint256);
}
