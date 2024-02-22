// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title IiETH
 *
 * @notice Interface to interact with DForce iETH.
 * 
 */

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IiToken} from "./IiToken.sol";

interface IiETH is IiToken {
  function mint(address _recipient) external payable;

  function mintForSelfAndEnterMarket() external payable;
}
