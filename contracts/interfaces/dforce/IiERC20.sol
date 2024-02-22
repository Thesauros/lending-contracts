// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title IIERC20
 * 
 * @notice Interface to interact with DForce iTokens.
 * 
 */

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IiToken} from "./IiToken.sol";

interface IiERC20 is IiToken {
  function mint(address _recipient, uint256 _mintAmount) external;

  function mintForSelfAndEnterMarket(uint256 _mintAmount) external;
}
