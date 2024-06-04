// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title VaultPausable
 *
 * @notice An abstract contract intended to be inherited by tokenized vaults, that
 * allows to have granular control over vault actions.
 *
 * @dev Inspired and modified from OpenZeppelin {Pausable}.
 */

import {IVaultPausable} from "../interfaces/IVaultPausable.sol";

abstract contract VaultPausable is IVaultPausable {
    /**
     * @dev Errors
     */
    error VaultPausable__ActionPaused();
    error VaultPausable__ActionNotPaused();

    mapping(VaultActions => bool) private _actionsPaused;

    /**
     * @dev Modifier to make a function callable only when the specified `action` is not paused.
     *
     * @param action The action to check (e.g., deposit or withdraw).
     */
    modifier whenNotPaused(VaultActions action) {
        _requireNotPaused(action);
        _;
    }

    /**
     * @dev Modifier to make a function callable only when the specified `action` is paused.
     *
     * @param action The action to check (e.g., deposit or withdraw).
     */
    modifier whenPaused(VaultActions action) {
        _requirePaused(action);
        _;
    }

    /**
     * @inheritdoc IVaultPausable
     */
    function paused(VaultActions action) public view virtual returns (bool) {
        return _actionsPaused[action];
    }

    /**
     * @inheritdoc IVaultPausable
     */
    function pauseAll() external virtual override;

    /**
     * @inheritdoc IVaultPausable
     */
    function unpauseAll() external virtual override;

    /**
     * @inheritdoc IVaultPausable
     */
    function pause(VaultActions action) external virtual override;

    /**
     * @inheritdoc IVaultPausable
     */
    function unpause(VaultActions action) external virtual override;

    /**
     * @dev Throws if the specified `action` is paused.
     *
     * @param action The action to check (0 for deposit, 1 for withdraw).
     */
    function _requireNotPaused(VaultActions action) private view {
        if (_actionsPaused[action]) {
            revert VaultPausable__ActionPaused();
        }
    }

    /**
     * @dev Throws if the specified `action` is not paused.
     *
     * @param action The action to check (0 for deposit, 1 for withdraw).
     */
    function _requirePaused(VaultActions action) private view {
        if (!_actionsPaused[action]) {
            revert VaultPausable__ActionNotPaused();
        }
    }

    /**
     * @dev Sets the paused state for the specified `action`.
     *
     * @param action The action to pause (0 for deposit, 1 for withdraw).
     */
    function _pause(VaultActions action) internal whenNotPaused(action) {
        _actionsPaused[action] = true;
        emit Paused(msg.sender, action);
    }

    /**
     * @dev Sets the unpaused state for the specified `action`.
     *
     * @param action The action to unpause (0 for deposit, 1 for withdraw).
     */
    function _unpause(VaultActions action) internal whenPaused(action) {
        _actionsPaused[action] = false;
        emit Unpaused(msg.sender, action);
    }

    /**
     * @dev Forces the paused state for all `VaultActions`.
     */
    function _pauseAllActions() internal {
        _actionsPaused[VaultActions.Deposit] = true;
        _actionsPaused[VaultActions.Withdraw] = true;
        emit PausedAll(msg.sender);
    }

    /**
     * @dev Forces the unpaused state for all `VaultActions`.
     */
    function _unpauseAllActions() internal {
        _actionsPaused[VaultActions.Deposit] = false;
        _actionsPaused[VaultActions.Withdraw] = false;
        emit UnpausedAll(msg.sender);
    }
}
