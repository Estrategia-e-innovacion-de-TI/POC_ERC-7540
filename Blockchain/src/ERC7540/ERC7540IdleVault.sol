// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {IERC20Minimal} from "../ERC4626/ERC4626Base.sol";
import {ERC7540AsyncVault} from "./ERC7540AsyncVault.sol";

/// @title ERC7540IdleVault
/// @notice Implementacion minima de ERC7540AsyncVault que valua solo activos idle.
contract ERC7540IdleVault is ERC7540AsyncVault {
    constructor(IERC20Minimal _assetToken, string memory _name, string memory _symbol)
        ERC7540AsyncVault(_assetToken, _name, _symbol)
    {}

    /// @notice Total de activos gestionados por la vault.
    /// @dev En este ejemplo minimo, solo considera balance local del asset.
    function totalAssets() public view override returns (uint256) {
        return assetToken.balanceOf(address(this));
    }
}
