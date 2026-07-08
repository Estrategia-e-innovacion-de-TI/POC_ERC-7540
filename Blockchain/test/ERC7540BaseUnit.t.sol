// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {ERC7540IdleVault} from "../src/ERC7540/ERC7540IdleVault.sol";
import {ERC7540AsyncVault} from "../src/ERC7540/ERC7540AsyncVault.sol";
import {IERC7540} from "../src/ERC7540/IERC7540.sol";
import {COPW} from "../src/mocks/COPW.sol";

contract ERC7540BaseUnitTest is Test {
    COPW internal assetToken;
    ERC7540IdleVault internal vault;

    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    address internal constant CAROL = address(0xCA0123);

    function setUp() public {
        assetToken = new COPW();
        vault = new ERC7540IdleVault(assetToken, "Async Vault Share", "aVSH");

        assetToken.mint(ALICE, 1_000_000 ether);
        vm.prank(ALICE);
        assetToken.approve(address(vault), type(uint256).max);
    }

    function test_ConstructorSetsMetadataAndAsset() public view {
        assertEq(vault.asset(), address(assetToken));
        assertEq(vault.name(), "Async Vault Share");
        assertEq(vault.symbol(), "aVSH");
        assertEq(vault.decimals(), 18);
    }

    function test_RequestDepositRevertsWhenControllerIsNotCaller() public {
        vm.prank(ALICE);
        vm.expectRevert(ERC7540AsyncVault.UnauthorizedController.selector);
        vault.requestDeposit(100 ether, BOB, ALICE);
    }

    function test_RequestDepositStoresRequestAndPullsAssets() public {
        uint256 beforeVaultAssets = assetToken.balanceOf(address(vault));

        vm.prank(ALICE);
        uint256 requestId = vault.requestDeposit(100 ether, ALICE, ALICE);

        (address owner, address controller, uint256 assets, bool claimed) = vault.pendingDepositRequest(requestId);

        assertEq(requestId, 1);
        assertEq(owner, ALICE);
        assertEq(controller, ALICE);
        assertEq(assets, 100 ether);
        assertFalse(claimed);
        assertEq(assetToken.balanceOf(address(vault)), beforeVaultAssets + 100 ether);
    }

    function test_ClaimDepositMintsSharesAndMarksRequestAsClaimed() public {
        vm.prank(ALICE);
        uint256 requestId = vault.requestDeposit(120 ether, ALICE, ALICE);

        uint256 expectedShares = vault.previewDeposit(120 ether);

        vm.prank(ALICE);
        uint256 mintedShares = vault.claimDeposit(requestId, ALICE);

        (, , , bool claimedAfter) = vault.pendingDepositRequest(requestId);

        assertEq(mintedShares, expectedShares);
        assertEq(vault.balanceOf(ALICE), expectedShares);
        assertTrue(claimedAfter);

        vm.prank(ALICE);
        vm.expectRevert(ERC7540AsyncVault.InvalidRequest.selector);
        vault.claimDeposit(requestId, ALICE);
    }

    function test_ClaimDepositAllowsControllerToClaimForReceiver() public {
        vm.prank(ALICE);
        uint256 requestId = vault.requestDeposit(10 ether, ALICE, ALICE);

        vm.prank(ALICE);
        uint256 mintedShares = vault.claimDeposit(requestId, BOB);

        assertEq(mintedShares, 10 ether);
        assertEq(vault.balanceOf(BOB), 10 ether);
        assertEq(vault.balanceOf(ALICE), 0);
    }

    function test_RequestRedeemMovesSharesToEscrow() public {
        vm.prank(ALICE);
        uint256 depositRequestId = vault.requestDeposit(200 ether, ALICE, ALICE);

        vm.prank(ALICE);
        vault.claimDeposit(depositRequestId, ALICE);

        vm.prank(ALICE);
        uint256 redeemRequestId = vault.requestRedeem(80 ether, ALICE, ALICE);

        (address owner, address controller, uint256 shares, bool claimed) = vault.pendingRedeemRequest(redeemRequestId);

        assertEq(owner, ALICE);
        assertEq(controller, ALICE);
        assertEq(shares, 80 ether);
        assertFalse(claimed);
        assertEq(vault.balanceOf(ALICE), 120 ether);
        assertEq(vault.balanceOf(address(vault)), 80 ether);
    }

    function test_RequestRedeemUsesAllowanceWhenControllerDiffersFromOwner() public {
        vm.prank(ALICE);
        uint256 depositRequestId = vault.requestDeposit(50 ether, ALICE, ALICE);

        vm.prank(ALICE);
        vault.claimDeposit(depositRequestId, ALICE);

        vm.prank(ALICE);
        vault.approve(BOB, 30 ether);

        vm.prank(BOB);
        uint256 requestId = vault.requestRedeem(30 ether, BOB, ALICE);

        assertEq(vault.allowance(ALICE, BOB), 0);

        (, address controller, uint256 shares, bool claimed) = vault.pendingRedeemRequest(requestId);
        assertEq(controller, BOB);
        assertEq(shares, 30 ether);
        assertFalse(claimed);
    }

    function test_ClaimRedeemBurnsEscrowSharesAndTransfersAssets() public {
        vm.prank(ALICE);
        uint256 depositRequestId = vault.requestDeposit(100 ether, ALICE, ALICE);

        vm.prank(ALICE);
        vault.claimDeposit(depositRequestId, ALICE);

        vm.prank(ALICE);
        uint256 redeemRequestId = vault.requestRedeem(40 ether, ALICE, ALICE);

        uint256 expectedAssets = vault.previewRedeem(40 ether);

        vm.prank(ALICE);
        uint256 assetsOut = vault.claimRedeem(redeemRequestId, CAROL);

        (, , , bool claimedAfter) = vault.pendingRedeemRequest(redeemRequestId);

        assertEq(assetsOut, expectedAssets);
        assertEq(assetToken.balanceOf(CAROL), expectedAssets);
        assertEq(vault.balanceOf(address(vault)), 0);
        assertEq(vault.totalSupply(), 60 ether);
        assertTrue(claimedAfter);

        vm.prank(ALICE);
        vm.expectRevert(ERC7540AsyncVault.InvalidRequest.selector);
        vault.claimRedeem(redeemRequestId, CAROL);
    }

    function test_ClaimFunctionsRevertForUnauthorizedCaller() public {
        vm.prank(ALICE);
        uint256 depositRequestId = vault.requestDeposit(25 ether, ALICE, ALICE);

        vm.prank(BOB);
        vm.expectRevert(ERC7540AsyncVault.UnauthorizedController.selector);
        vault.claimDeposit(depositRequestId, BOB);

        vm.prank(ALICE);
        vault.claimDeposit(depositRequestId, ALICE);

        vm.prank(ALICE);
        uint256 redeemRequestId = vault.requestRedeem(10 ether, ALICE, ALICE);

        vm.prank(BOB);
        vm.expectRevert(ERC7540AsyncVault.UnauthorizedController.selector);
        vault.claimRedeem(redeemRequestId, BOB);
    }

    function test_ClaimDepositRevertsForRedeemRequest() public {
        vm.prank(ALICE);
        uint256 depositRequestId = vault.requestDeposit(15 ether, ALICE, ALICE);

        vm.prank(ALICE);
        vault.claimDeposit(depositRequestId, ALICE);

        vm.prank(ALICE);
        uint256 redeemRequestId = vault.requestRedeem(5 ether, ALICE, ALICE);

        vm.prank(ALICE);
        vm.expectRevert(ERC7540AsyncVault.InvalidRequest.selector);
        vault.claimDeposit(redeemRequestId, ALICE);
    }

    function test_ClaimRedeemRevertsForDepositRequest() public {
        vm.prank(ALICE);
        uint256 depositRequestId = vault.requestDeposit(15 ether, ALICE, ALICE);

        vm.prank(ALICE);
        vm.expectRevert(ERC7540AsyncVault.InvalidRequest.selector);
        vault.claimRedeem(depositRequestId, ALICE);
    }

    function test_RequestRedeemRevertsWithoutAllowanceForThirdPartyController() public {
        vm.prank(ALICE);
        uint256 depositRequestId = vault.requestDeposit(20 ether, ALICE, ALICE);

        vm.prank(ALICE);
        vault.claimDeposit(depositRequestId, ALICE);

        vm.prank(BOB);
        vm.expectRevert();
        vault.requestRedeem(5 ether, BOB, ALICE);
    }
}
