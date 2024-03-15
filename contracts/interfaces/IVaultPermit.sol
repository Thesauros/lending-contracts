// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title IVaultPermit
 *
 * @notice Defines the interface for a vault extended with
 * signed permit operations for `withdraw()` allowance.
 */

interface IVaultPermit {
  /**
   * @dev Emitted when `asset` withdraw allowance is set.
   *
   * @param owner who provides allowance
   * @param operator who can execute the use of the allowance
   * @param receiver who can spend the allowance
   * @param amount of allowance given
   */
  event WithdrawApproval(address indexed owner, address operator, address receiver, uint256 amount);

  /**
   * @notice Returns the current amount of withdraw allowance from `owner` to `receiver` that
   * can be executed by `operator`. This is similar to {IERC20-allowance} for BaseVault assets,
   * instead of token-shares.
   *
   * @param owner who provides allowance
   * @param operator who can execute the use of the allowance
   * @param receiver who can spend the allowance
   *
   * @dev Requirements:
   * - Must replace {IERC4626-allowance} in a vault implementation.
   */
  function withdrawAllowance(
    address owner,
    address operator,
    address receiver
  )
    external
    view
    returns (uint256);

  /**
   * @dev Atomically increases the `withdrawAllowance` granted to `receiver` and
   * executable by `operator` by the caller. Based on OZ {ERC20-increaseAllowance} for assets.
   *
   * @param operator who can execute the use of the allowance
   * @param receiver who can spend the allowance
   * @param byAmount to increase withdraw allowance
   *
   * @dev Requirements:
   * - Must emit a {WithdrawApproval} event indicating the updated withdraw allowance.
   * - Must check `operator` and `receiver are not zero address.
   */
  function increaseWithdrawAllowance(
    address operator,
    address receiver,
    uint256 byAmount
  )
    external
    returns (bool);

  /**
   * @dev Atomically decreases the `withdrawAllowance` granted to `receiver` and
   * executable by `operator` by the caller. Based on OZ {ERC20-decreaseAllowance} for assets.
   *
   * @param operator who can execute the use of the allowance
   * @param receiver who can spend the allowance
   * @param byAmount to decrease withdraw allowance
   *
   * @dev Requirements:
   * - Must emit a {WithdrawApproval} event indicating the updated withdraw allowance.
   * - Must check `operator` and `receiver` are not zero address.
   * - Must check `operator` and `receiver` have `borrowAllowance` of at least `byAmount`.
   *
   */
  function decreaseWithdrawAllowance(
    address operator,
    address receiver,
    uint256 byAmount
  )
    external
    returns (bool);

  /**
   * @notice Sets `amount` as the `withdrawAllowance` of `receiver` executable by
   * caller over `owner`'s tokens, given the `owner`'s signed approval.
   * Inspired by {IERC20Permit-permit} for assets.
   *
   * @param owner providing allowance
   * @param receiver who can spend the allowance
   * @param amount of allowance
   * @param deadline timestamp limit for the execution of signed permit
   * @param actionArgsHash keccak256 of the abi.encoded(args,actions) to be performed.
   * @param v signature value
   * @param r signature value
   * @param s signature value
   *
   * @dev Requirements:
   * - Must check `deadline` is a timestamp in the future.
   * - Must check `receiver` is a non-zero address.
   * - Must check that `v`, `r` and `s` are valid `secp256k1` signature for `owner`
   *   over EIP712-formatted function arguments.
   * - Must check the signature used `owner`'s current nonce (see {nonces}).
   * - Must emits an {AssetsApproval} event.
   */
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
    external;

  /**
   * @notice Returns the curent used nonces for permits of `owner`.
   * Based on OZ {IERC20Permit-nonces}.
   *
   * @param owner address to check nonces
   */
  function nonces(address owner) external view returns (uint256);

  /// @dev Based on {IERC20Permit-DOMAIN_SEPARATOR}.
  // solhint-disable-next-line func-name-mixedcase
  function DOMAIN_SEPARATOR() external returns (bytes32);
    
}
