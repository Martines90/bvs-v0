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

    struct ProConCritic {
        bool isArticleApproved;
        bool isResponseApproved;
        bytes32 key;
        address publisher;
        string title;
        string articleIpfsHash;
        bool isVoteOnA;
        string responseStatementIpfsHash;
    }

    struct Voting {
        bool approved;
        bytes32 key;
        address creator;
        string contentIpfsHash;
        uint256 startDate; // 10 days before start date critics can appear
        uint256 voteOnAScore;
        uint256 voteOnBScore;
    }

    struct Vote {
        address account;
        bool approved;
        bytes32 votingId;
        mapping(bytes32 => string) proofOfArticleAndResponseRead;
        string proofOfVotingRead;
    }

    mapping(uint16 => mapping(address => uint16)) public votingCycleVoteCount;
    uint16[] public votingCycleIndexes;

    mapping(bytes32 => Voting) public votings;
    mapping(bytes32 => ProConCritic[]) public proConCritics;

    bytes32[] public votingKeys;

    constructor() BVS_Roles() {}

    function setFirstVotingCycleStartDate(
        uint256 _firstVotingCycleStartDate
    ) internal onlyRole(ADMINISTRATOR) {
        firstVotingCycleStartDate = _firstVotingCycleStartDate;

        // reset votingCycleVoteCount;
        for (uint16 i = 0; i < votingCycleIndexes.length; i++) {
            for (uint u = 0; u < politicalActors.length; u++) {
                delete votingCycleVoteCount[votingCycleIndexes[i]][
                    politicalActors[u]
                ];
            }
        }

        votingCycleIndexes = new uint16[](0);
    }

    function requestNewVoting(
        string calldata _contentIpfsHash,
        uint256 _startDate
    ) public onlyRole(POLITICAL_ACTOR) {
        require(
            firstVotingCycleStartDate < block.timestamp &&
                firstVotingCycleStartDate != 0,
            "Start new votings period is not yet active"
        );
        require(
            _startDate > block.timestamp + 10 days,
            "New voting has to be scheduled 10 days earlier to now"
        );
        require(
            _startDate < block.timestamp + VOTING_CYCLE_INTERVAL,
            "New voting start date can only be scheduled within 30 days ahead"
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

        votings[_votingKey].key = _votingKey;
        votings[_votingKey].creator = msg.sender;
        votings[_votingKey].contentIpfsHash = _contentIpfsHash;
        votings[_votingKey].startDate = _startDate;
        votings[_votingKey].voteOnAScore = 0;
        votings[_votingKey].voteOnBScore = 0;

        bool votingCycleIndexAlreadyAdded = false;
        for (uint16 i = 0; i < votingCycleIndexes.length; i++) {
            if (votingCycleCount == votingCycleIndexes[i]) {
                votingCycleIndexAlreadyAdded = true;
                break;
            }
        }

        if (!votingCycleIndexAlreadyAdded) {
            votingCycleIndexes.push(votingCycleCount);
        }

        votingKeys.push(_votingKey);
    }

    function completeVotingAritcleAndResponse(
        bytes32 votingKey,
        string memory proofOfArticleRead,
        string memory proofOfResponseRead
    ) public {
        // word1|word2|word3|word4|word5
    }

    /**
     * getMyArticleCompletePuzzle generates a series of indexes marking the position of a word in the article
     * At article complete process Voter has to pick the first and last letter or these words from the article marked by this information.
     * This is a unique way to prove if voter read an article as nobody can copy, re use this answer
     * @param articleWordCount This is the total number of words what the article contains
     * @param articleIpfsHash This is the hash id of the article stored in an ipfs network
     */

    function getMyArticleCompletePuzzle(
        uint256 articleWordCount,
        string memory articleIpfsHash
    ) public view returns (string memory) {
        string memory puzzle;

        bytes32 hashCode = keccak256(
            abi.encodePacked(articleIpfsHash, msg.sender, articleWordCount)
        );

        uint256 total = 1;
        for (uint i = 0; i < hashCode.length; i++) {
            uint8 item = uint8(hashCode[i]);
            if (i % 2 == 0) {
                total *= item;
            } else {
                total += item;
            }

            if ((i + 1) % 4 == 0) {
                uint256 wordIndex = (total % articleWordCount) + 1;
                puzzle = string.concat(
                    puzzle,
                    "|",
                    Strings.toString(wordIndex)
                );
                total = 1;
            }
        }

        return puzzle;
    }

    function vote() public {}
}
