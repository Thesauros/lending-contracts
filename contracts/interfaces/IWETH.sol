// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title IWETH9
 *
 * @notice Interface of typical ERC20 wrapped native token.
 */

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IWETH is IERC20 {
    function deposit() external payable;

    function withdraw(uint256) external;
}
