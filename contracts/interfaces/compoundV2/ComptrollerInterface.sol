// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title ComptrollerInterface
 *
 * @notice Interface to interact with Compound's Comptroller contract.
 *
 * Simplified from the original Compound interface.
 */
interface ComptrollerInterface {
    function enterMarkets(
        address[] calldata cTokens
    ) external returns (uint[] memory);

    function exitMarket(address cToken) external returns (uint);
}
