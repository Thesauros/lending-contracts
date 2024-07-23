// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Counters} from "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title VaultPermit
 *
 * @notice An abstract contract intended to be inherited by tokenized vaults, that
 * allows approvals to be made via signatures, as defined in EIP-2612.
 *
 * @dev Inspired and modified from OpenZeppelin {ERC20Permit}.
 */
abstract contract VaultPermit is ERC20, IERC20Permit, EIP712 {
    using Counters for Counters.Counter;
    using ECDSA for bytes32;

    /**
     * @dev Errors
     */
    error VaultPermit__ExpiredDeadline();
    error VaultPermit__InvalidSignature();

    mapping(address => Counters.Counter) private _nonces;

    // solhint-disable-next-line var-name-mixedcase
    bytes32 private constant _PERMIT_TYPEHASH =
        keccak256(
            "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
        );
    /**
     * @dev Reserve a slot as recommended in OpenZeppelin {ERC20Permit}
     */
    // solhint-disable-next-line var-name-mixedcase
    bytes32 private _PERMIT_TYPEHASH_DEPRECATED_SLOT;

    constructor(string memory _name) EIP712(_name, "1") {}

    /**
     * @inheritdoc IERC20Permit
     */
    function permit(
        address owner,
        address spender,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public override {
        if (block.timestamp > deadline) {
            revert VaultPermit__ExpiredDeadline();
        }

        bytes32 structHash = keccak256(
            abi.encode(
                _PERMIT_TYPEHASH,
                owner,
                spender,
                amount,
                _useNonce(owner),
                deadline
            )
        );

        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = hash.toEthSignedMessageHash().recover(v, r, s);
        if (signer != owner) {
            revert VaultPermit__InvalidSignature();
        }

        _approve(owner, spender, amount);
    }

    /**
     * @dev "Consume a nonce": return the current value and increment.
     *
     * @param owner The owner of the nonce.
     */
    function _useNonce(address owner) internal returns (uint256 current) {
        Counters.Counter storage nonce = _nonces[owner];
        current = nonce.current();
        nonce.increment();
    }

    /**
     * @inheritdoc IERC20Permit
     */
    // solhint-disable-next-line func-name-mixedcase
    function DOMAIN_SEPARATOR() external view override returns (bytes32) {
        return _domainSeparatorV4();
    }

    /**
     * @inheritdoc IERC20Permit
     */
    function nonces(address owner) public view override returns (uint256) {
        return _nonces[owner].current();
    }
}
