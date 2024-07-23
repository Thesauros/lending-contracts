// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {ISilo} from "./ISilo.sol";

/**
 * @title ISiloLens
 *
 * @notice Interface to interact with SiloLens contract
 */
interface ISiloLens {
    function depositAPY(
        ISilo _silo,
        address _asset
    ) external view returns (uint256);
}
