// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {IERC20Minimal} from "src/ERC4626/ERC4626Base.sol";
import {ERC7540IdleVault} from "src/ERC7540/ERC7540IdleVault.sol";

contract DeployERC7540IdleVault is Script {
    function run() external returns (ERC7540IdleVault vault) {
        address assetToken = vm.envAddress("ASSET_TOKEN");
        string memory vaultName = vm.envOr("VAULT_NAME", string("Async Vault Share"));
        string memory vaultSymbol = vm.envOr("VAULT_SYMBOL", string("aVSH"));

        vm.startBroadcast();
        vault = new ERC7540IdleVault(IERC20Minimal(assetToken), vaultName, vaultSymbol);
        vm.stopBroadcast();

        console2.log("ERC7540IdleVault deployed at:", address(vault));
        console2.log("Asset token:", assetToken);
    }
}
