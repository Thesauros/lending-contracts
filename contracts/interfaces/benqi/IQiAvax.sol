// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {IQiToken} from "./IQiToken.sol";

/**
 * @title IQiAvax
 *
 * @notice Interface to interact with Benqi's QiAvax contract.
 */
interface IQiAvax is IQiToken {
    /**
     * @notice Sender supplies assets into the market and receives qiTokens in exchange
     * @dev Reverts upon any failure
     */
    function mint() external payable;
}
