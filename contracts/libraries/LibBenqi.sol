// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {LibSolmateFixedPointMath} from "./LibSolmateFixedPointMath.sol";
import {IQiToken} from "../interfaces/benqi/IQiToken.sol";

/**
 * @title LibBenqi
 *
 * @notice Library for computing the latest state (interest accrual) without direct state changes on Benqi.
 *
 * @dev Inspired and modified from Transmissions11 (https://github.com/transmissions11/libcompound).
 */
library LibBenqi {
    using LibSolmateFixedPointMath for uint256;

    /**
     * @dev Errors
     */
    error LibBenqi__RateTooHigh();

    /**
     * @dev Returns the current collateral balance of a user.
     * @param qiToken The Benqi's qiToken associated with the user's position.
     * @param user The address of the user.
     */
    function viewUnderlyingBalanceOf(
        IQiToken qiToken,
        address user
    ) internal view returns (uint256) {
        return qiToken.balanceOf(user).mulWadDown(viewExchangeRate(qiToken));
    }

    /**
     * @dev Returns the current exchange rate for a given qiToken.
     * @param qiToken The Benqi's qiToken associated with the user's position.
     */
    function viewExchangeRate(
        IQiToken qiToken
    ) internal view returns (uint256) {
        uint256 accrualBlockTimestampPrior = qiToken.accrualBlockTimestamp();

        if (accrualBlockTimestampPrior == getBlockTimestamp())
            return qiToken.exchangeRateStored();

        uint256 totalCash = qiToken.getCash();
        uint256 borrowsPrior = qiToken.totalBorrows();
        uint256 reservesPrior = qiToken.totalReserves();

        uint256 borrowRateMantissa = qiToken.borrowRatePerTimestamp();

        // Same as borrowRateMaxMantissa in QiTokenInterfaces.sol
        if (borrowRateMantissa > 0.0005e16) {
            revert LibBenqi__RateTooHigh();
        }

        uint256 interestAccumulated = (borrowRateMantissa *
            (getBlockTimestamp() - accrualBlockTimestampPrior)).mulWadDown(
                borrowsPrior
            );

        uint256 totalReserves = qiToken.reserveFactorMantissa().mulWadDown(
            interestAccumulated
        ) + reservesPrior;
        uint256 totalBorrows = interestAccumulated + borrowsPrior;
        uint256 totalSupply = qiToken.totalSupply();

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
