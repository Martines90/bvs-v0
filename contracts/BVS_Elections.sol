// SPDX-License-Identifier: MIT

// pragma
pragma solidity ^0.8.9;

// imports
import "@thirdweb-dev/contracts/extension/Permissions.sol";

import "./BVS_Roles.sol";

import "hardhat/console.sol";

/**
 * @title Balanced Voting System: Elections contract
 * @author Márton Sándor Horváth, email: hmartonsandor{@}gmail.com
 * @notice
 * @dev
 */

contract BVS_Elections is BVS_Roles {
    uint256 constant ELECTION_START_END_INTERVAL = 30 days;
    uint256 constant MINIMUM_PERCENTAGE_OF_PRE_ELECTION_VOTES = 10;
    uint256 constant MINIMUM_PERCENTAGE_OF_ELECTION_VOTES = 5;

    uint256 constant MAXIMUM_NUMBER_OF_PRE_ELECTION_VOTES = 3;

    uint256 public preElectionsStartDate;
    uint256 public preElectionsEndDate;
    uint256 public electionsStartDate;
    uint256 public electionsEndDate;

    address[] public preElectionCandidates;
    address[] public preElectionVoters;
    mapping(address => uint32) public preElectionCandidateScores;

    address[] public electionCandidates;
    address[] public electionVotes;
    mapping(address => uint32) public electionCandidateScores;

    constructor() BVS_Roles() {}

    function scheduleNextElections(
        uint256 _preElectionsStartDate,
        uint256 _preElectionsEndDate,
        uint256 _electionsStartDate,
        uint256 _electionsEndDate
    ) public onlyRole(ADMINISTRATOR) {
        console.log(
            "_preElectionsStartDate:",
            _preElectionsStartDate,
            "block.timestamp:",
            block.timestamp
        );
        require(electionsStartDate == 0, "Previous elections has to be closed");
        require(
            _preElectionsStartDate > block.timestamp + 30 days,
            "Next election start date has to be at least 30 days planned ahead from now"
        );

        preElectionsStartDate = _preElectionsStartDate;
        preElectionsEndDate = _preElectionsEndDate;
        electionsStartDate = _electionsStartDate;
        electionsEndDate = _electionsEndDate;
    }

    function closePreElections() public onlyRole(ADMINISTRATOR) {
        require(
            preElectionsEndDate + 7 days < block.timestamp,
            "Pre elections can only close after 7 days of their end"
        );

        // process data
        uint256 totalVoters = preElectionVoters.length / 100;
        for (uint i = 0; i < preElectionCandidates.length; i++) {
            uint256 voterSupportPercentage = preElectionCandidateScores[
                preElectionCandidates[i]
            ] / totalVoters;

            if (
                voterSupportPercentage >
                MINIMUM_PERCENTAGE_OF_PRE_ELECTION_VOTES
            ) {
                electionCandidates.push(preElectionCandidates[i]);
                electionCandidateScores[preElectionCandidates[i]] = 0;
            }
        }

        // clean data
        for (uint i = 0; i < preElectionCandidates.length; i++) {
            delete preElectionCandidateScores[preElectionCandidates[i]];
        }

        preElectionCandidates = new address[](0);
        preElectionVoters = new address[](0);
        preElectionsStartDate = 0;
        preElectionsEndDate = 0;
    }

    function closeElections() public onlyRole(ADMINISTRATOR) {
        require(
            preElectionsEndDate == 0,
            "Pre elections has to be close first"
        );
        require(
            electionsEndDate != 0,
            "Elections already closed or not yet planned"
        );
        require(
            electionsEndDate + 7 days < block.timestamp,
            "Elections can only close after 7 days of their end"
        );

        // revoke POLITICAL_ACTOR role from the previous cycle political actors
        for (uint i = 0; i < politicalActors.length; i++) {
            _revokeRole(POLITICAL_ACTOR, politicalActors[i]);
        }
        politicalActors = new address[](0);

        // assign roles to the winners
        uint256 totalVotes = electionVotes.length / 100;
        for (uint i = 0; i < electionCandidates.length; i++) {
            uint256 votesOwnedPercentage = electionCandidateScores[
                electionCandidates[i]
            ] / totalVotes;

            if (votesOwnedPercentage > MINIMUM_PERCENTAGE_OF_ELECTION_VOTES) {
                politicalActors.push(electionCandidates[i]);
                _setupRole(POLITICAL_ACTOR, electionCandidates[i]);
            }
        }

        for (uint i = 0; i < electionCandidates.length; i++) {
            delete electionCandidateScores[electionCandidates[i]];
        }

        electionCandidates = new address[](0);
        electionVotes = new address[](0);

        electionsStartDate = 0;
    }

    function registerAdmin(
        address adminAddress
    ) public onlyRole(ADMINISTRATOR) {
        grantAdministratorRole(adminAddress);
    }

    function registerCitizen(
        address citizenAddress
    ) public onlyRole(ADMINISTRATOR) {
        grantCitizenRole(citizenAddress);
    }
}