// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title ProviderManager
 *
 * @notice Contract that stores and returns address mappings
 * Required for getting contract addresses for some providers.
 */

import {RebAccessControl} from "../access/RebAccessControl.sol";
import {IProviderManager} from "../interfaces/IProviderManager.sol";

contract ProviderManager is IProviderManager, RebAccessControl {
  // provider name => key address => returned address
  // (e.g. Compound_V2 => public erc20 => Protocol token)
  mapping(string => mapping(address => address)) private _tokenToProtocolToken;
  // provider name => key1 address => key2 address => returned address
  // (e.g. Compound_V3 => collateral erc20 => borrow erc20 => Protocol market)
  mapping(string => mapping(address => mapping(address => address))) private _tokensToMarket;

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
    address tokenAddress
  )
    external
    view
    override
    returns (address)
  {
    return _tokenToProtocolToken[providerName][tokenAddress];
  }

  /// @inheritdoc IProviderManager
  function getProtocolMarket(
    string memory providerName,
    address collateralAsset,
    address debtAsset
  )
    external
    view
    override
    returns (address)
  {
    return _tokensToMarket[providerName][collateralAsset][debtAsset];
  }

  /// @inheritdoc IProviderManager
  function setProtocolToken(
    string memory providerName,
    address tokenAddress,
    address protocolToken
  )
    public
    override
    onlyAdmin
  {
    if (!_isProviderNameAdded[providerName]) {
      _isProviderNameAdded[providerName] = true;
      _providerNames.push(providerName);
    }
    _tokenToProtocolToken[providerName][tokenAddress] = protocolToken;
    address[] memory inputAddrs = new address[](1);
    inputAddrs[0] = tokenAddress;
    emit MappingChanged(inputAddrs, protocolToken);
  }

  /// @inheritdoc IProviderManager
  function setProtocolMarket(
    string memory providerName,
    address collateralAsset,
    address debtAsset,
    address market
  )
    public
    override
    onlyAdmin
  {
    if (!_isProviderNameAdded[providerName]) {
      _isProviderNameAdded[providerName] = true;
      _providerNames.push(providerName);
    }
    _tokensToMarket[providerName][collateralAsset][debtAsset] = market;
    address[] memory inputAddrs = new address[](2);
    inputAddrs[0] = collateralAsset;
    inputAddrs[1] = debtAsset;
    emit MappingChanged(inputAddrs, market);
  }
}
