// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {ERC4626Base, IERC20Minimal} from "./ERC4626Base.sol";

/// @title ERC4626IdleVault
/// @notice Implementacion minima de ERC4626Base que valua solo activos idle.
contract ERC4626IdleVault is ERC4626Base {
    constructor(IERC20Minimal _assetToken, string memory _name, string memory _symbol)
        ERC4626Base(_assetToken, _name, _symbol)
    {}

    /// @notice Total de activos gestionados por la vault.
    /// @dev En este ejemplo minimo, solo considera balance local del asset.
    function totalAssets() public view override returns (uint256) {
        return assetToken.balanceOf(address(this));
    }
}
