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

contract BVS is BVS_Voting {
    BVS_Elections public immutable bvsElections;
    BVS_Funding public immutable bvsFuding;

    constructor(address priceFeed, address _bvsElectionsContract) BVS_Voting() {
        bvsElections = BVS_Elections(_bvsElectionsContract);
        bvsFuding = new BVS_Funding(priceFeed);
    }

    function fund(string memory email) public payable {
        bvsFuding.addFunder(msg.value, email);
    }

    function syncElectedPoliticalActors() public onlyRole(SUPER_ADMINISTRATOR) {
        bvsElections.lastElectionsShouldCompletedAndClosed();

        for (uint i = 0; i < politicalActors.length; i++) {
            _revokeRole(POLITICAL_ACTOR, politicalActors[i]);
            delete politicalActorVotingCredits[politicalActors[i]];
            delete politicalActors[i];
        }

        address[] memory electedPoliticalActors = bvsElections
            .getPoliticalActors();
        for (uint i = 0; i < electedPoliticalActors.length; i++) {
            grantPoliticalActorRole(
                electedPoliticalActors[i],
                bvsElections.politicalActorVotingCredits(
                    electedPoliticalActors[i]
                )
            );
        }
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
