// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

/// @title IERC7540
/// @notice Interfaz minima para vaults asincronas basadas en ERC-7540.
interface IERC7540 {
    event DepositRequest(
        uint256 indexed requestId,
        address indexed controller,
        address indexed owner,
        uint256 assets
    );

    event RedeemRequest(
        uint256 indexed requestId,
        address indexed controller,
        address indexed owner,
        uint256 shares
    );

    event DepositClaimed(uint256 indexed requestId, address indexed receiver, uint256 shares);
    event RedeemClaimed(uint256 indexed requestId, address indexed receiver, uint256 assets);

    /// @notice Crea una solicitud asincrona para depositar activos.
    function requestDeposit(uint256 assets, address controller, address owner) external returns (uint256 requestId);

    /// @notice Crea una solicitud asincrona para redimir shares.
    function requestRedeem(uint256 shares, address controller, address owner) external returns (uint256 requestId);

    /// @notice Reclama una solicitud de deposito ya procesable.
    function claimDeposit(uint256 requestId, address receiver) external returns (uint256 shares);

    /// @notice Reclama una solicitud de redencion ya procesable.
    function claimRedeem(uint256 requestId, address receiver) external returns (uint256 assets);

    /// @notice Obtiene el estado de una solicitud de deposito.
    function pendingDepositRequest(uint256 requestId)
        external
        view
        returns (address owner, address controller, uint256 assets, bool claimed);

    /// @notice Obtiene el estado de una solicitud de redencion.
    function pendingRedeemRequest(uint256 requestId)
        external
        view
        returns (address owner, address controller, uint256 shares, bool claimed);
}
