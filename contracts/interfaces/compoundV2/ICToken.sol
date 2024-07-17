// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ICToken
 *
 * @notice Interface to interact with Compound's CToken contract.
 *
 */
interface ICToken is IERC20 {
    function getCash() external view returns (uint256);

    function totalBorrows() external view returns (uint256);

    function totalReserves() external view returns (uint256);

    function exchangeRateStored() external view returns (uint256);

    function borrowRatePerBlock() external view returns (uint256);

    function supplyRatePerBlock() external view returns (uint256);

    function accrualBlockNumber() external view returns (uint256);

    function reserveFactorMantissa() external view returns (uint256);

    function balanceOfUnderlying(address owner) external returns (uint);
}
