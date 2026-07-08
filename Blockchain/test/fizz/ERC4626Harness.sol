// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {ERC4626Base, IERC20Minimal} from "../../src/ERC4626/ERC4626Base.sol";

contract ERC4626Harness is ERC4626Base {
    constructor(IERC20Minimal _assetToken) ERC4626Base(_assetToken, "Vault Share", "VSH") {}

    function totalAssets() public view override returns (uint256) {
        return assetToken.balanceOf(address(this));
    }
}