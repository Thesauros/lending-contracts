// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title ICETH
 *
 * @notice Interface to interact with CompoundV2 cETH.
 *
 */

import {ICToken} from "./ICToken.sol";

interface ICETH is ICToken {
    /**
     * @notice Sender supplies assets into the market and receives cTokens in exchange
     *
     * @dev Reverts upon any failure
     */
    function mint() external payable;
}
