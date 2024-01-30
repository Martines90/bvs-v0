// SPDX-License-Identifier: MIT

// pragma
pragma solidity ^0.8.9;

// imports
import "@thirdweb-dev/contracts/extension/Permissions.sol";

import "./BVS_Funding.sol";

/**
 * @title Balanced Voting System contract
 * @author Márton Sándor Horváth, email: hmartonsandor{@}gmail.com
 * @notice
 * @dev
 */

contract BVS is Permissions, BVS_Funding {
    bytes32 public constant SYSTEM_ADMIN = keccak256("SYSTEM_ADMIN");
    bytes32 public constant POLITICAL_ACTOR = keccak256("POLITICAL_ACTOR");

    constructor(address priceFeed) BVS_Funding(priceFeed) {
        _setupRole(POLITICAL_ACTOR, msg.sender);
    }

    function unlockTenderBudget() public onlyRole(POLITICAL_ACTOR) {
        (bool callSuccess, ) = payable(msg.sender).call{
            value: address(this).balance
        }("");
        require(callSuccess, "Call failed");
    }
}
