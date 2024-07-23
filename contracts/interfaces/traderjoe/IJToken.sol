// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IJToken
 *
 * @notice Interface to interact with Trader Joe's JToken contract.
 */
interface IJToken is IERC20 {
    function getCash() external view returns (uint256);

    function totalBorrows() external view returns (uint256);

    function totalReserves() external view returns (uint256);

    function exchangeRateStored() external view returns (uint256);

    function borrowRatePerSecond() external view returns (uint256);

    function supplyRatePerSecond() external view returns (uint256);

    function accrualBlockTimestamp() external view returns (uint256);

    function reserveFactorMantissa() external view returns (uint256);

    function balanceOfUnderlying(address owner) external returns (uint256);
}
