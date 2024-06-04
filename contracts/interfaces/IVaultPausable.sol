// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title IVaultPausable
 *
 * @notice Defines the interface for VaultPausable contract.
 */

interface IVaultPausable {
    enum VaultActions {
        Deposit, // 0
        Withdraw // 1
    }

    /**
     * @dev Emitted when `action` is paused by `account`.
     *
     * @param account The address that triggered the pause.
     * @param action The action that was paused.
     */
    event Paused(address account, VaultActions action);

    /**
     * @dev Emitted when `action` is unpaused by `account`.
     *
     * @param account The address that lifted the pause.
     * @param action The action that was unpaused.
     */
    event Unpaused(address account, VaultActions action);

    /**
     * @dev Emitted when all `VaultActions` are forcibly paused by `account`.
     *
     * @param account The address that triggered the pause for all actions.
     */
    event PausedAll(address account);

    /**
     * @dev Emitted when the forced pause is lifted for all `VaultActions` by `account`.
     *
     * @param account The address that lifted the pause for all actions.
     */
    event UnpausedAll(address account);

    /**
     * @notice Checks if the `action` is paused.
     *
     * @param action The action to check the pause status for.
     */
    function paused(VaultActions action) external view returns (bool);

    /**
     * @notice Forces a pause on all `VaultActions`.
     *
     * @dev Requirements:
     * - Must be implemented in a child contract with appropriate access restrictions.
     */
    function pauseAll() external;

    /**
     * @notice Lifts the forced pause on all `VaultActions`.
     *
     * @dev Requirements:
     * - Must be implemented in a child contract with appropriate access restrictions.
     */
    function unpauseAll() external;

    /**
     * @notice Pauses a specific `action` for this vault.
     *
     * @param action The action to pause (0 for deposit, 1 for withdraw).
     *
     * @dev Requirements:
     * - The `action` must not already be paused.
     * - Must be implemented in a child contract with appropriate access restrictions.
     */
    function pause(VaultActions action) external;

    /**
     * @notice Unpauses a specific `action` for this vault.
     *
     * @param action The action to unpause (0 for deposit, 1 for withdraw).
     *
     * @dev Requirements:
     * - The `action` must be paused.
     * - Must be implemented in a child contract with appropriate access restrictions.
     */
    function unpause(VaultActions action) external;
}
