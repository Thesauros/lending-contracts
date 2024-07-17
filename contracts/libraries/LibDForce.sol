// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {LibSolmateFixedPointMath} from "./LibSolmateFixedPointMath.sol";
import {IiToken} from "../interfaces/dforce/IiToken.sol";

/**
 * @title LibDForce
 *
 * @notice Library for computing the latest state (interest accrual) without direct state changes on DForce.
 *
 * @dev Inspired and modified from Transmissions11 (https://github.com/transmissions11/libcompound).
 */
library LibDForce {
    using LibSolmateFixedPointMath for uint256;

    /**
     * @dev Errors
     */
    error LibDForce__RateTooHigh();

    /**
     * @dev Returns the current collateral balance of a user.
     * @param iToken DForce's iToken associated with the user's position.
     * @param user The address of the user.
     */
    function viewUnderlyingBalanceOf(
        IiToken iToken,
        address user
    ) internal view returns (uint256) {
        return iToken.balanceOf(user).mulWadDown(viewExchangeRate(iToken));
    }

    /**
     * @dev Returns the current exchange rate for a given iToken.
     * @param iToken DForce's iToken associated with the user's position.
     */
    function viewExchangeRate(IiToken iToken) internal view returns (uint256) {
        uint256 accrualBlockNumberPrior = iToken.accrualBlockNumber();

        if (accrualBlockNumberPrior == block.number)
            return iToken.exchangeRateStored();

        uint256 totalCash = iToken.getCash();
        uint256 borrowsPrior = iToken.totalBorrows();
        uint256 reservesPrior = iToken.totalReserves();

        uint256 borrowRateMantissa = iToken.borrowRatePerBlock();

        // Same as maxBorrowRate in TokenStorage.sol
        if (borrowRateMantissa > 0.001e18) {
            revert LibDForce__RateTooHigh();
        }

        uint256 interestAccumulated = (borrowRateMantissa *
            (block.number - accrualBlockNumberPrior)).mulWadDown(borrowsPrior);

        uint256 totalReserves = iToken.reserveRatio().mulWadDown(
            interestAccumulated
        ) + reservesPrior;
        uint256 totalBorrows = interestAccumulated + borrowsPrior;
        uint256 totalSupply = iToken.totalSupply();

        // Reverts if totalSupply == 0
        return
            (totalCash + totalBorrows - totalReserves).divWadDown(totalSupply);
    }
}
