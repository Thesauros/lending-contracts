// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title ICERC20
 *
 * @notice Interface to interact with CompoundV2 cTokens.
 */

import {ICToken} from "./ICToken.sol";

interface ICERC20 is ICToken {
    function mint(uint256 amount) external returns (uint256);
}
