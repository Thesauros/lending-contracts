// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {IProviderManager} from "../interfaces/IProviderManager.sol";
import {AccessManager} from "../access/AccessManager.sol";

/**
 * @title ProviderManager
 */
contract ProviderManager is IProviderManager, AccessManager {
    // identifier => asset address => yield token address
    mapping(string => mapping(address => address)) private _assetToYieldToken;

    // identifier => asset1 address => asset2 address => market address
    mapping(string => mapping(address => mapping(address => address)))
        private _assetsToMarket;

    mapping(string => bool) private _identifierRegistered;

    string[] private _providerIdentifiers;

    /**
     * @inheritdoc IProviderManager
     */
    function setYieldToken(
        string memory identifier,
        address asset,
        address yieldToken
    ) public override onlyAdmin {
        if (!_identifierRegistered[identifier]) {
            _identifierRegistered[identifier] = true;
            _providerIdentifiers.push(identifier);
        }
        _assetToYieldToken[identifier][asset] = yieldToken;
        emit YieldTokenUpdated(identifier, asset, yieldToken);
    }

    /**
     * @inheritdoc IProviderManager
     */
    function setMarket(
        string memory identifier,
        address assetOne,
        address assetTwo,
        address market
    ) public override onlyAdmin {
        if (!_identifierRegistered[identifier]) {
            _identifierRegistered[identifier] = true;
            _providerIdentifiers.push(identifier);
        }
        _assetsToMarket[identifier][assetOne][assetTwo] = market;
        emit MarketUpdated(identifier, assetOne, assetTwo, market);
    }

    /**
     * @inheritdoc IProviderManager
     */
    function getYieldToken(
        string memory identifier,
        address asset
    ) external view override returns (address) {
        return _assetToYieldToken[identifier][asset];
    }

    /**
     * @inheritdoc IProviderManager
     */
    function getMarket(
        string memory identifier,
        address assetOne,
        address assetTwo
    ) external view override returns (address) {
        return _assetsToMarket[identifier][assetOne][assetTwo];
    }

    /**
     * @notice Returns the list of all the provider identifiers.
     */
    function getIdentifiers() public view returns (string[] memory) {
        return _providerIdentifiers;
    }
}
