// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {ICToken} from "./ICToken.sol";

/**
 * @title ICEther
 *
 * @notice Interface to interact with Compound's CEther contract.
 */
interface ICEther is ICToken {
    /**
     * @notice Sender supplies assets into the market and receives cTokens in exchange
     *
     * @dev Reverts upon any failure
     */
    function mint() external payable;
}
