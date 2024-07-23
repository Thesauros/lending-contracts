// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {ICToken} from "./ICToken.sol";

/**
 * @title ICErc20
 *
 * @notice Interface to interact with Compound's CErc20 contract.
 */
interface ICErc20 is ICToken {
    /**
     * @notice Sender supplies assets into the market and receives cTokens in exchange
     * @dev Reverts upon any failure
     */
    function mint(uint mintAmount) external returns (uint);

    /**
     * @notice Sender redeems cTokens in exchange for the underlying asset
     * @dev Reverts upon any failure
     */
    function redeem(uint redeemTokens) external returns (uint);

    /**
     * @notice Sender redeems cTokens in exchange for a specified amount of underlying asset
     * @dev Reverts upon any failure
     */
    function redeemUnderlying(uint redeemAmount) external returns (uint);
}
