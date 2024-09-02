// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title IRewardsDistributor
 *
 * @notice Defines the interface for the RewardsDistributor contract.
 */
interface IRewardsDistributor {
    /**
     * @notice Emitted when the merkle tree's root is updated.
     * @param newRoot The updated merkle tree's root.
     */
    event RootUpdated(bytes32 newRoot);

    /**
     * @notice Emitted when rewards are claimed.
     * @param account The address for which rewards are claimed.
     * @param reward The address of the reward token.
     * @param amount The amount of reward tokens claimed.
     */
    event RewardsClaimed(address account, address reward, uint256 amount);

    /**
     * @notice Updates the merkle tree's root.
     * @param newRoot The new root of the merkle tree.
     */
    function updateRoot(bytes32 newRoot) external;

    /**
     * @notice Withdraws the entire balance of the specified token from this contract to the owner's address.
     * @param token The address of the token to be withdrawn.
     */
    function withdraw(address token) external;

    /**
     * @notice Claims rewards for a specified account.
     * @param account The address of the account claiming rewards.
     * @param reward The address of the reward token.
     * @param claimable The total claimable amount of the reward token.
     * @param proof The merkle proof used to validate the claim.
     */
    function claim(
        address account,
        address reward,
        uint256 claimable,
        bytes32[] calldata proof
    ) external;
}
