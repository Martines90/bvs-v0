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

    struct ProConArticle {
        bool isArticleApproved;
        bool isResponseApproved;
        address publisher;
        string articleIpfsHash;
        bool isVoteOnA;
        string responseStatementIpfsHash;
    }

    struct Voting {
        bool approved;
        bool cancelled;
        bytes32 key;
        address creator;
        string contentIpfsHash;
        uint256 startDate; // 10 days before start date critics can appear
        uint64 voteOnAScore;
        uint64 voteOnBScore;
    }

    struct Vote {
        address account;
        bool approved;
        bytes32 votingId;
        mapping(bytes32 => string) proofOfArticleAndResponseRead;
        string proofOfVotingRead;
    }

    struct ProConArticleCompleteRequest {
        bytes32 articleId;
        bytes32 voringId;
        string ipfsHash;
        bool approved;
    }

    mapping(address => ProConArticleCompleteRequest)
        public proConArticleCompleteRequests;

    mapping(uint16 => mapping(address => uint16))
        public votingCycleStartVoteCount;

    mapping(address => mapping(bytes32 => uint16))
        public publishArticleToVotingsCount;

    uint16[] public votingCycleIndexes;

    mapping(bytes32 => Voting) public votings;
    mapping(bytes32 => mapping(bytes32 => ProConArticle)) public proConArticles;

    bytes32[] public votingKeys;
    bytes32[] public articleKeys;

    constructor() BVS_Roles() {}

    function setFirstVotingCycleStartDate(
        uint256 _firstVotingCycleStartDate
    ) public onlyRole(ADMINISTRATOR) {
        require(
            _firstVotingCycleStartDate > block.timestamp,
            "Voting cycle start date has to be in the future"
        );
        firstVotingCycleStartDate = _firstVotingCycleStartDate;

        // reset votingCycleStartVoteCount;
        for (uint16 i = 0; i < votingCycleIndexes.length; i++) {
            for (uint u = 0; u < politicalActors.length; u++) {
                delete votingCycleStartVoteCount[votingCycleIndexes[i]][
                    politicalActors[u]
                ];
            }
        }

        votingCycleIndexes = new uint16[](0);
    }

    function scheduleNewVoting(
        string calldata _contentIpfsHash,
        uint256 _startDate
    ) public onlyRole(POLITICAL_ACTOR) {
        require(
            firstVotingCycleStartDate < block.timestamp &&
                firstVotingCycleStartDate != 0,
            "Start new voting period is not yet active"
        );
        require(
            _startDate > block.timestamp + 10 days,
            "New voting has to be scheduled 10 days later from now"
        );
        require(
            _startDate < block.timestamp + VOTING_CYCLE_INTERVAL,
            "New voting start date can only be scheduled within 30 days ahead"
        );
        uint256 timePassed = block.timestamp - firstVotingCycleStartDate;
        uint16 votingCycleCount = uint16(timePassed / VOTING_CYCLE_INTERVAL);
        console.log(
            "votingCycleCount:",
            votingCycleCount,
            "timePassed:",
            timePassed
        );
        require(
            timePassed - votingCycleCount * VOTING_CYCLE_INTERVAL <
                VOTING_CYCLE_INTERVAL - 10 days,
            "You can't start new voting 10 days or less before the ongoing voting cycle ends"
        );
        require(
            politicalActorProfiles[msg.sender].votingCycleTotalCredits >
                votingCycleStartVoteCount[votingCycleCount][msg.sender],
            "You ran out of start new voting credits in this voting cycle"
        );

        votingCycleStartVoteCount[votingCycleCount][msg.sender]++;

        bytes32 _votingKey = keccak256(
            abi.encodePacked(
                Strings.toString(block.timestamp),
                msg.sender,
                _contentIpfsHash
            )
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

    /**
     * If you cancel your voting you can't get back your voting credit
     * @param _votingKey - identifies a registered voting
     */
    function cancelMyVoting(
        bytes32 _votingKey
    ) public onlyRole(POLITICAL_ACTOR) {
        require(
            votings[_votingKey].creator == msg.sender,
            "Only the creator of the voting is allowed to cancel it"
        );
        require(
            votings[_votingKey].startDate > block.timestamp,
            "Your voting start date alredy passed"
        );
        votings[_votingKey].cancelled = true;
    }

    function approveVoting(bytes32 _votingKey) public onlyRole(ADMINISTRATOR) {
        votings[_votingKey].approved = true;
    }

    function publishProConArticle(
        bytes32 votingKey,
        string memory ipfsHash,
        bool isVoteOnA
    ) public onlyRole(POLITICAL_ACTOR) {
        require(
            publishArticleToVotingsCount[msg.sender][votingKey] <
                politicalActorProfiles[msg.sender].votingCycleTotalCredits,
            "You don't have more credit (related to this voting) to publish"
        );

        bytes32 _articleKey = keccak256(
            abi.encodePacked(
                Strings.toString(block.timestamp),
                msg.sender,
                ipfsHash
            )
        );

        proConArticles[votingKey][_articleKey] = ProConArticle(
            false,
            false,
            msg.sender,
            ipfsHash,
            isVoteOnA,
            ""
        );
        articleKeys.push(_articleKey);
        publishArticleToVotingsCount[msg.sender][votingKey]++;
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

    function getVotinCycleIndexesSize() public view returns (uint256) {
        return votingCycleIndexes.length;
    }

    function vote() public {}
}
