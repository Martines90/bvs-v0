// SPDX-License-Identifier: MIT

// pragma
pragma solidity ^0.8.9;

// imports
import "@thirdweb-dev/contracts/extension/Permissions.sol";

import "./BVS_Roles.sol";

import "hardhat/console.sol";

/**
 * @title Balanced Voting System: Voting contract
 * @author Márton Sándor Horváth, email: hmartonsandor{@}gmail.com
 * @notice
 * @dev
 */

contract BVS_Voting is BVS_Roles {
    uint256 public firstVotingCycleStartDate;
    uint256 public constant VOTING_CYCLE_INTERVAL = 30 days;
    uint256 public constant VOTING_DURATION = 14 days;

    struct Voting {
        bytes32 key;
        address creator;
        string title;
        string description;
        uint256 startDate; // 1 week before start date critics can appear
        uint256 creationDate;
        uint256 voteOnAScore;
        uint256 voteOnBScore;
    }

    mapping(uint16 => mapping(address => uint16)) public votingCycleVoteCount;
    uint16[] public votingCycleIndexes;

    mapping(bytes32 => Voting) public votings;
    bytes32[] public votingKeys;

    constructor() BVS_Roles() {}

    function setFirstVotingCycleStartDate(
        uint256 _firstVotingCycleStartDate
    ) internal onlyRole(ADMINISTRATOR) {
        firstVotingCycleStartDate = _firstVotingCycleStartDate;

        // reset votingCycleVoteCount;
    }

    function startNewVoting(
        string calldata _title,
        string calldata _description,
        uint256 _startDate
    ) public onlyRole(POLITICAL_ACTOR) {
        require(
            _startDate < block.timestamp - 10 days,
            "New voting has to be scheduled 10 days earlier to now"
        );
        uint256 timePassed = block.timestamp - firstVotingCycleStartDate;
        uint16 votingCycleCount = uint16(timePassed / VOTING_CYCLE_INTERVAL);
        require(
            timePassed - votingCycleCount * VOTING_CYCLE_INTERVAL <
                VOTING_CYCLE_INTERVAL - 10 days,
            "You can't start new voting 10 days or less before the ongoing voting cycle ends"
        );
        require(
            politicalActorProfiles[msg.sender].votingCycleTotalCredits >
                votingCycleVoteCount[votingCycleCount][msg.sender],
            "You ran out of start new voting credits in this voting cycle"
        );

        votingCycleVoteCount[votingCycleCount][msg.sender]++;

        bytes32 _votingKey = keccak256(
            abi.encodePacked(Strings.toString(block.timestamp), msg.sender)
        );
        votings[_votingKey] = Voting(
            _votingKey,
            msg.sender,
            _title,
            _description,
            _startDate,
            block.timestamp,
            0,
            0
        );
        votingKeys.push(_votingKey);
    }
}
