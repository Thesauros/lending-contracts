// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title ProviderManager
 *
 * @notice Contract that stores and returns address mappings
 * Required for getting contract addresses for some providers.
 */

import {ProtocolAccessControl} from "../access/ProtocolAccessControl.sol";
import {IProviderManager} from "../interfaces/IProviderManager.sol";

contract ProviderManager is IProviderManager, ProtocolAccessControl {
    // provider name => key address => returned address
    // (e.g. Compound_V2 => public erc20 => protocol token)
    mapping(string => mapping(address => address))
        private _assetToProtocolToken;
    // provider name => key1 address => key2 address => returned address
    // (e.g. Compound_V3 => collateral erc20 => borrow erc20 => protocol market)
    mapping(string => mapping(address => mapping(address => address)))
        private _assetsToMarket;

    string[] private _providerNames;

    mapping(string => bool) private _isProviderNameAdded;

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @notice Returns a list of all the providers.
     */
    function getProviders() public view returns (string[] memory) {
        return _providerNames;
    }

    /// @inheritdoc IProviderManager
    function getProtocolToken(
        string memory providerName,
        address asset
    ) external view override returns (address) {
        return _assetToProtocolToken[providerName][asset];
    }

    /// @inheritdoc IProviderManager
    function getProtocolMarket(
        string memory providerName,
        address collateralAsset,
        address debtAsset
    ) external view override returns (address) {
        return _assetsToMarket[providerName][collateralAsset][debtAsset];
    }

    /// @inheritdoc IProviderManager
    function setProtocolToken(
        string memory providerName,
        address asset,
        address protocolToken
    ) public override onlyAdmin {
        if (!_isProviderNameAdded[providerName]) {
            _isProviderNameAdded[providerName] = true;
            _providerNames.push(providerName);
        }
        _assetToProtocolToken[providerName][asset] = protocolToken;
        emit ProtocolTokenChanged(providerName, asset, protocolToken);
    }

    /// @inheritdoc IProviderManager
    function setProtocolMarket(
        string memory providerName,
        address collateralAsset,
        address debtAsset,
        address market
    ) public override onlyAdmin {
        if (!_isProviderNameAdded[providerName]) {
            _isProviderNameAdded[providerName] = true;
            _providerNames.push(providerName);
        }
        _assetsToMarket[providerName][collateralAsset][debtAsset] = market;
        emit ProtocolMarketChanged(
            providerName,
            collateralAsset,
            debtAsset,
            market
        );
    }
}
