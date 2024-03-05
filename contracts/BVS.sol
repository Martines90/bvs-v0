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

    constructor(address priceFeed) BVS_Voting() {
        bvsElections = new BVS_Elections();
        bvsElections.grantAdministratorRole(msg.sender);
        bvsElections.grantCitizenRole(msg.sender);
        bvsFuding = new BVS_Funding(priceFeed);
    }

    function revokeMySuperAdminRole() public onlyRole(SUPER_ADMINISTRATOR) {
        _revokeRole(SUPER_ADMINISTRATOR, msg.sender);
    }

    function fund(string memory email) public payable {
        bvsFuding.addFunder(msg.value, email);
    }

    function _grantCitizenRole(
        address _account
    ) public onlyRole(ADMINISTRATOR) {
        grantCitizenRole(_account);
        bvsElections.grantCitizenRole(_account);
    }

    function _grantAdminRole(address _account) public onlyRole(ADMINISTRATOR) {
        grantAdministratorRole(_account);
        bvsElections.grantAdministratorRole(_account);
    }

    function syncElectedPoliticalActors() public onlyRole(ADMINISTRATOR) {
        bvsElections.lastElectionsShouldCompletedAndClosed();

        for (uint i = 0; i < politicalActors.length; i++) {
            delete politicalActorVotingCredits[politicalActors[i]];
            delete politicalActors[i];
        }

        uint numOfWinnersOfLastElections = bvsElections.getWinnersSize();
        address account;
        uint credit;
        for (uint i = 0; i < numOfWinnersOfLastElections; i++) {
            (account, credit) = bvsElections.winners(i);
            _setupRole(POLITICAL_ACTOR, account);
            politicalActorVotingCredits[account] = credit;
            politicalActors.push(account);
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
