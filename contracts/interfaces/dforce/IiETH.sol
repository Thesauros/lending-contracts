// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {IiToken} from "./IiToken.sol";

/**
 * @title IiETH
 *
 * @notice Interface to interact with DForce's iETH contract.
 *
 */
interface IiETH is IiToken {
    /**
     * @dev Caller deposits assets into the market and `_recipient` receives iToken in exchange.
     * @param recipient The account that would receive the iToken.
     */
    function mint(address recipient) external payable;
}
