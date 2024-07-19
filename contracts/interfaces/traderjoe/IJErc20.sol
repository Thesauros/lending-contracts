// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {IJToken} from "./IJToken.sol";

/**
 * @title IJErc20
 *
 * @notice Interface to interact with Trader Joe's JErc20 Contract.
 *
 */
interface IJErc20 is IJToken {
    /**
     * @notice Sender supplies assets into the market and receives jTokens in exchange
     * @dev Reverts upon any failure
     */
    function mint(uint mintAmount) external returns (uint);

    /**
     * @notice Sender redeems jTokens in exchange for the underlying asset
     * @dev Reverts upon any failure
     */
    function redeem(uint redeemTokens) external returns (uint);

    /**
     * @notice Sender redeems jTokens in exchange for a specified amount of underlying asset
     * @dev Reverts upon any failure
     */
    function redeemUnderlying(uint redeemAmount) external returns (uint);
}
