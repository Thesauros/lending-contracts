// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "@openzeppelin/contracts/utils/Context.sol";

/**
 * @title AccessManager
 *
 * @notice This contract implements role-based access
 * control mechanisms.
 *
 * @dev Inspired and modified from OpenZeppelin's AccessControl contract.
 */
contract AccessManager is Context {
    /**
     * @dev Errors
     */
    error AccessManager__CallerIsNotAdmin();
    error AccessManager__CallerIsNotRootUpdater();

    mapping(bytes32 role => mapping(address account => bool)) private _roles;

    bytes32 public constant ADMIN_ROLE = 0x00;
    bytes32 public constant ROOT_UPDATER_ROLE = keccak256("ROOT_UPDATER_ROLE");

    /**
     * @dev Emitted when `account` is granted `role`.
     */
    event RoleGranted(
        bytes32 indexed role,
        address indexed account,
        address indexed sender
    );

    /**
     * @dev Emitted when `account` is revoked `role`.
     */
    event RoleRevoked(
        bytes32 indexed role,
        address indexed account,
        address indexed sender
    );

    /**
     * @dev Modifier that checks that an account has an admin role. Reverts
     * with an {AccessManager__CallerIsNotAdmin} error.
     */
    modifier onlyAdmin() {
        if (!hasRole(ADMIN_ROLE, _msgSender())) {
            revert AccessManager__CallerIsNotAdmin();
        }
        _;
    }

    /**
     * @dev Modifier that checks that an account has a root updater role. Reverts
     * with an {AccessManager__CallerIsNotRootUpdater} error.
     */
    modifier onlyRootUpdater() {
        if (!hasRole(ROOT_UPDATER_ROLE, _msgSender())) {
            revert AccessManager__CallerIsNotRootUpdater();
        }
        _;
    }

    /**
     * @dev Sets the deployer of the contract as the initial admin.
     */
    constructor() {
        _grantRole(ADMIN_ROLE, _msgSender());
    }

    /**
     * @dev Returns `true` if `account` has been granted `role`.
     */
    function hasRole(
        bytes32 role,
        address account
    ) public view virtual returns (bool) {
        return _roles[role][account];
    }

    /**
     * @dev Grants `role` to `account`.
     *
     * If `account` had not been already granted `role`, emits a {RoleGranted}
     * event.
     *
     * Requirements:
     *
     * - the caller must have admin role.
     *
     * May emit a {RoleGranted} event.
     */
    function grantRole(bytes32 role, address account) public onlyAdmin {
        _grantRole(role, account);
    }

    /**
     * @dev Revokes `role` from `account`.
     *
     * If `account` had been granted `role`, emits a {RoleRevoked} event.
     *
     * Requirements:
     *
     * - the caller must have admin role.
     *
     * May emit a {RoleRevoked} event.
     */
    function revokeRole(bytes32 role, address account) public onlyAdmin {
        _revokeRole(role, account);
    }

    /**
     * @dev Attempts to grant `role` to `account`.
     *
     * Internal function without access restriction.
     *
     * May emit a {RoleGranted} event.
     */
    function _grantRole(bytes32 role, address account) internal {
        if (!hasRole(role, account)) {
            _roles[role][account] = true;
            emit RoleGranted(role, account, _msgSender());
        }
    }

    /**
     * @dev Attempts to revoke `role` from `account`.
     *
     * Internal function without access restriction.
     *
     * May emit a {RoleRevoked} event.
     */
    function _revokeRole(bytes32 role, address account) internal {
        if (hasRole(role, account)) {
            _roles[role][account] = false;
            emit RoleRevoked(role, account, _msgSender());
        }
    }
}
