// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {IERC20Minimal} from "../ERC4626/ERC4626Base.sol";

/// @title COPW
/// @notice Mock ERC20 para pruebas y despliegues locales como asset subyacente de ERC4626.
contract COPW is IERC20Minimal {
    string public constant name = "COPW";
    string public constant symbol = "COPW";
    uint8 public constant override decimals = 18;

    uint256 public override totalSupply;

    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    error InsufficientBalance();
    error InsufficientAllowance();
    error ZeroAddress();

    function transfer(address to, uint256 amount) external override returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        uint256 currentAllowance = allowance[from][msg.sender];
        if (currentAllowance != type(uint256).max) {
            if (currentAllowance < amount) revert InsufficientAllowance();
            allowance[from][msg.sender] = currentAllowance - amount;
            emit Approval(from, msg.sender, allowance[from][msg.sender]);
        }

        _transfer(from, to, amount);
        return true;
    }

    /// @notice Mintea tokens para direccion destino (solo mock).
    function mint(address to, uint256 amount) external {
        if (to == address(0)) revert ZeroAddress();

        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function _transfer(address from, address to, uint256 amount) internal {
        if (to == address(0)) revert ZeroAddress();

        uint256 fromBalance = balanceOf[from];
        if (fromBalance < amount) revert InsufficientBalance();

        balanceOf[from] = fromBalance - amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}
