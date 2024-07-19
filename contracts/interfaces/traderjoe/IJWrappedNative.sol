// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {IJToken} from "./IJToken.sol";

/**
 * @title IJWrappedNative
 *
 * @notice Interface to interact with Trader Joe's JWrappedNative contract.
 *
 */
interface IJWrappedNative is IJToken {
    /**
     * @notice Sender supplies assets into the market and receives jTokens in exchange
     * @dev Reverts upon any failure
     */
    function mintNative() external payable;

    /**
     * @notice Sender redeems jTokens in exchange for the underlying asset
     * @dev Reverts upon any failure
     */
    function redeemNative(uint redeemTokens) external returns (uint);

    /**
     * @notice Sender redeems jTokens in exchange for a specified amount of underlying asset
     * @dev Reverts upon any failure
     */
    function redeemUnderlyingNative(uint redeemAmount) external returns (uint);
}
