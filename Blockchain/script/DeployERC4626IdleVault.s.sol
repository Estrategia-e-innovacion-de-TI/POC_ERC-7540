// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {IERC20Minimal} from "src/ERC4626/ERC4626Base.sol";
import {ERC4626IdleVault} from "src/ERC4626/ERC4626IdleVault.sol";

contract DeployERC4626IdleVault is Script {
    function run() external returns (ERC4626IdleVault vault) {
        address assetToken = vm.envAddress("ASSET_TOKEN");
        string memory vaultName = vm.envOr("VAULT_NAME", string("Vault Share"));
        string memory vaultSymbol = vm.envOr("VAULT_SYMBOL", string("VSH"));

        vm.startBroadcast();
        vault = new ERC4626IdleVault(IERC20Minimal(assetToken), vaultName, vaultSymbol);
        vm.stopBroadcast();

        console2.log("ERC4626IdleVault deployed at:", address(vault));
        console2.log("Asset token:", assetToken);
    }
}
