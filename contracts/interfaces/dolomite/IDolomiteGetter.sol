// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title IDolomiteGetter
 *
 * @notice Defines the interface for the SafeGettersForDolomiteMargin contract.
 */
import {IDolomiteMargin} from "./IDolomiteMargin.sol";

interface IDolomiteGetter {
    function getMarketSupplyInterestRateApr(
        address _token
    ) external view returns (IDolomiteMargin.InterestRate memory);
}
