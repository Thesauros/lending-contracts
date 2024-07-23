// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {IBase} from "./IBase.sol";

/**
 * @title IiToken
 *
 * @notice Interface to interact with DForce's iToken contract.
 */
interface IiToken is IBase {
    /**
     * @dev Caller deposits assets into the market and `recipient` receives iToken in exchange.
     * @param recipient The account that would receive the iToken.
     * @param mintAmount The amount of the underlying token to deposit.
     */
    function mint(address recipient, uint256 mintAmount) external;

    /**
     * @dev Caller redeems specified iToken from `from` to get underlying token.
     * @param from The account that would burn the iToken.
     * @param redeemTokens The number of iToken to redeem.
     */
    function redeem(address from, uint256 redeemTokens) external;

    /**
     * @dev Caller redeems specified underlying from `from` to get underlying token.
     * @param from The account that would burn the iToken.
     * @param redeemAmount The number of underlying to redeem.
     */
    function redeemUnderlying(address from, uint256 redeemAmount) external;
}
