// SPDX-License-Identifier: MIT

// pragma
pragma solidity ^0.8.9;

// imports
import "@thirdweb-dev/contracts/extension/Permissions.sol";

import "./BVS_Funding.sol";
import "./BVS_Voting.sol";
import "./BVS_Elections.sol";

/**
 * @title Balanced Voting System contract
 * @author Márton Sándor Horváth, email: hmartonsandor{@}gmail.com
 * @notice
 * @dev
 */

contract BVS is BVS_Roles, BVS_Funding {
    BVS_Elections public immutable cBVS_Elections;
    BVS_Voting public immutable cBVS_Voting;

    constructor(address priceFeed) BVS_Roles() BVS_Funding(priceFeed) {
        cBVS_Elections = new BVS_Elections();
        cBVS_Voting = new BVS_Voting();
    }

    function unlockTenderBudget(
        bytes32 _votingKey
    ) public onlyRole(POLITICAL_ACTOR) {
        require(
            cBVS_Voting.isVotingWithTargetBudgetWon(_votingKey),
            "Voting did not received the majority of support"
        );
        require(
            cBVS_Voting.getVoting(_votingKey).creator == msg.sender,
            "This is not your voting"
        );

        (bool callSuccess, ) = payable(msg.sender).call{
            value: cBVS_Voting.getVoting(_votingKey).requiredBudget
        }(""); // address(this).balance
        require(callSuccess, "Call failed");
    }
}
