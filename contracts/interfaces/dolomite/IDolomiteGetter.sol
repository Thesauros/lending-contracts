// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {IDolomiteMargin} from "./IDolomiteMargin.sol";

/**
 * @title IDolomiteGetter
 *
 * @notice Defines the interface for the SafeGettersForDolomiteMargin contract.
 */
interface IDolomiteGetter {
    function getMarketSupplyInterestRateApr(
        address _token
    ) external view returns (IDolomiteMargin.InterestRate memory);
}
