// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title InterestLocker
 *
 * @notice Contract to lock and unlock ERC20 tokens. Is intended for locking
 * tokenized shares.
 */
contract InterestLocker is Ownable2Step {
    using SafeERC20 for IERC20;

    /**
     * @dev Errors
     */
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
        address indexed user,
        address indexed token,
        uint256 amount,
        uint256 duration
    );
    event TokensUnlocked(
        uint256 lockId,
        address indexed user,
        address indexed token,
        uint256 amount
    );
    event TokensChanged(address[] tokens);

    constructor(address[] memory initialTokens) {
        _setTokens(initialTokens);
    }

    /**
     * @notice Allows users to lock a specified amount of tokens for a given duration.
     *
     * @param token The address of token to be locked.
     * @param amount The amount of tokens to be locked.
     * @param duration The duration for which the tokens should be locked.
     *
     * @dev Requirements
     * - The amount must be greater than zero.
     * - The token must be supported.
     * - The duration must meet the minimum duration requirement.
     */
    function lockTokens(
        address token,
        uint256 amount,
        uint256 duration
    ) external {
        if (amount == 0) {
            revert InterestLocker__InvalidTokenAmount();
        }
        if (!_validateToken(token)) {
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

    /**
     * @notice Allows the beneficiary of locked tokens to unlock them after the lock duration has passed.
     * @param lockId The lockId of the lock to be unlocked.
     *
     * @dev Requirements
     * - The caller must be the beneficiary of the lock.
     * - The current time must be past the unlock time.
     */
    function unlockTokens(uint256 lockId) external {
        LockInfo memory userLock = lockInfo[lockId];
        address beneficiary = _beneficiaries[lockId];

        if (msg.sender != beneficiary) {
            revert InterestLocker__NotAuthorized();
        }

        address token = userLock.token;
        uint256 amount = userLock.amount;

        if (block.timestamp < userLock.unlockTime) {
            revert InterestLocker__TooSoonToUnlock();
        }

        delete lockInfo[lockId];
        delete _beneficiaries[lockId];

        _totalLocked[token] -= amount;

        IERC20(token).safeTransfer(beneficiary, amount);

        emit TokensUnlocked(lockId, beneficiary, token, amount);
    }

    /**
     * @notice Sets the tokens that can be locked by users.
     *
     * @param tokens The array of addresses to be allowed for locking.
     *
     * @dev Requirements:
     * - Must be called by the owner
     */
    function setTokens(address[] memory tokens) external onlyOwner {
        _setTokens(tokens);
    }

    /**
     * @notice Internal function to set the tokens that can be locked by users.
     *
     * @param tokens The array of addresses to be allowed for locking.
     *
     * @dev Requirements:
     * - `tokens` array must not contain address(0).
     */
    function _setTokens(address[] memory tokens) internal {
        for (uint256 i; i < tokens.length; i++) {
            if (tokens[i] == address(0)) {
                revert InterestLocker__AddressZero();
            }
        }

        _tokens = tokens;
        emit TokensChanged(_tokens);
    }

    /**
     * @notice Returns true if `token` is in `_tokens` array.
     *
     * @param token The address of token to be validated.
     */
    function _validateToken(
        address token
    ) internal view returns (bool isValid) {
        uint256 length = _tokens.length;
        for (uint256 i; i < length; i++) {
            if (_tokens[i] == token) {
                isValid = true;
                break;
            }
        }
    }

    /**
     * @notice Returns the beneficiary of a specific lock.
     */
    function getBeneficiary(uint256 lockId) public view returns (address) {
        return _beneficiaries[lockId];
    }

    /**
     * @notice Returns the list of tokens that can be locked.
     */
    function getTokens() public view returns (address[] memory) {
        return _tokens;
    }

    /**
     * @notice Returns the total amount of a specific token that is currently locked.
     */
    function getTotalLocked(address token) public view returns (uint256) {
        return _totalLocked[token];
    }
}
