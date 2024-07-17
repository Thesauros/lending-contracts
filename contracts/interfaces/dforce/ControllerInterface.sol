// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title ControllerInterface
 *
 * @notice Interface to interact with DForce's Controller contract.
 *
 * Simplified from the original DForce interface.
 */
interface ControllerInterface {
    function enterMarkets(
        address[] calldata iTokens
    ) external returns (bool[] memory);
}
