// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2 <0.9.0;

import "../Base.sol";
import {Properties} from "../Properties.sol";

/// @notice Handles the interaction with ERC4626 vault
abstract contract CounterHandler is Properties {

    // ――――――――――――――――――――――――― Clamped ――――――――――――――――――――――――――

    function vault_deposit_clamped(uint256 assets) public {
        uint256 actorBalance = assetToken.balanceOf(actor);
        if (actorBalance == 0) return;

        assets = clampBetween(assets, 1, actorBalance);
        vault_deposit(assets);
    }

    function vault_mint_clamped(uint256 shares) public {
        uint256 maxShares = assetToken.balanceOf(actor);
        if (maxShares == 0) return;

        shares = clampBetween(shares, 1, maxShares);
        vault_mint(shares);
    }

    function vault_withdraw_clamped(uint256 assets) public {
        uint256 maxAssets = vault.maxWithdraw(actor);
        if (maxAssets == 0) return;

        assets = clampBetween(assets, 1, maxAssets);
        vault_withdraw(assets);
    }

    function vault_redeem_clamped(uint256 shares) public {
        uint256 maxShares = vault.maxRedeem(actor);
        if (maxShares == 0) return;

        shares = clampBetween(shares, 1, maxShares);
        vault_redeem(shares);
    }

    // ―――――――――――――――――――――――― Unclamped ―――――――――――――――――――――――――

    function vault_deposit(uint256 assets) public asActor {
        vault.deposit(assets, actor);
    }

    function vault_mint(uint256 shares) public asActor {
        vault.mint(shares, actor);
    }

    function vault_withdraw(uint256 assets) public asActor {
        vault.withdraw(assets, actor, actor);
    }

    function vault_redeem(uint256 shares) public asActor {
        vault.redeem(shares, actor, actor);
    }
}
