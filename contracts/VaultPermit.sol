// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title VaultPermit
 *
 * @notice An abstract contract intended to be inherited by tokenized vaults, that
 * allow users to modify allowance of withdraw operations by signing a
 * structured data {EIP712} message.
 * This implementation is inspired by EIP2612 used for `ERC20-permit()`.
 * The use of `permitWithdraw()` allows for third party contracts
 * or "operators" to perform actions on behalf of users.
 */

import {IVaultPermit} from "./interfaces/IVaultPermit.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";

contract VaultPermit is IVaultPermit, Nonces, EIP712 {
  using ECDSA for bytes32;
  using MessageHashUtils for bytes32;

  /// @dev Custom Errors
  error VaultPermit__AddressZero();
  error VaultPermit__ExpiredDeadline();
  error VaultPermit__InvalidSignature();
  error VaultPermit__InsufficientWithdrawAllowance();
  error VaultPermit__AllowanceBelowZero();

  /// @dev Allowance mapping structure: owner => operator => receiver => amount.
  mapping(address => mapping(address => mapping(address => uint256))) internal _withdrawAllowance;

  bytes32 private constant PERMIT_WITHDRAW_TYPEHASH = keccak256(
    "PermitWithdraw(address owner,address operator,address receiver,uint256 amount,uint256 nonce,uint256 deadline,bytes32 actionArgsHash)"
  );

  constructor(string memory _name, string memory _version)EIP712(_name, _version){}

  /// @inheritdoc IVaultPermit
  function withdrawAllowance(
    address owner,
    address operator,
    address receiver
  )
    public
    view
    override
    returns (uint256)
  {
    return _withdrawAllowance[owner][operator][receiver];
  }

  /// @inheritdoc IVaultPermit
  function increaseWithdrawAllowance(
    address operator,
    address receiver,
    uint256 byAmount
  )
    public
    override
    returns (bool)
  {
    address owner = msg.sender;
    _setWithdrawAllowance(
      owner, operator, receiver, _withdrawAllowance[owner][operator][receiver] + byAmount
    );
    return true;
  }

  /// @inheritdoc IVaultPermit
  function decreaseWithdrawAllowance(
    address operator,
    address receiver,
    uint256 byAmount
  )
    public
    override
    returns (bool)
  {
    address owner = msg.sender;
    uint256 currentAllowance = _withdrawAllowance[owner][operator][receiver];
    if (byAmount > currentAllowance) {
      revert VaultPermit__AllowanceBelowZero();
    }
    unchecked {
      _setWithdrawAllowance(owner, operator, receiver, currentAllowance - byAmount);
    }
    return true;
  }

  /// @inheritdoc IVaultPermit
    function nonces(address owner) public view virtual override(IVaultPermit, Nonces) returns (uint256) {
      return super.nonces(owner);
  }

  /// @inheritdoc IVaultPermit
  function DOMAIN_SEPARATOR() external view returns (bytes32) {
      return _domainSeparatorV4();
  }

  /// @inheritdoc IVaultPermit
  function permitWithdraw(
    address owner,
    address receiver,
    uint256 amount,
    uint256 deadline,
    bytes32 actionArgsHash,
    uint8 v,
    bytes32 r,
    bytes32 s
  )
    public
    override
  {
    _checkDeadline(deadline);
    address operator = msg.sender;
    bytes32 structHash;
    // Scoped code to avoid "Stack too deep"
    {
      bytes memory data;
      uint256 currentNonce = _useNonce(owner);
      {
        data = abi.encode(
          PERMIT_WITHDRAW_TYPEHASH,
          owner,
          operator,
          receiver,
          amount,
          currentNonce,
          deadline,
          actionArgsHash
        );
      }
      structHash = keccak256(data);
    }

    _checkSigner(structHash, owner, v, r, s);

    _setWithdrawAllowance(owner, operator, receiver, amount);
  }

  /// Internal Functions

  /**
   * @dev Sets assets `amount` as the allowance of `operator` over the `owner`'s assets.
   * This internal function is equivalent to `approve`.
   * Requirements:
   * - Must only be used in `asset` withdrawal logic.
   * - Must check `owner` cannot be the zero address.
   * - Much check `operator` cannot be the zero address.
   * - Must emits an {WithdrawApproval} event.
   *
   * @param owner address who is providing `withdrawAllowance`
   * @param operator address who is allowed to operate the allowance
   * @param receiver address who can spend the allowance
   * @param amount of allowance
   *
   */
  function _setWithdrawAllowance(
    address owner,
    address operator,
    address receiver,
    uint256 amount
  )
    internal
  {
    if (owner == address(0) || operator == address(0) || receiver == address(0)) {
      revert VaultPermit__AddressZero();
    }
    _withdrawAllowance[owner][operator][receiver] = amount;
    emit WithdrawApproval(owner, operator, receiver, amount);
  }

  /**
   * @dev Spends `withdrawAllowance`.
   * Based on OZ {ERC20-spendAllowance} for {InterestVault-assets}.
   *
   * @param owner address who is spending `withdrawAllowance`
   * @param operator address who is allowed to operate the allowance
   * @param receiver address who can spend the allowance
   * @param amount of allowance
   */
  function _spendWithdrawAllowance(
    address owner,
    address operator,
    address receiver,
    uint256 amount
  )
    internal
  {
    uint256 currentAllowance = withdrawAllowance(owner, operator, receiver);
    if (currentAllowance != type(uint256).max) {
      if (amount > currentAllowance) {
        revert VaultPermit__InsufficientWithdrawAllowance();
      }
      unchecked {
        // Enforce to never leave unused allowance, unless allowance set to type(uint256).max
        _setWithdrawAllowance(owner, operator, receiver, 0);
      }
    }
  }

  /**
   * @dev Reverts if block.timestamp is expired according to `deadline`.
   *
   * @param deadline timestamp to check
   */
  function _checkDeadline(uint256 deadline) private view {
    if (block.timestamp > deadline) {
      revert VaultPermit__ExpiredDeadline();
    }
  }

  /**
   * @dev Reverts if `presumedOwner` is not signer of `structHash`.
   *
   * @param structHash of data
   * @param presumedOwner address to check
   * @param v signature value
   * @param r signature value
   * @param s signature value
   */
  function _checkSigner(
    bytes32 structHash,
    address presumedOwner,
    uint8 v,
    bytes32 r,
    bytes32 s
  )
    internal
    view
  {
    bytes32 digest = _hashTypedDataV4(structHash);
    address signer = digest.toEthSignedMessageHash().recover(v, r, s);
    if (signer != presumedOwner) {
      revert VaultPermit__InvalidSignature();
    }
  }
}
