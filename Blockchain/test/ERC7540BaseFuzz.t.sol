// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {ERC7540IdleVault} from "../src/ERC7540/ERC7540IdleVault.sol";
import {ERC7540AsyncVault} from "../src/ERC7540/ERC7540AsyncVault.sol";
import {COPW} from "../src/mocks/COPW.sol";

contract ERC7540BaseFuzzTest is Test {
    COPW internal assetToken;
    ERC7540IdleVault internal vault;

    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    address internal constant CAROL = address(0xCA0123);

    function setUp() public {
        assetToken = new COPW();
        vault = new ERC7540IdleVault(assetToken, "Async Vault Share", "aVSH");
    }

    function _mintAndApprove(address user, uint256 assets) internal {
        assetToken.mint(user, assets);
        vm.prank(user);
        assetToken.approve(address(vault), type(uint256).max);
    }

    function _requestAndClaimDeposit(address owner, address receiver, uint256 assets) internal returns (uint256 shares) {
        vm.prank(owner);
        uint256 requestId = vault.requestDeposit(assets, owner, owner);

        vm.prank(owner);
        shares = vault.claimDeposit(requestId, receiver);
    }

    function testFuzz_RequestDepositThenClaimMintsPreviewShares(uint96 assets, address receiver) public {
        vm.assume(receiver != address(0));

        uint256 amount = bound(uint256(assets), 1, type(uint96).max);
        _mintAndApprove(ALICE, amount);

        uint256 expectedShares = vault.previewDeposit(amount);

        vm.prank(ALICE);
        uint256 requestId = vault.requestDeposit(amount, ALICE, ALICE);

        vm.prank(ALICE);
        uint256 mintedShares = vault.claimDeposit(requestId, receiver);

        assertEq(mintedShares, expectedShares, "claimDeposit should mint previewed shares");
        assertEq(vault.balanceOf(receiver), expectedShares, "receiver should get claimed shares");
        assertEq(assetToken.balanceOf(address(vault)), amount, "vault should hold deposited assets");
    }

    function testFuzz_RequestRedeemThenClaimReturnsPreviewAssets(uint96 deposited, uint96 toRedeem, address receiver) public {
        vm.assume(receiver != address(0));

        uint256 depositedAssets = bound(uint256(deposited), 1, type(uint96).max);
        _mintAndApprove(ALICE, depositedAssets);

        _requestAndClaimDeposit(ALICE, ALICE, depositedAssets);

        uint256 redeemShares = bound(uint256(toRedeem), 1, vault.balanceOf(ALICE));
        uint256 expectedAssets = vault.previewRedeem(redeemShares);

        vm.prank(ALICE);
        uint256 requestId = vault.requestRedeem(redeemShares, ALICE, ALICE);

        vm.prank(ALICE);
        uint256 assetsOut = vault.claimRedeem(requestId, receiver);

        assertEq(assetsOut, expectedAssets, "claimRedeem should return previewed assets");
        assertEq(assetToken.balanceOf(receiver), expectedAssets, "receiver should receive redeemed assets");
    }

    function testFuzz_RequestRedeemByControllerConsumesAllowance(uint96 deposited, uint96 toRedeem) public {
        uint256 depositedAssets = bound(uint256(deposited), 1, type(uint96).max);
        _mintAndApprove(ALICE, depositedAssets);

        _requestAndClaimDeposit(ALICE, ALICE, depositedAssets);

        uint256 redeemShares = bound(uint256(toRedeem), 1, vault.balanceOf(ALICE));

        vm.prank(ALICE);
        vault.approve(BOB, redeemShares);

        vm.prank(BOB);
        uint256 requestId = vault.requestRedeem(redeemShares, BOB, ALICE);

        (, address controller, uint256 shares, bool claimed) = vault.pendingRedeemRequest(requestId);

        assertEq(controller, BOB, "controller should be stored");
        assertEq(shares, redeemShares, "requested shares should match");
        assertFalse(claimed, "request should start unclaimed");
        assertEq(vault.allowance(ALICE, BOB), 0, "allowance should be consumed");
    }

    function testFuzz_OnlyOwnerOrControllerCanClaimDeposit(uint96 assets, address stranger) public {
        vm.assume(stranger != address(0));
        vm.assume(stranger != ALICE);

        uint256 amount = bound(uint256(assets), 1, type(uint96).max);
        _mintAndApprove(ALICE, amount);

        vm.prank(ALICE);
        uint256 requestId = vault.requestDeposit(amount, ALICE, ALICE);

        vm.prank(stranger);
        vm.expectRevert(ERC7540AsyncVault.UnauthorizedController.selector);
        vault.claimDeposit(requestId, stranger);
    }

    function testFuzz_OnlyOwnerOrControllerCanClaimRedeem(uint96 deposited, uint96 toRedeem, address stranger) public {
        vm.assume(stranger != address(0));
        vm.assume(stranger != ALICE);

        uint256 depositedAssets = bound(uint256(deposited), 1, type(uint96).max);
        _mintAndApprove(ALICE, depositedAssets);

        _requestAndClaimDeposit(ALICE, ALICE, depositedAssets);

        uint256 redeemShares = bound(uint256(toRedeem), 1, vault.balanceOf(ALICE));

        vm.prank(ALICE);
        uint256 requestId = vault.requestRedeem(redeemShares, ALICE, ALICE);

        vm.prank(stranger);
        vm.expectRevert(ERC7540AsyncVault.UnauthorizedController.selector);
        vault.claimRedeem(requestId, stranger);
    }

    function testFuzz_CannotClaimSameDepositRequestTwice(uint96 assets) public {
        uint256 amount = bound(uint256(assets), 1, type(uint96).max);
        _mintAndApprove(ALICE, amount);

        vm.prank(ALICE);
        uint256 requestId = vault.requestDeposit(amount, ALICE, ALICE);

        vm.prank(ALICE);
        vault.claimDeposit(requestId, ALICE);

        vm.prank(ALICE);
        vm.expectRevert(ERC7540AsyncVault.InvalidRequest.selector);
        vault.claimDeposit(requestId, ALICE);
    }

    function testFuzz_CannotClaimSameRedeemRequestTwice(uint96 deposited, uint96 toRedeem) public {
        uint256 depositedAssets = bound(uint256(deposited), 1, type(uint96).max);
        _mintAndApprove(ALICE, depositedAssets);

        _requestAndClaimDeposit(ALICE, ALICE, depositedAssets);

        uint256 redeemShares = bound(uint256(toRedeem), 1, vault.balanceOf(ALICE));

        vm.prank(ALICE);
        uint256 requestId = vault.requestRedeem(redeemShares, ALICE, ALICE);

        vm.prank(ALICE);
        vault.claimRedeem(requestId, ALICE);

        vm.prank(ALICE);
        vm.expectRevert(ERC7540AsyncVault.InvalidRequest.selector);
        vault.claimRedeem(requestId, ALICE);
    }

    function testFuzz_RequestIdsIncreaseMonotonically(uint96 amountA, uint96 amountB) public {
        uint256 first = bound(uint256(amountA), 1, type(uint96).max);
        uint256 second = bound(uint256(amountB), 1, type(uint96).max);

        _mintAndApprove(ALICE, first + second);

        vm.prank(ALICE);
        uint256 requestIdA = vault.requestDeposit(first, ALICE, ALICE);

        vm.prank(ALICE);
        uint256 requestIdB = vault.requestDeposit(second, ALICE, ALICE);

        assertEq(requestIdB, requestIdA + 1, "request IDs should increase by one");
    }

    function testFuzz_RequestDepositRequiresControllerAsCaller(uint96 assets, address controller) public {
        vm.assume(controller != address(0));
        vm.assume(controller != ALICE);

        uint256 amount = bound(uint256(assets), 1, type(uint96).max);
        _mintAndApprove(ALICE, amount);

        vm.prank(ALICE);
        vm.expectRevert(ERC7540AsyncVault.UnauthorizedController.selector);
        vault.requestDeposit(amount, controller, ALICE);
    }

    function testFuzz_RequestRedeemRequiresControllerAsCaller(uint96 deposited, uint96 toRedeem, address controller) public {
        vm.assume(controller != address(0));
        vm.assume(controller != ALICE);

        uint256 depositedAssets = bound(uint256(deposited), 1, type(uint96).max);
        _mintAndApprove(ALICE, depositedAssets);

        _requestAndClaimDeposit(ALICE, ALICE, depositedAssets);

        uint256 redeemShares = bound(uint256(toRedeem), 1, vault.balanceOf(ALICE));

        vm.prank(ALICE);
        vm.expectRevert(ERC7540AsyncVault.UnauthorizedController.selector);
        vault.requestRedeem(redeemShares, controller, ALICE);
    }
}
