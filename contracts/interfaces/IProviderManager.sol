// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title IProviderManager
 *
 * @notice Defines the interface for the ProviderManager contract
 */

interface IProviderManager {
    /**
     * @dev Emitted when the protocol token is changed.
     *
     * @param providerName The name of the provider.
     * @param asset The address of the asset.
     * @param protocolToken The address of the new protocol token.
     */
    event ProtocolTokenChanged(
        string providerName,
        address asset,
        address protocolToken
    );

    /**
     * @dev Emitted when the protocol market is changed.
     *
     * @param providerName The name of the provider.
     * @param collateralAsset The address of the collateral asset.
     * @param debtAsset The address of the debt asset.
     * @param protocolMarket The address of the new protocol market.
     */
    event ProtocolMarketChanged(
        string providerName,
        address collateralAsset,
        address debtAsset,
        address protocolMarket
    );

    /**
     * @notice Returns the address of the underlying token associated with the `keyAddr` for the given `providerName`.
     *
     * @param providerName The name of the provider.
     * @param keyAddr The address of the token associated with the underlying token.
     */
    function getProtocolToken(
        string memory providerName,
        address keyAddr
    ) external view returns (address underlyingToken);

    /**
     * @notice Returns the address of the underlying token associated with both `keyAddr1` and `keyAddr2` tokens for the given `providerName`.
     *
     * @param providerName The name of the provider.
     * @param keyAddr1 The address of the first token associated with the underlying token.
     * @param keyAddr2 The address of the second token associated with the underlying token.
     */
    function getProtocolMarket(
        string memory providerName,
        address keyAddr1,
        address keyAddr2
    ) external view returns (address underlyingToken);

    /**
     * @notice Sets the mapping of the `underlyingToken` associated with the `providerName` and the token `keyAddr`.
     *
     * @param providerName The name of the provider.
     * @param keyAddr The address of the token associated with the underlying token.
     * @param underlyingToken The address of the underlying token to be returned by `getProtocolToken`.
     */
    function setProtocolToken(
        string memory providerName,
        address keyAddr,
        address underlyingToken
    ) external;

    /**
     * @notice Sets the mapping of the `underlyingToken` associated with the `providerName` and both `keyAddr1` and `keyAddr2` tokens.
     *
     * @param providerName The name of the provider.
     * @param keyAddr1 The address of the first token.
     * @param keyAddr2 The address of the second token.
     * @param underlyingToken The address of the underlying token to be returned by `getProtocolMarket`.
     */
    function setProtocolMarket(
        string memory providerName,
        address keyAddr1,
        address keyAddr2,
        address underlyingToken
    ) external;
}
