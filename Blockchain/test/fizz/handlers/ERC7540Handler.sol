// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2 <0.9.0;

import {Properties} from "../Properties.sol";

/// @notice Handles async ERC7540 flows (request/claim deposit and redeem)
abstract contract ERC7540Handler is Properties {
    mapping(address => uint256[]) internal pendingDepositRequests;
    mapping(address => uint256[]) internal pendingRedeemRequests;

    // ――――――――――――――――――――――――― Clamped ――――――――――――――――――――――――――

    function vault_requestDeposit_clamped(uint256 assets) public {
        uint256 actorBalance = assetToken.balanceOf(actor);
        if (actorBalance == 0) return;

        assets = clampBetween(assets, 1, actorBalance);
        vault_requestDeposit(assets);
    }

    function vault_claimDeposit_clamped(uint256 entropy) public {
        uint256 length = pendingDepositRequests[actor].length;
        if (length == 0) return;

        uint256 index = entropy % length;
        uint256 requestId = pendingDepositRequests[actor][index];

        vault_claimDeposit(requestId);
        _removePendingDepositRequest(actor, index);
    }

    function vault_requestRedeem_clamped(uint256 shares) public {
        uint256 maxShares = vault.maxRedeem(actor);
        if (maxShares == 0) return;

        shares = clampBetween(shares, 1, maxShares);
        vault_requestRedeem(shares);
    }

    function vault_claimRedeem_clamped(uint256 entropy) public {
        uint256 length = pendingRedeemRequests[actor].length;
        if (length == 0) return;

        uint256 index = entropy % length;
        uint256 requestId = pendingRedeemRequests[actor][index];

        vault_claimRedeem(requestId);
        _removePendingRedeemRequest(actor, index);
    }

    // ―――――――――――――――――――――――― Unclamped ―――――――――――――――――――――――――

    function vault_requestDeposit(uint256 assets) public asActor {
        if (assets == 0) return;

        uint256 requestId = vault.requestDeposit(assets, actor, actor);
        pendingDepositRequests[actor].push(requestId);
        ghosts.createdRequests++;
    }

    function vault_claimDeposit(uint256 requestId) public asActor {
        vault.claimDeposit(requestId, actor);
        ghosts.claimedDepositRequests++;
    }

    function vault_requestRedeem(uint256 shares) public asActor {
        if (shares == 0) return;

        uint256 requestId = vault.requestRedeem(shares, actor, actor);
        pendingRedeemRequests[actor].push(requestId);
        ghosts.createdRequests++;
    }

    function vault_claimRedeem(uint256 requestId) public asActor {
        vault.claimRedeem(requestId, actor);
        ghosts.claimedRedeemRequests++;
    }

    function _removePendingDepositRequest(address user, uint256 index) internal {
        uint256 length = pendingDepositRequests[user].length;
        pendingDepositRequests[user][index] = pendingDepositRequests[user][length - 1];
        pendingDepositRequests[user].pop();
    }

    function _removePendingRedeemRequest(address user, uint256 index) internal {
        uint256 length = pendingRedeemRequests[user].length;
        pendingRedeemRequests[user][index] = pendingRedeemRequests[user][length - 1];
        pendingRedeemRequests[user].pop();
    }
}
