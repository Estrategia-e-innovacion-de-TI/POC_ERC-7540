// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2 <0.9.0;

import "../Base.sol";
import {CounterHandler} from "./CounterHandler.sol";
import {ERC7540Handler} from "./ERC7540Handler.sol";

/// @notice Inherits from all the handlers to expose all entry points in a single contract.
///         Manages environment changes (e.g. current actor, current token, mocks setup, etc.).
abstract contract Handlers is
    CounterHandler,
    ERC7540Handler
{
    function setCurrentActor(uint256 entropy) public {
        actor = actors[entropy % actors.length];
    }
}
