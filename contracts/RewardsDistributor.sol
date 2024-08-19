// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {IRewardsDistributor} from "./interfaces/IRewardsDistributor.sol";
import {IERC20, SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title RewardsDistributor
 *
 * @notice This contract allows distributing different rewards to multiple accounts using a Merkle tree.
 *
 * @dev Inspired and modified from MerlinEgalite's universal rewards distributor:
 * https://github.com/MerlinEgalite/universal-rewards-distributor/blob/main/src/UniversalRewardsDistributor.sol.
 *
 */
contract RewardsDistributor is IRewardsDistributor, Ownable {
    using SafeERC20 for IERC20;

    /**
     * @dev Errors
     */
    error RewardsDistributor__InvalidProof();
    error RewardsDistributor__AlreadyClaimed();

    /**
     * @notice The merkle tree's root of the current rewards distribution.
     */
    bytes32 public root;

    /**
     * @notice The `amount` of `reward` token already claimed by `account`.
     */
    mapping(address account => mapping(address reward => uint256 amount))
        public claimed;

    /**
     * @inheritdoc IRewardsDistributor
     */
    function claim(
        address account,
        address reward,
        uint256 claimable,
        bytes32[] calldata proof
    ) external {
        if (
            !MerkleProof.verifyCalldata(
                proof,
                root,
                keccak256(
                    bytes.concat(
                        keccak256(abi.encode(account, reward, claimable))
                    )
                )
            )
        ) {
            revert RewardsDistributor__InvalidProof();
        }

        uint256 amount = claimable - claimed[account][reward];
        if (amount == 0) revert RewardsDistributor__AlreadyClaimed();

        claimed[account][reward] = claimable;

        IERC20(reward).safeTransfer(account, amount);
        emit RewardsClaimed(account, reward, amount);
    }

    /**
     * @inheritdoc IRewardsDistributor
     */
    function updateRoot(bytes32 _root) external onlyOwner {
        root = _root;
        emit RootUpdated(_root);
    }

    /**
     * @inheritdoc IRewardsDistributor
     */
    function withdraw(address token) external onlyOwner {
        uint256 amount = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransfer(msg.sender, amount);
    }
}
