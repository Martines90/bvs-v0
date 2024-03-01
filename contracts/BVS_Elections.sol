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
    uint256 constant MINIMUM_PERCENTAGE_OF_PRE_ELECTION_VOTES = 20;
    uint256 constant MINIMUM_PERCENTAGE_OF_ELECTION_VOTES = 10;

    uint256 constant MAXIMUM_NUMBER_OF_PRE_ELECTION_VOTES = 3;

    uint256 public preElectionsStartDate;
    uint256 public preElectionsEndDate;
    uint256 public electionsStartDate;
    uint256 public electionsEndDate;

    struct PreElectionVoter {
        address account;
        address candidate1;
        address candidate2;
        address candidate3;
        uint16 voteCount;
    }

    struct ElectionVoter {
        address account;
        address candidate1;
    }

    address[] public preElectionCandidates;
    address[] public preElectionVoters;
    mapping(address => PreElectionVoter) public preElectionVotes;
    mapping(address => uint32) public preElectionCandidateScores;

    address[] public electionCandidates;
    address[] public electionVoters;
    mapping(address => address) public electionVotes;
    mapping(address => uint32) public electionCandidateScores;

    constructor() BVS_Roles() {}

    function scheduleNextElections(
        uint256 _preElectionsStartDate,
        uint256 _preElectionsEndDate,
        uint256 _electionsStartDate,
        uint256 _electionsEndDate
    ) public onlyRole(ADMINISTRATOR) {
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
        uint256 numOfPreElectionVoters = preElectionVoters.length;
        uint256 numOfPreElectionCandidates = preElectionCandidates.length;

        for (uint256 i = 0; i < numOfPreElectionCandidates; i++) {
            uint256 voterSupportPercentage = ((preElectionCandidateScores[
                preElectionCandidates[i]
            ] - 1) * 100) / numOfPreElectionVoters;

            if (
                voterSupportPercentage >
                MINIMUM_PERCENTAGE_OF_PRE_ELECTION_VOTES
            ) {
                electionCandidates.push(preElectionCandidates[i]);
                electionCandidateScores[preElectionCandidates[i]] = 1;
            }
        }

        // clean data
        for (uint i = 0; i < numOfPreElectionCandidates; i++) {
            delete preElectionCandidateScores[preElectionCandidates[i]];
        }

        for (uint i = 0; i < numOfPreElectionVoters; i++) {
            delete preElectionVotes[preElectionVoters[i]];
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
            delete politicalActorProfiles[politicalActors[i]];
        }
        politicalActors = new address[](0);

        // assign roles to the winners
        uint256 totalVotes = electionVoters.length;
        for (uint i = 0; i < electionCandidates.length; i++) {
            uint256 votesOwnedPercentage = ((electionCandidateScores[
                electionCandidates[i]
            ] - 1) * 100) / totalVotes;

            if (votesOwnedPercentage > MINIMUM_PERCENTAGE_OF_ELECTION_VOTES) {
                uint256 votingCycleTotalCredit = (votesOwnedPercentage -
                    MINIMUM_PERCENTAGE_OF_ELECTION_VOTES) / 10;
                grantPoliticalActorRole(
                    electionCandidates[i],
                    uint16(votingCycleTotalCredit)
                );
            }
        }

        for (uint i = 0; i < electionCandidates.length; i++) {
            delete electionCandidateScores[electionCandidates[i]];
        }

        electionCandidates = new address[](0);
        electionVoters = new address[](0);

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
        PreElectionVoter memory preElectionVoter = preElectionVotes[msg.sender];
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
            preElectionVoter.voteCount != 3,
            "You already used your 3 vote credit on the pre elections"
        );

        require(
            preElectionCandidateScores[voteOnAddress] > 0,
            "Under the provided address there is no registered pre election candidate"
        );

        require(msg.sender != voteOnAddress, "You can't vote on yourself");

        if (preElectionVoter.voteCount == 0) {
            preElectionVoters.push(msg.sender);
            preElectionVotes[msg.sender] = PreElectionVoter(
                msg.sender,
                voteOnAddress,
                address(0),
                address(0),
                1
            );
        } else {
            require(
                !(preElectionVoter.candidate1 == voteOnAddress ||
                    preElectionVoter.candidate2 == voteOnAddress ||
                    preElectionVoter.candidate3 == voteOnAddress),
                "You can't vote on the same candidate more than once"
            );

            if (preElectionVoter.candidate2 == address(0)) {
                preElectionVotes[msg.sender].candidate2 = voteOnAddress;
            } else {
                preElectionVotes[msg.sender].candidate3 = voteOnAddress;
            }

            preElectionVotes[msg.sender].voteCount++;
        }
        preElectionCandidateScores[voteOnAddress]++;
    }

    function voteOnElections(address voteOnAddress) public onlyRole(CITIZEN) {
        require(
            0 == preElectionsStartDate,
            "Pre elections not yet closed or scheduled"
        );
        require(
            block.timestamp > electionsStartDate && electionsStartDate != 0,
            "Elections not yet started"
        );
        require(block.timestamp < electionsEndDate, "Elections already closed");
        require(msg.sender != voteOnAddress, "You can't vote on yourself");
        require(
            electionCandidateScores[voteOnAddress] > 0,
            "The provided account address not belong to any candidate"
        );
        require(electionVotes[msg.sender] == address(0), "You already voted");

        electionVotes[msg.sender] = voteOnAddress;
        electionVoters.push(msg.sender);
        electionCandidateScores[voteOnAddress]++;
    }

    function getPoliticalActors() public view returns (address[] memory) {
        return politicalActors;
    }

    function getPreElectionCandidatesSize() public view returns (uint256) {
        return preElectionCandidates.length;
    }

    function getPreElectionVotersSize() public view returns (uint256) {
        return preElectionVoters.length;
    }

    function getElectionCandidatesSize() public view returns (uint256) {
        return electionCandidates.length;
    }

    function getElectionVotersSize() public view returns (uint256) {
        return electionVoters.length;
    }
}
