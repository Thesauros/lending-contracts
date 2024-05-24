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
     * @dev Modifier to make a function callable only when `VaultAction` in the contract
     * is not paused.
     */
    modifier whenNotPaused(VaultActions action) {
        _requireNotPaused(action);
        _;
    }

    /**
     * @dev Modifier to make a function callable only when `VaultAction` in the contract
     * is paused.
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
    function pauseForceAll() external virtual override;

    /**
     * @inheritdoc IVaultPausable
     */
    function unpauseForceAll() external virtual override;

    /**
     * @inheritdoc IVaultPausable
     */
    function pause(VaultActions action) external virtual override;

    /**
     * @inheritdoc IVaultPausable
     */
    function unpause(VaultActions action) external virtual override;

    /**
     * @dev Throws if the `action` in contract is paused.
     *
     * @param action Enum: 0-deposit, 1-withdraw
     */
    function _requireNotPaused(VaultActions action) private view {
        if (_actionsPaused[action]) {
            revert VaultPausable__ActionPaused();
        }
    }

    /**
     * @dev Throws if the `action` in contract is not paused.
     *
     * @param action Enum: 0-deposit, 1-withdraw
     */
    function _requirePaused(VaultActions action) private view {
        if (!_actionsPaused[action]) {
            revert VaultPausable__ActionNotPaused();
        }
    }

    /**
     * @dev Sets pause state for `action` of this vault.
     *
     * @param action Enum: 0-deposit, 1-withdraw
     */
    function _pause(VaultActions action) internal whenNotPaused(action) {
        _actionsPaused[action] = true;
        emit Paused(msg.sender, action);
    }

    /**
     * @dev Sets unpause state for `action` of this vault.
     *
     * @param action Enum: 0-deposit, 1-withdraw
     */
    function _unpause(VaultActions action) internal whenPaused(action) {
        _actionsPaused[action] = false;
        emit Unpaused(msg.sender, action);
    }

    /**
     * @dev Forces set paused state for all `VaultActions`.
     */
    function _pauseForceAllActions() internal {
        _actionsPaused[VaultActions.Deposit] = true;
        _actionsPaused[VaultActions.Withdraw] = true;
        emit PausedForceAll(msg.sender);
    }

    /**
     * @dev Forces set unpause state for all `VaultActions`.
     */
    function _unpauseForceAllActions() internal {
        _actionsPaused[VaultActions.Deposit] = false;
        _actionsPaused[VaultActions.Withdraw] = false;
        emit UnpausedForceAll(msg.sender);
    }
}
