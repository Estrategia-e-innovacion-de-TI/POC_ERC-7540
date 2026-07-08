// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {IERC20Minimal} from "../../src/ERC4626/ERC4626Base.sol";
import {ERC7540IdleVault} from "../../src/ERC7540/ERC7540IdleVault.sol";

contract ERC7540Harness is ERC7540IdleVault {
    constructor(IERC20Minimal _assetToken) ERC7540IdleVault(_assetToken, "Async Vault Share", "aVSH") {}
}
