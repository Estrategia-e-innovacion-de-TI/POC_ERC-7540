// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2 <0.9.0;

import {Snapshots} from "./Snapshots.sol";
import {PropertiesAsserts} from "./utils/PropertiesAsserts.sol";

/// @notice Contains the functions that check the properties (invariants)
abstract contract Properties is PropertiesAsserts, Snapshots {

    // ―――――――――――――――――――― Global properties ―――――――――――――――――――――
    // These properties must always hold after any function call.
    // They MUST BE PUBLIC so that fuzzers can find and call them.

    function property_totalAssetsMatchesTokenBalance() public returns (bool) {
        eq(vault.totalAssets(), assetToken.balanceOf(address(vault)), "vault totalAssets mismatch with token balance");
        return true;
    }

    function property_maxRedeemMatchesShareBalance() public returns (bool) {
        for (uint256 i; i < actors.length; i++) {
            address user = actors[i];
            eq(vault.maxRedeem(user), vault.balanceOf(user), "maxRedeem mismatch with share balance");
        }
        return true;
    }

    function property_maxWithdrawMatchesConversion() public returns (bool) {
        for (uint256 i; i < actors.length; i++) {
            address user = actors[i];
            eq(
                vault.maxWithdraw(user),
                vault.convertToAssets(vault.balanceOf(user)),
                "maxWithdraw mismatch with share conversion"
            );
        }
        return true;
    }

    function property_totalSupplyMatchesActorsAndEscrow() public returns (bool) {
        uint256 sumShares;
        for (uint256 i; i < actors.length; i++) {
            sumShares += vault.balanceOf(actors[i]);
        }
        sumShares += vault.balanceOf(address(vault));

        eq(vault.totalSupply(), sumShares, "totalSupply mismatch with actors + escrow shares");
        return true;
    }

    function property_requestIdsMatchGhostCounter() public returns (bool) {
        eq(vault.nextRequestId(), ghosts.createdRequests, "nextRequestId mismatch with created requests ghost");
        return true;
    }

    // ――――――――――――――――――― Specific properties ――――――――――――――――――――
    // These properties must hold after specific function calls.
    // They MUST BE INTERNAL and called at the end of the relevant handlers.
}
