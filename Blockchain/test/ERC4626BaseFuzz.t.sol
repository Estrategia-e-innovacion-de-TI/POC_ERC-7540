// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {ERC4626Base, IERC20Minimal} from "../src/ERC4626/ERC4626Base.sol";
import {COPW} from "../src/mocks/COPW.sol";

contract ERC4626Harness is ERC4626Base {
    constructor(IERC20Minimal _asset) ERC4626Base(_asset, "Vault Share", "VSH") {}

    function totalAssets() public view override returns (uint256) {
        return assetToken.balanceOf(address(this));
    }
}

contract ERC4626BaseFuzzTest is Test {
    COPW internal assetToken;
    ERC4626Harness internal vault;

    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    address internal constant CAROL = address(0xCA0123);

    function setUp() public {
        assetToken = new COPW();
        vault = new ERC4626Harness(assetToken);
    }

    function _mintAndApprove(address user, uint256 assets) internal {
        assetToken.mint(user, assets);
        vm.prank(user);
        assetToken.approve(address(vault), assets);
    }

    function testFuzz_DepositMintsPreviewShares(uint96 assets, address receiver) public {
        vm.assume(receiver != address(0));

        uint256 amount = bound(uint256(assets), 1, type(uint96).max);
        _mintAndApprove(ALICE, amount);

        uint256 expectedShares = vault.previewDeposit(amount);

        vm.prank(ALICE);
        uint256 mintedShares = vault.deposit(amount, receiver);

        assertEq(mintedShares, expectedShares, "deposit should mint previewed shares");
        assertEq(vault.balanceOf(receiver), expectedShares, "receiver should get minted shares");
        assertEq(assetToken.balanceOf(address(vault)), amount, "vault should receive deposited assets");
    }

    function testFuzz_MintPullsPreviewAssets(uint96 shares, address receiver) public {
        vm.assume(receiver != address(0));

        uint256 shareAmount = bound(uint256(shares), 1, type(uint96).max);
        uint256 expectedAssets = vault.previewMint(shareAmount);
        _mintAndApprove(ALICE, expectedAssets);

        vm.prank(ALICE);
        uint256 pulledAssets = vault.mint(shareAmount, receiver);

        assertEq(pulledAssets, expectedAssets, "mint should pull previewed assets");
        assertEq(vault.balanceOf(receiver), shareAmount, "receiver should get requested shares");
        assertEq(assetToken.balanceOf(address(vault)), expectedAssets, "vault should hold pulled assets");
    }

    function testFuzz_WithdrawBurnsPreviewShares(uint96 deposited, uint96 toWithdraw) public {
        uint256 depositedAssets = bound(uint256(deposited), 1, type(uint96).max);
        _mintAndApprove(ALICE, depositedAssets);

        vm.prank(ALICE);
        vault.deposit(depositedAssets, ALICE);

        uint256 withdrawAssets = bound(uint256(toWithdraw), 1, depositedAssets);
        uint256 expectedBurnedShares = vault.previewWithdraw(withdrawAssets);

        vm.prank(ALICE);
        uint256 burnedShares = vault.withdraw(withdrawAssets, ALICE, ALICE);

        assertEq(burnedShares, expectedBurnedShares, "withdraw should burn previewed shares");
        assertEq(vault.balanceOf(ALICE), depositedAssets - burnedShares, "owner should retain remaining shares");
        assertEq(assetToken.balanceOf(ALICE), withdrawAssets, "receiver should get withdrawn assets");
    }

    function testFuzz_RedeemReturnsPreviewAssets(uint96 deposited, uint96 toRedeem) public {
        uint256 depositedAssets = bound(uint256(deposited), 1, type(uint96).max);
        _mintAndApprove(ALICE, depositedAssets);

        vm.prank(ALICE);
        vault.deposit(depositedAssets, ALICE);

        uint256 redeemShares = bound(uint256(toRedeem), 1, vault.balanceOf(ALICE));
        uint256 expectedAssets = vault.previewRedeem(redeemShares);

        vm.prank(ALICE);
        uint256 returnedAssets = vault.redeem(redeemShares, ALICE, ALICE);

        assertEq(returnedAssets, expectedAssets, "redeem should return previewed assets");
        assertEq(vault.balanceOf(ALICE), depositedAssets - redeemShares, "owner shares should decrease");
        assertEq(assetToken.balanceOf(ALICE), returnedAssets, "owner should receive redeemed assets");
    }

    function testFuzz_WithdrawWithAllowance(uint96 deposited, uint96 toWithdraw, address receiver) public {
        vm.assume(receiver != address(0));

        uint256 depositedAssets = bound(uint256(deposited), 1, type(uint96).max);
        _mintAndApprove(ALICE, depositedAssets);

        vm.prank(ALICE);
        vault.deposit(depositedAssets, ALICE);

        uint256 withdrawAssets = bound(uint256(toWithdraw), 1, depositedAssets);
        uint256 burnShares = vault.previewWithdraw(withdrawAssets);

        vm.prank(ALICE);
        vault.approve(BOB, burnShares);

        vm.prank(BOB);
        uint256 burned = vault.withdraw(withdrawAssets, receiver, ALICE);

        assertEq(burned, burnShares, "spender should burn approved share amount");
        assertEq(vault.allowance(ALICE, BOB), 0, "allowance should be consumed");
        assertEq(assetToken.balanceOf(receiver), withdrawAssets, "receiver should receive assets");
    }

    function testFuzz_TransferFromMovesShares(uint96 deposited, uint96 spendAmount, address recipient) public {
        vm.assume(recipient != address(0));
        vm.assume(recipient != ALICE);

        uint256 depositedAssets = bound(uint256(deposited), 1, type(uint96).max);
        _mintAndApprove(ALICE, depositedAssets);

        vm.prank(ALICE);
        vault.deposit(depositedAssets, ALICE);

        uint256 amount = bound(uint256(spendAmount), 1, depositedAssets);

        vm.prank(ALICE);
        vault.approve(BOB, amount);

        vm.prank(BOB);
        bool ok = vault.transferFrom(ALICE, recipient, amount);

        assertTrue(ok, "transferFrom should return true");
        assertEq(vault.balanceOf(ALICE), depositedAssets - amount, "owner shares should decrease");
        assertEq(vault.balanceOf(recipient), amount, "recipient should receive shares");
        assertEq(vault.allowance(ALICE, BOB), 0, "allowance should be spent");
    }

    function testFuzz_MaxWithdrawAndRedeemTrackBalance(uint96 deposited) public {
        uint256 depositedAssets = bound(uint256(deposited), 1, type(uint96).max);
        _mintAndApprove(CAROL, depositedAssets);

        vm.prank(CAROL);
        vault.deposit(depositedAssets, CAROL);

        assertEq(vault.maxRedeem(CAROL), vault.balanceOf(CAROL), "maxRedeem should equal share balance");
        assertEq(vault.maxWithdraw(CAROL), vault.convertToAssets(vault.balanceOf(CAROL)), "maxWithdraw should track assets");
    }
}
