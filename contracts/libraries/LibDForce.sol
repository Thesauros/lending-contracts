// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title LibDForce
 *
 * @notice This implementation is modifed from "./LibCompoundV2".
 * @notice Inspired and modified from Transmissions11 (https://github.com/transmissions11/libcompound).
 */

import {LibSolmateFixedPointMath} from "./LibSolmateFixedPointMath.sol";
import {IiToken} from "../interfaces/dforce/IiToken.sol";

library LibDForce {
    using LibSolmateFixedPointMath for uint256;

    /**
     * @dev Returns the current collateral balance of user.
     *
     * @param iToken IiToken DForce's iToken associated with the user's position
     * @param user address of the user
     */
    function viewUnderlyingBalanceOf(
        IiToken iToken,
        address user
    ) internal view returns (uint256) {
        return iToken.balanceOf(user).mulWadDown(viewExchangeRate(iToken));
    }

    /**
     * @dev Returns the current exchange rate for a given iToken.
     *
     * @param iToken IiToken DForce's iToken associated with the user's position
     */
    function viewExchangeRate(IiToken iToken) internal view returns (uint256) {
        uint256 accrualBlockNumberPrior = iToken.accrualBlockNumber();

        if (accrualBlockNumberPrior == block.number)
            return iToken.exchangeRateStored();

        uint256 totalCash = iToken.getCash();
        uint256 borrowsPrior = iToken.totalBorrows();
        uint256 reservesPrior = iToken.totalReserves();

        uint256 borrowRateMantissa = iToken.borrowRatePerBlock();

        // Same as borrowRateMaxMantissa in CTokenInterfaces.sol
        require(borrowRateMantissa <= 0.0005e16, "RATE_TOO_HIGH");
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
