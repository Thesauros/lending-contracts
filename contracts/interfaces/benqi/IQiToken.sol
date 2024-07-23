// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IQiToken
 *
 * @notice Interface to interact with Benqi's QiToken contract.
 */
interface IQiToken is IERC20 {
    function exchangeRateStored() external view returns (uint);

    function accrualBlockTimestamp() external view returns (uint256);

    function reserveFactorMantissa() external view returns (uint256);

    function borrowRatePerTimestamp() external view returns (uint256);

    function supplyRatePerTimestamp() external view returns (uint256);

    function getCash() external view returns (uint256);

    function totalBorrows() external view returns (uint256);

    function totalReserves() external view returns (uint256);

    function balanceOfUnderlying(address owner) external returns (uint256);
}
