// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title IShareToken
 *
 * @notice Interface to interact with Silo share token contract
 */

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface IShareToken is IERC20Metadata {
    /// @notice Mint method for Silo to create debt position
    /// @param _account wallet for which to mint token
    /// @param _amount amount of token to be minted
    function mint(address _account, uint256 _amount) external;

    /// @notice Burn method for Silo to close debt position
    /// @param _account wallet for which to burn token
    /// @param _amount amount of token to be burned
    function burn(address _account, uint256 _amount) external;
}
