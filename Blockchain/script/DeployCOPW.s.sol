// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {COPW} from "src/mocks/COPW.sol";

contract DeployCOPW is Script {
    function run() external returns (COPW token) {
        vm.startBroadcast();
        token = new COPW();
        vm.stopBroadcast();

        console2.log("COPW deployed at:", address(token));
    }
}
