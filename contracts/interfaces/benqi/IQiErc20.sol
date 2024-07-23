// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {IQiToken} from "./IQiToken.sol";

/**
 * @title IQiErc20
 *
 * @notice Interface to interact with Benqi's QiErc20 Contract.
 */
interface IQiErc20 is IQiToken {
    /**
     * @notice Sender supplies assets into the market and receives qiTokens in exchange
     * @dev Reverts upon any failure
     */
    function mint(uint mintAmount) external returns (uint);

    /**
     * @notice Sender redeems qiTokens in exchange for the underlying asset
     * @dev Reverts upon any failure
     */
    function redeem(uint redeemTokens) external returns (uint);

    /**
     * @notice Sender redeems qiTokens in exchange for a specified amount of underlying asset
     * @dev Reverts upon any failure
     */
    function redeemUnderlying(uint redeemAmount) external returns (uint);
}
