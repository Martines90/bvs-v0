// SPDX-License-Identifier: MIT

// pragma
pragma solidity ^0.8.9;

// imports
import "@thirdweb-dev/contracts/extension/Permissions.sol";

import "./BVS_Funding.sol";
import "./BVS_Elections.sol";

/**
 * @title Balanced Voting System contract
 * @author Márton Sándor Horváth, email: hmartonsandor{@}gmail.com
 * @notice
 * @dev
 */

contract BVS is BVS_Elections, BVS_Funding {
    constructor(address priceFeed) BVS_Funding(priceFeed) BVS_Elections() {}

    function unlockTenderBudget() public onlyRole(POLITICAL_ACTOR) {
        (bool callSuccess, ) = payable(msg.sender).call{
            value: address(this).balance
        }("");
        require(callSuccess, "Call failed");
    }
}
