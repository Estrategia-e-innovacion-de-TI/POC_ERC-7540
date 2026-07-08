// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {ERC4626Base, IERC20Minimal} from "../src/ERC4626/ERC4626Base.sol";
import {COPW} from "../src/mocks/COPW.sol";

contract ERC4626HarnessUnit is ERC4626Base {
    constructor(IERC20Minimal _asset) ERC4626Base(_asset, "Vault Share", "VSH") {}

    function totalAssets() public view override returns (uint256) {
        return assetToken.balanceOf(address(this));
    }
}

contract ERC4626BaseUnitTest is Test {
    COPW internal assetToken;
    ERC4626HarnessUnit internal vault;

    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);

    function setUp() public {
        assetToken = new COPW();
        vault = new ERC4626HarnessUnit(assetToken);

        assetToken.mint(ALICE, 1_000_000 ether);
        vm.prank(ALICE);
        assetToken.approve(address(vault), type(uint256).max);
    }

    function test_ConstructorSetsMetadataAndAsset() public view {
        assertEq(vault.asset(), address(assetToken));
        assertEq(vault.name(), "Vault Share");
        assertEq(vault.symbol(), "VSH");
        assertEq(vault.decimals(), 18);
    }

    function test_ConstructorRevertsOnZeroAsset() public {
        vm.expectRevert(ERC4626Base.ZeroAddress.selector);
        new ERC4626HarnessUnit(IERC20Minimal(address(0)));
    }

    function test_DepositRevertsOnZeroReceiver() public {
        vm.prank(ALICE);
        vm.expectRevert(ERC4626Base.ZeroAddress.selector);
        vault.deposit(1 ether, address(0));
    }

    function test_DepositRevertsOnZeroAssets() public {
        vm.prank(ALICE);
        vm.expectRevert(ERC4626Base.ZeroAmount.selector);
        vault.deposit(0, ALICE);
    }

    function test_DepositSuccessUpdatesBalances() public {
        vm.prank(ALICE);
        uint256 shares = vault.deposit(100 ether, ALICE);

        assertEq(shares, 100 ether);
        assertEq(vault.balanceOf(ALICE), 100 ether);
        assertEq(vault.totalSupply(), 100 ether);
        assertEq(assetToken.balanceOf(address(vault)), 100 ether);
    }

    function test_MintSuccessPullsAssetsAndMintsShares() public {
        vm.prank(ALICE);
        uint256 assets = vault.mint(50 ether, ALICE);

        assertEq(assets, 50 ether);
        assertEq(vault.balanceOf(ALICE), 50 ether);
        assertEq(assetToken.balanceOf(address(vault)), 50 ether);
    }

    function test_WithdrawRevertsIfNotOwnerAndNoAllowance() public {
        vm.prank(ALICE);
        vault.deposit(100 ether, ALICE);

        vm.prank(BOB);
        vm.expectRevert(ERC4626Base.AllowanceExceeded.selector);
        vault.withdraw(10 ether, BOB, ALICE);
    }

    function test_WithdrawAsOwnerBurnsSharesAndTransfersAssets() public {
        vm.prank(ALICE);
        vault.deposit(100 ether, ALICE);

        vm.prank(ALICE);
        uint256 burnedShares = vault.withdraw(25 ether, ALICE, ALICE);

        assertEq(burnedShares, 25 ether);
        assertEq(vault.balanceOf(ALICE), 75 ether);
        assertEq(vault.totalSupply(), 75 ether);
        assertEq(assetToken.balanceOf(ALICE), 1_000_000 ether - 100 ether + 25 ether);
    }

    function test_RedeemRevertsWhenSharesExceedBalance() public {
        vm.prank(ALICE);
        vm.expectRevert(ERC4626Base.InsufficientShares.selector);
        vault.redeem(1 ether, ALICE, ALICE);
    }

    function test_TransferRevertsToZeroAddress() public {
        vm.prank(ALICE);
        vault.deposit(10 ether, ALICE);

        vm.prank(ALICE);
        vm.expectRevert(ERC4626Base.ZeroAddress.selector);
        vault.transfer(address(0), 1 ether);
    }

    function test_TransferFromRevertsOnInsufficientAllowance() public {
        vm.prank(ALICE);
        vault.deposit(10 ether, ALICE);

        vm.prank(BOB);
        vm.expectRevert(ERC4626Base.AllowanceExceeded.selector);
        vault.transferFrom(ALICE, BOB, 1 ether);
    }

    function test_TransferFromConsumesFiniteAllowance() public {
        vm.prank(ALICE);
        vault.deposit(10 ether, ALICE);

        vm.prank(ALICE);
        vault.approve(BOB, 3 ether);

        vm.prank(BOB);
        bool ok = vault.transferFrom(ALICE, BOB, 2 ether);

        assertTrue(ok);
        assertEq(vault.balanceOf(ALICE), 8 ether);
        assertEq(vault.balanceOf(BOB), 2 ether);
        assertEq(vault.allowance(ALICE, BOB), 1 ether);
    }

    function test_TransferFromDoesNotConsumeInfiniteAllowance() public {
        vm.prank(ALICE);
        vault.deposit(10 ether, ALICE);

        vm.prank(ALICE);
        vault.approve(BOB, type(uint256).max);

        vm.prank(BOB);
        bool ok = vault.transferFrom(ALICE, BOB, 2 ether);

        assertTrue(ok);
        assertEq(vault.allowance(ALICE, BOB), type(uint256).max);
    }

    function test_PreviewMintRoundsUpWhenRatioIsFractional() public {
        vm.prank(ALICE);
        vault.deposit(2 ether, ALICE);

        assetToken.mint(address(this), 1 ether);
        assetToken.transfer(address(vault), 1 ether);

        uint256 assetsForOneShare = vault.previewMint(1 ether);
        assertEq(assetsForOneShare, 1.5 ether);
    }

    function test_PreviewWithdrawRoundsUpWhenRatioIsFractional() public {
        vm.prank(ALICE);
        vault.deposit(2 ether, ALICE);

        assetToken.mint(address(this), 1 ether);
        assetToken.transfer(address(vault), 1 ether);

        uint256 sharesForOneAsset = vault.previewWithdraw(1 ether);
        assertEq(sharesForOneAsset, 0.666666666666666667 ether);
    }
}
