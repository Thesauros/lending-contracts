// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title IProviderManager
 *
 * @notice Defines interface for {ProviderManager} mapping operations.
 */

interface IProviderManager {
    /**
     * @dev Emit when the protocol token is changed
     *
     */
    event ProtocolTokenChanged(
        string providerName,
        address asset,
        address protocolToken
    );

    /**
     * @dev Emit when the protocol market is changed
     *
     */
    event ProtocolMarketChanged(
        string providerName,
        address collateralAsset,
        address debtAsset,
        address protocolMarket
    );

    /**
     * @notice Returns the address of the underlying token associated with the `keyAddr` for the providerName protocol.
     *
     * @param providerName string name of the provider
     * @param keyAddr address of the token associated with the underlying token
     */
    function getProtocolToken(
        string memory providerName,
        address keyAddr
    ) external view returns (address underlyingToken);

    /**
     * @notice Returns the address of the underlying token associated with both `keyAddr1` and `keyAddr2` tokens.
     *
     * @param providerName string name of the provider
     * @param keyAddr1 address of the token associated with the underlying token
     * @param keyAddr2 address of the token associated with the underlying token
     */
    function getProtocolMarket(
        string memory providerName,
        address keyAddr1,
        address keyAddr2
    ) external view returns (address underlyingToken);

    /**
     * @notice Sets the mapping of the underlying `returnedAddr` token associated with the `providerName` and the token `keyAddr`.
     *
     * @param providerName string name of the provider
     * @param keyAddr address of the token associated with the underlying token
     * @param underlyingAddr address of the underlying token to be returned by the {IProviderManager-getProtocolToken}
     */
    function setProtocolToken(
        string memory providerName,
        address keyAddr,
        address underlyingAddr
    ) external;

    /**
     * @notice Sets the mapping associated with the `providerName` and both `keyAddr1` and `keyAddr2` tokens.
     *
     * @param providerName string name of the provider
     * @param keyAddr1 address of the token
     * @param keyAddr2 address of the token
     * @param underlyingAddr address of the underlying token to be returned by the {IProviderManager-getProtocolMarket}
     */
    function setProtocolMarket(
        string memory providerName,
        address keyAddr1,
        address keyAddr2,
        address underlyingAddr
    ) external;
}
