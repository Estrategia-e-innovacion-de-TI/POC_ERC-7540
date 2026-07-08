// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {ERC4626Base, IERC20Minimal} from "../ERC4626/ERC4626Base.sol";
import {IERC7540} from "./IERC7540.sol";

/// @title ERC7540AsyncVault
/// @notice Implementacion base asincrona para request/claim de deposit y redeem.
/// @dev Es una base minima y no incluye cola temporal ni roles avanzados de operador.
abstract contract ERC7540AsyncVault is ERC4626Base, IERC7540 {
    enum RequestType {
        Deposit,
        Redeem
    }

    struct AsyncRequest {
        RequestType requestType;
        address owner;
        address controller;
        uint256 amount;
        bool claimed;
    }

    uint256 public nextRequestId;
    mapping(uint256 => AsyncRequest) public requests;

    error InvalidRequest();
    error UnauthorizedController();

    constructor(IERC20Minimal _assetToken, string memory _name, string memory _symbol)
        ERC4626Base(_assetToken, _name, _symbol)
    {}

    /// @inheritdoc IERC7540
    function requestDeposit(uint256 assets, address controller, address owner) external override returns (uint256 requestId) {
        if (controller == address(0) || owner == address(0)) revert ZeroAddress();
        if (assets == 0) revert ZeroAmount();
        if (msg.sender != controller) revert UnauthorizedController();
        if (assets > maxDeposit(owner)) revert InsufficientAssets();

        _safeTransferFrom(address(assetToken), owner, address(this), assets);

        requestId = ++nextRequestId;
        requests[requestId] = AsyncRequest({
            requestType: RequestType.Deposit,
            owner: owner,
            controller: controller,
            amount: assets,
            claimed: false
        });

        emit DepositRequest(requestId, controller, owner, assets);
    }

    /// @inheritdoc IERC7540
    function requestRedeem(uint256 shares, address controller, address owner) external override returns (uint256 requestId) {
        if (controller == address(0) || owner == address(0)) revert ZeroAddress();
        if (shares == 0) revert ZeroAmount();
        if (msg.sender != controller) revert UnauthorizedController();
        if (shares > maxRedeem(owner)) revert InsufficientShares();

        if (controller != owner) {
            _spendAllowance(owner, controller, shares);
        }

        // Las shares quedan en escrow dentro de la vault hasta claimRedeem.
        _transfer(owner, address(this), shares);

        requestId = ++nextRequestId;
        requests[requestId] = AsyncRequest({
            requestType: RequestType.Redeem,
            owner: owner,
            controller: controller,
            amount: shares,
            claimed: false
        });

        emit RedeemRequest(requestId, controller, owner, shares);
    }

    /// @inheritdoc IERC7540
    function claimDeposit(uint256 requestId, address receiver) external override returns (uint256 shares) {
        if (receiver == address(0)) revert ZeroAddress();

        AsyncRequest storage request = requests[requestId];
        if (request.owner == address(0) || request.requestType != RequestType.Deposit || request.claimed) {
            revert InvalidRequest();
        }
        if (msg.sender != request.controller && msg.sender != request.owner) revert UnauthorizedController();

        shares = previewDeposit(request.amount);
        if (shares == 0) revert ZeroAmount();

        _afterDeposit(request.amount, shares);
        _mint(receiver, shares);

        request.claimed = true;

        emit Deposit(msg.sender, receiver, request.amount, shares);
        emit DepositClaimed(requestId, receiver, shares);
    }

    /// @inheritdoc IERC7540
    function claimRedeem(uint256 requestId, address receiver) external override returns (uint256 assets) {
        if (receiver == address(0)) revert ZeroAddress();

        AsyncRequest storage request = requests[requestId];
        if (request.owner == address(0) || request.requestType != RequestType.Redeem || request.claimed) {
            revert InvalidRequest();
        }
        if (msg.sender != request.controller && msg.sender != request.owner) revert UnauthorizedController();

        uint256 shares = request.amount;
        assets = previewRedeem(shares);
        if (assets == 0) revert ZeroAmount();

        _beforeWithdraw(assets, shares);
        _burn(address(this), shares);
        _safeTransfer(address(assetToken), receiver, assets);

        request.claimed = true;

        emit Withdraw(msg.sender, receiver, request.owner, assets, shares);
        emit RedeemClaimed(requestId, receiver, assets);
    }

    /// @inheritdoc IERC7540
    function pendingDepositRequest(uint256 requestId)
        external
        view
        override
        returns (address owner, address controller, uint256 assets, bool claimed)
    {
        AsyncRequest memory request = requests[requestId];
        if (request.requestType != RequestType.Deposit) revert InvalidRequest();

        return (request.owner, request.controller, request.amount, request.claimed);
    }

    /// @inheritdoc IERC7540
    function pendingRedeemRequest(uint256 requestId)
        external
        view
        override
        returns (address owner, address controller, uint256 shares, bool claimed)
    {
        AsyncRequest memory request = requests[requestId];
        if (request.requestType != RequestType.Redeem) revert InvalidRequest();

        return (request.owner, request.controller, request.amount, request.claimed);
    }
}
