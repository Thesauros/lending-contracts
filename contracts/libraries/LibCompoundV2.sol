// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title LibCompoundV2
 *
 * @notice This library implements workaround methods to compute
 * the latest state (of interest accrual) without having to call
 * change state methods directly on Compound.
 *
 * @dev Inspired and modified from Transmissions11
 * (https://github.com/transmissions11/libcompound)
 */

import {LibSolmateFixedPointMath} from "./LibSolmateFixedPointMath.sol";
import {ICToken} from "../interfaces/compoundV2/ICToken.sol";

library LibCompoundV2 {
    using LibSolmateFixedPointMath for uint256;

    /**
     * @dev Errors
     */
    error LibCompoundV2__RateTooHigh();

    /**
     * @dev Returns the current collateral balance of user.
     *
     * @param cToken {ICToken} compound's cToken associated with the user's position
     * @param user address of the user
     */
    function viewUnderlyingBalanceOf(
        ICToken cToken,
        address user
    ) internal view returns (uint256) {
        return cToken.balanceOf(user).mulWadDown(viewExchangeRate(cToken));
    }

    /**
     * @dev Returns the current exchange rate for a given cToken.
     *
     * @param cToken {ICToken} compound's cToken associated with the user's position
     */
    function viewExchangeRate(ICToken cToken) internal view returns (uint256) {
        uint256 accrualBlockNumberPrior = cToken.accrualBlockNumber();

        if (accrualBlockNumberPrior == block.number)
            return cToken.exchangeRateStored();

        uint256 totalCash = cToken.getCash();
        uint256 borrowsPrior = cToken.totalBorrows();
        uint256 reservesPrior = cToken.totalReserves();

        uint256 borrowRateMantissa = cToken.borrowRatePerBlock();

        // Same as borrowRateMaxMantissa in ICTokenInterfaces.sol
        if (borrowRateMantissa > 0.0005e16) {
            revert LibCompoundV2__RateTooHigh();
        }

        uint256 interestAccumulated = (borrowRateMantissa *
            (block.number - accrualBlockNumberPrior)).mulWadDown(borrowsPrior);

        uint256 totalReserves = cToken.reserveFactorMantissa().mulWadDown(
            interestAccumulated
        ) + reservesPrior;
        uint256 totalBorrows = interestAccumulated + borrowsPrior;
        uint256 totalSupply = cToken.totalSupply();

        // Reverts if totalSupply == 0
        return
            (totalCash + totalBorrows - totalReserves).divWadDown(totalSupply);
    }
}
