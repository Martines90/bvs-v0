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

    struct PreElectionVote {
        address citizenAddress;
        uint16 voteCount;
    }

    uint256 public preElectionsStartDate;
    uint256 public preElectionsEndDate;
    uint256 public electionsStartDate;
    uint256 public electionsEndDate;

    address[] public preElectionCandidates;
    uint256 public preElectionVotersCount;
    mapping(address => PreElectionVote) public preElectionVotes;
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
            "Pre elections can only close after 7 days of its end"
        );

        // process data
        uint256 totalVoters = preElectionVotersCount / 100;
        uint256 numOfPreElectionCandidates = preElectionCandidates.length;
        for (uint i = 0; i < numOfPreElectionCandidates; i++) {
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
        preElectionVotersCount = 0;
        preElectionsStartDate = 0;
        preElectionsEndDate = 0;
    }

    function closeElections() public onlyRole(ADMINISTRATOR) {
        require(
            preElectionsEndDate == 0,
            "Pre elections has to be close first"
        );
        require(
            electionsStartDate != 0,
            "Elections already closed or not yet planned"
        );
        require(
            electionsEndDate + 7 days < block.timestamp,
            "Elections can only close after 7 days of its end"
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

    function registerAsPreElectionCandidate() public payable onlyRole(CITIZEN) {
        require(
            preElectionsStartDate > 0,
            "Pre elections not scheduled or already closed"
        );
        require(
            preElectionsStartDate > block.timestamp,
            "Pre elections is already in progress"
        );
        require(
            preElectionCandidateScores[msg.sender] == 0,
            "You are already registered as a candidate"
        );

        preElectionCandidates.push(msg.sender);
        preElectionCandidateScores[msg.sender] = 1;
    }

    function voteOnPreElections(
        address voteOnAddress
    ) public onlyRole(CITIZEN) {
        require(
            block.timestamp > preElectionsStartDate &&
                preElectionsStartDate != 0,
            "Pre elections not yet started"
        );
        require(
            block.timestamp < preElectionsEndDate,
            "Pre elections already closed"
        );
        require(
            preElectionVotes[msg.sender].voteCount != 3,
            "You already used your 3 vote credit on the pre elections"
        );

        require(
            preElectionCandidateScores[voteOnAddress] > 0,
            "Under the provided address there is no registered pre election candidate"
        );

        if (preElectionVotes[msg.sender].voteCount == 0) {
            preElectionVotersCount += 1;
            preElectionVotes[msg.sender] = PreElectionVote({
                citizenAddress: msg.sender,
                voteCount: 1
            });
        } else {
            preElectionVotes[msg.sender].voteCount += 1;
        }

        preElectionCandidateScores[voteOnAddress] += 1;
    }

    function getPreElectionCandidatesSize() public view returns (uint256) {
        return preElectionCandidates.length;
    }

    function getElectionCandidatesSize() public view returns (uint256) {
        return electionCandidates.length;
    }
}
