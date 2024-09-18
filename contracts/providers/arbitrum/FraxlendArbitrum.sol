// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IFraxlendPair} from "../../interfaces/fraxlend/IFraxlendPair.sol";
import {IInterestVault} from "../../interfaces/IInterestVault.sol";
import {IProvider} from "../../interfaces/IProvider.sol";

/**
 * @title FraxlendArbitrum
 *
 * @notice This contract allows interaction with Fraxlend on Arbitrum.
 */
contract FraxlendArbitrum is IProvider {
    /**
     * @inheritdoc IProvider
     */
    function deposit(
        uint256 amount,
        IInterestVault vault
    ) external override returns (bool success) {
        IFraxlendPair fraxlend = _getPair();
        fraxlend.deposit(amount, address(vault));
        success = true;
    }

    /**
     * @inheritdoc IProvider
     */
    function withdraw(
        uint256 amount,
        IInterestVault vault
    ) external override returns (bool success) {
        IFraxlendPair fraxlend = _getPair();
        fraxlend.withdraw(amount, address(vault), address(vault));
        success = true;
    }

    /**
     * @dev Returns the {IFraxlendPair} pair to interact with Fraxlend.
     */
    function _getPair() internal pure returns (IFraxlendPair) {
        return IFraxlendPair(0x9168AC3a83A31bd85c93F4429a84c05db2CaEF08);
    }

    /**
     * @inheritdoc IProvider
     */
    function getDepositBalance(
        address user,
        IInterestVault
    ) external view override returns (uint256 balance) {
        IFraxlendPair fraxlend = _getPair();
        uint256 shares = fraxlend.balanceOf(user);
        balance = fraxlend.toAssetAmount(shares, false, true);
    }

    /**
     * @inheritdoc IProvider
     */
    function getDepositRateFor(
        IInterestVault
    ) external view override returns (uint256 rate) {
        IFraxlendPair fraxlend = _getPair();
        (, , , uint64 ratePerSec, ) = fraxlend.currentRateInfo();
        (uint128 totalAssets, , uint128 totalBorrows, , ) = fraxlend
            .getPairAccounting();
        // 31536000 seconds in a `year` = 60 * 60 * 24 * 365.
        uint256 borrowRate = uint256(ratePerSec) * 31536000;

        uint256 utilizationRate = (uint256(totalBorrows) * 1e18) /
            uint256(totalAssets);
        // Scaled to return ray(1e27) per IProvider specs.
        rate = (utilizationRate * borrowRate) / 1e9;
    }

    /**
     * @inheritdoc IProvider
     */
    function getOperator(
        address,
        address,
        address
    ) external pure override returns (address operator) {
        operator = address(_getPair());
    }

    /**
     * @inheritdoc IProvider
     */
    function getProviderName() public pure override returns (string memory) {
        return "Fraxlend_Arbitrum";
    }
}
