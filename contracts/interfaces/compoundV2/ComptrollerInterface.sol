// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title ComptrollerInterface
 *
 * @notice Interface to interact with CompoundV2
 * comptroller.
 * This interface has been reduced from the CompoundV2 interface.
 */
interface ComptrollerInterface {
  function enterMarkets(address[] calldata) external returns (uint256[] memory);

  function exitMarket(address cyTokenAddress) external returns (uint256);

  function claimComp(address holder) external;
}
