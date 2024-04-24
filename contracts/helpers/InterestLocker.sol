// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title InterestLocker
 *
 * @notice Contract to lock and unlock ERC20 tokens. Is intended for locking
 * rebalancer's interest tokens in exchange for points.
 */

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract InterestLocker is Ownable {
    using SafeERC20 for IERC20;

    error InterestLocker__InvalidTokenAmount();
    error InterestLocker__TokenNotSupported();
    error InterestLocker__AddressZero();
    error InterestLocker__NotEnoughLocked();

    address[] internal _tokens;

    mapping(address => mapping(address => uint256)) private _userLocks; // user => token => amount
    mapping(address => uint256) private _totalLocked; // token => total locked

    event TokensLocked(address user, address token, uint256 amount);
    event TokensUnlocked(address user, address token, uint256 amount);
    event TokensChanged(address[] tokens);

    constructor(address[] memory initialTokens) {
        _setTokens(initialTokens);
    }

    function lockTokens(address token, uint256 amount) external {
        if (amount == 0) {
            revert InterestLocker__InvalidTokenAmount();
        }
        if (!_isValidToken(token)) {
            revert InterestLocker__TokenNotSupported();
        }

        _userLocks[msg.sender][token] += amount;
        _totalLocked[token] += amount;

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        emit TokensLocked(msg.sender, token, amount);
    }

    function unlockTokens(address token, uint256 amount) external {
        if (amount == 0) {
            revert InterestLocker__InvalidTokenAmount();
        }
        if (_userLocks[msg.sender][token] < amount) {
            revert InterestLocker__NotEnoughLocked();
        }

        _userLocks[msg.sender][token] -= amount;
        _totalLocked[token] -= amount;

        IERC20(token).safeTransfer(msg.sender, amount);

        emit TokensUnlocked(msg.sender, token, amount);
    }

    function setTokens(address[] memory tokens) external onlyOwner {
        _setTokens(tokens);
    }

    function _setTokens(address[] memory tokens) internal {
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] == address(0)) {
                revert InterestLocker__AddressZero();
            }
        }

        _tokens = tokens;
        emit TokensChanged(_tokens);
    }

    function _isValidToken(address token) internal view returns (bool isValid) {
        for (uint i = 0; i < _tokens.length; i++) {
            if (_tokens[i] == token) {
                isValid = true;
            }
        }
    }

    function getTokens() external view returns (address[] memory) {
        return _tokens;
    }

    function getAccountLocked(
        address user,
        address token
    ) external view returns (uint256) {
        return _userLocks[user][token];
    }

    function getTotalLocked(address token) external view returns (uint256) {
        return _totalLocked[token];
    }
}
