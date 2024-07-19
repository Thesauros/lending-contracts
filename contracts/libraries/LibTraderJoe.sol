// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {LibSolmateFixedPointMath} from "./LibSolmateFixedPointMath.sol";
import {IJToken} from "../interfaces/traderjoe/IJToken.sol";

/**
 * @title LibTraderJoe
 *
 * @notice Library for computing the latest state (interest accrual) without direct state changes on Trader Joe.
 *
 * @dev Inspired and modified from Transmissions11 (https://github.com/transmissions11/libcompound).
 */
library LibTraderJoe {
    using LibSolmateFixedPointMath for uint256;

    /**
     * @dev Errors
     */
    error LibTraderJoe__RateTooHigh();

    /**
     * @dev Returns the current collateral balance of a user.
     * @param jToken Trader Joe's jToken associated with the user's position.
     * @param user The address of the user.
     */
    function viewUnderlyingBalanceOf(
        IJToken jToken,
        address user
    ) internal view returns (uint256) {
        return jToken.balanceOf(user).mulWadDown(viewExchangeRate(jToken));
    }

    /**
     * @dev Returns the current exchange rate for a given jToken.
     * @param jToken Trader Joe's jToken associated with the user's position.
     */
    function viewExchangeRate(IJToken jToken) internal view returns (uint256) {
        uint256 accrualBlockTimestampPrior = jToken.accrualBlockTimestamp();

        if (accrualBlockTimestampPrior == getBlockTimestamp())
            return jToken.exchangeRateStored();

        uint256 totalCash = jToken.getCash();
        uint256 borrowsPrior = jToken.totalBorrows();
        uint256 reservesPrior = jToken.totalReserves();

        uint256 borrowRateMantissa = jToken.borrowRatePerSecond();

        // Same as borrowRateMaxMantissa in JTokenInterfaces.sol
        if (borrowRateMantissa > 0.0005e16) {
            revert LibTraderJoe__RateTooHigh();
        }

        uint256 interestAccumulated = (borrowRateMantissa *
            (getBlockTimestamp() - accrualBlockTimestampPrior)).mulWadDown(
                borrowsPrior
            );

        uint256 totalReserves = jToken.reserveFactorMantissa().mulWadDown(
            interestAccumulated
        ) + reservesPrior;
        uint256 totalBorrows = interestAccumulated + borrowsPrior;
        uint256 totalSupply = jToken.totalSupply();

        // Reverts if totalSupply == 0
        return
            (totalCash + totalBorrows - totalReserves).divWadDown(totalSupply);
    }

    /**
     * @dev Retrieves the current block timestamp.
     */
    function getBlockTimestamp() internal view returns (uint256) {
        return block.timestamp;
    }
}
