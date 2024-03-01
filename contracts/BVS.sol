// SPDX-License-Identifier: MIT

// pragma
pragma solidity ^0.8.9;

import "./BVS_Funding.sol";
import "./BVS_Voting.sol";
import "./BVS_Elections.sol";

/**
 * @title Balanced Voting System contract
 * @author Márton Sándor Horváth, email: hmartonsandor{@}gmail.com
 * @notice
 * @dev
 */

contract BVS is BVS_Voting, BVS_Funding {
    BVS_Elections public immutable bvsElections;

    constructor(
        address priceFeed,
        address _bvsElectionsContract
    ) BVS_Voting() BVS_Funding(priceFeed) {
        bvsElections = BVS_Elections(_bvsElectionsContract);
    }

    function syncElectedPoliticalActors() public onlyRole(SUPER_ADMINISTRATOR) {
        politicalActors = bvsElections.getPoliticalActors();
    }

    function unlockVotingBudget(
        bytes32 _votingKey
    ) public onlyRole(POLITICAL_ACTOR) {
        require(
            isVotingWon(_votingKey, true),
            "Voting did not received the majority of support"
        );
        require(
            getVoting(_votingKey).creator == msg.sender,
            "This is not your voting"
        );

        (bool callSuccess, ) = payable(msg.sender).call{
            value: getVoting(_votingKey).budget
        }("");
        require(callSuccess, "Call failed");

        votings[_votingKey].budget = 0; // make sure no more money can be requested
    }
}
