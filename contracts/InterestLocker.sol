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
    error InterestLocker__InvalidDuration();
    error InterestLocker__TooSoonToUnlock();
    error InterestLocker__NotAuthorized();

    struct LockInfo {
        address token;
        uint256 amount;
        uint256 duration;
        uint256 unlockTime;
    }

    uint256 public constant MIN_DURATION = 30 days;

    uint256 public nextLockId;

    address[] internal _tokens;

    mapping(uint256 => LockInfo) public lockInfo; // lockId => lock info
    mapping(uint256 => address) private _beneficiaries; // lockId => beneficiary
    mapping(address => uint256) private _totalLocked; // token => total locked

    event TokensLocked(
        uint256 lockId,
        address user,
        address token,
        uint256 amount,
        uint256 duration
    );
    event TokensUnlocked(
        uint256 lockId,
        address user,
        address token,
        uint256 amount
    );
    event TokensChanged(address[] tokens);

    constructor(address[] memory initialTokens) {
        _setTokens(initialTokens);
    }

    function lockTokens(
        address token,
        uint256 amount,
        uint256 duration
    ) external {
        if (amount == 0) {
            revert InterestLocker__InvalidTokenAmount();
        }
        if (!_isValidToken(token)) {
            revert InterestLocker__TokenNotSupported();
        }
        if (duration < MIN_DURATION) {
            revert InterestLocker__InvalidDuration();
        }

        LockInfo memory userLock = LockInfo({
            token: token,
            amount: amount,
            duration: duration,
            unlockTime: block.timestamp + duration
        });

        uint256 newLockId = nextLockId;
        lockInfo[newLockId] = userLock;
        _beneficiaries[newLockId] = msg.sender;

        _totalLocked[token] += amount;

        nextLockId++;

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        emit TokensLocked(newLockId, msg.sender, token, amount, duration);
    }

    function unlockTokens(uint256 lockId) external {
        LockInfo memory userLock = lockInfo[lockId];

        address token = userLock.token;
        uint256 amount = userLock.amount;

        address beneficiary = _beneficiaries[lockId];

        if (msg.sender != beneficiary) {
            revert InterestLocker__NotAuthorized();
        }
        if (block.timestamp < userLock.unlockTime) {
            revert InterestLocker__TooSoonToUnlock();
        }

        delete lockInfo[lockId];
        delete _beneficiaries[lockId];

        _totalLocked[token] -= amount;

        IERC20(token).safeTransfer(beneficiary, amount);

        emit TokensUnlocked(lockId, beneficiary, token, amount);
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

    function getBeneficiary(uint256 lockId) external view returns (address) {
        return _beneficiaries[lockId];
    }

    function getTokens() external view returns (address[] memory) {
        return _tokens;
    }

    function getTotalLocked(address token) external view returns (uint256) {
        return _totalLocked[token];
    }
}
