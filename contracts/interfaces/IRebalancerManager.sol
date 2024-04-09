// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title IRebalancerManager
 *
 * @notice Defines the interface of {RebalancerManager}.
 */

import {IInterestVault} from "./IInterestVault.sol";
import {IProvider} from "./IProvider.sol";

interface IRebalancerManager {
    /**
     * @dev Emit when `executor`'s `allowed` state changes.
     *
     * @param executor whose permission is changing
     * @param allowed boolean for new state
     */
    event AllowExecutor(address indexed executor, bool allowed);

    /**
     * @notice Rebalance funds of a vault between providers.
     *
     * @param vault that will be rebalanced
     * @param assets amount to be rebalanced
     * @param from provider address
     * @param to provider address
     * @param fee amount to be charged
     * @param setToAsActiveProvider boolean if `activeProvider` should change
     *
     * @dev Requirements:
     * - Must only be called by a valid executor.
     * - Must check `assets` amount is less than `vault`'s managed amount.
     *
     * NOTE: For argument `assets` you can pass `type(uint256).max` in solidity
     * to effectively rebalance 100% of assets from one provider to another.
     * Hints:
     *  - In ethers.js use `ethers.constants.MaxUint256` to return equivalent BigNumber.
     *  - In Foundry using console use $(cast max-uint).
     */
    function rebalanceVault(
        IInterestVault vault,
        uint256 assets,
        IProvider from,
        IProvider to,
        uint256 fee,
        bool setToAsActiveProvider
    ) external returns (bool success);

    /**
     * @notice Set `executor` as an authorized address for calling rebalancer operations
     * or remove authorization.
     *
     * @param executor address
     * @param allowed boolean
     *
     * @dev Requirement:
     * - Must be called from the admin.
     * - Must emit a `AllowExecutor` event.
     */
    function allowExecutor(address executor, bool allowed) external;
}
