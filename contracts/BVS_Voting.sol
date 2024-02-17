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

    uint16 public constant MIN_TOTAL_CONTENT_READ_CHECK_ANSWER = 10;
    uint16 public constant VOTING_CHECK_ASKED_NUM_OF_QUESTIONS = 5;
    uint16 public constant ARTICLE_CHECK_ASKED_NUM_OF_QUESTIONS = 5;
    uint16 public constant ARTICLE_RESPONSE_CHECK_ASKED_NUM_OF_QUESTIONS = 5;

    struct ProConArticle {
        bytes32 votingKey;
        bool isArticleApproved; // admin approves
        bool isResponseApproved; // admin approves
        address publisher;
        string articleIpfsHash;
        bool isVoteOnA;
        string responseStatementIpfsHash; // addeed by the creator of the related voting
        string articleContentCheckQuizIpfsHash; // added by admin
        string responseContentCheckQuizIpfsHash; // added by admin
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
        string votingContentCheckQuizIpfsHash;
    }

    struct Vote {
        address account;
        bool approved;
        bytes32 votingId;
        mapping(bytes32 => string) proofOfArticleAndResponseRead;
        string proofOfVotingRead;
    }

    // article content check answers
    mapping(bytes32 => bytes32[]) public articleContentReadCheckAnswers; // article key => answers

    mapping(bytes32 => bytes32[]) public articleContentResponseReadCheckAnswers; // article key => answers

    mapping(bytes32 => bytes32[]) public votingContentReadCheckAnswers; // voting key => answers

    // track the number of votes political actors created during voting cycles
    mapping(uint16 => mapping(address => uint16))
        public votingCycleStartVoteCount;

    // track the number of articles published related to scheduled votings
    mapping(address => mapping(bytes32 => uint16)) // political_actor =>  voting key => published articles count
        public publishArticleToVotingsCount;

    // register the voting cycle indexes in order to clear votingCycleStartVoteCount data
    uint16[] public votingCycleIndexes;

    // store votings
    mapping(bytes32 => Voting) public votings;

    // store pro/con articles
    mapping(bytes32 => mapping(bytes32 => ProConArticle)) public proConArticles; // voting key => article key => article

    // register voting and article keys
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
            "Your voting start date already passed"
        );
        votings[_votingKey].cancelled = true;
    }

    function assignQuizIpfsHashToVoting(
        bytes32 _votingKey,
        string memory _quizIpfsHash
    ) public onlyRole(ADMINISTRATOR) {
        require(votings[_votingKey].creator != address(0), "Voting not exists");
        votings[_votingKey].votingContentCheckQuizIpfsHash = _quizIpfsHash;
    }

    function addKeccak256HashedAnswerToVotingContent(
        bytes32 _votingKey,
        bytes32 _keccak256HashedAnswer
    ) public onlyRole(ADMINISTRATOR) {
        require(
            keccak256(
                bytes(votings[_votingKey].votingContentCheckQuizIpfsHash)
            ) != keccak256(bytes("")),
            "No voting content check quiz ipfs assigned yet"
        );

        votingContentReadCheckAnswers[_votingKey].push(_keccak256HashedAnswer);
    }

    function approveVoting(bytes32 _votingKey) public onlyRole(ADMINISTRATOR) {
        require(
            votings[_votingKey].startDate > block.timestamp,
            "Voting can only be approved before it's start date"
        );
        require(
            votings[_votingKey].startDate - 3 days < block.timestamp,
            "Voting can only be approved 3 days or less before it's start"
        );
        require(
            votingContentReadCheckAnswers[_votingKey].length >=
                MIN_TOTAL_CONTENT_READ_CHECK_ANSWER,
            "You have to add at least the minimum number of content read check quiz answers"
        );
        // make sure the creator of the voting responded for all the ciritcal articles
        bool isRespondedAllTheCritics = true;
        uint256 articleKeysLength = articleKeys.length;

        for (uint i = 0; i < articleKeysLength; i++) {
            if (proConArticles[_votingKey][articleKeys[i]].isArticleApproved) {
                if (
                    !proConArticles[_votingKey][articleKeys[i]]
                        .isResponseApproved
                ) {
                    isRespondedAllTheCritics = false;
                    break;
                }
            }
        }
        require(
            isRespondedAllTheCritics,
            "Creator of the voting not yet responded on all the critics"
        );
        votings[_votingKey].approved = true;
    }

    function publishProConArticle(
        bytes32 _votingKey,
        string memory _ipfsHash,
        bool _isVoteOnA
    ) public onlyRole(POLITICAL_ACTOR) {
        require(
            publishArticleToVotingsCount[msg.sender][_votingKey] <
                politicalActorProfiles[msg.sender].votingCycleTotalCredits,
            "You don't have more credit (related to this voting) to publish"
        );

        bytes32 articleKey = keccak256(
            abi.encodePacked(
                Strings.toString(block.timestamp),
                msg.sender,
                _ipfsHash
            )
        );

        proConArticles[_votingKey][articleKey] = ProConArticle(
            _votingKey,
            false,
            false,
            msg.sender,
            _ipfsHash,
            _isVoteOnA,
            "",
            "",
            ""
        );
        articleKeys.push(articleKey);
        publishArticleToVotingsCount[msg.sender][_votingKey]++;
    }

    function assignQuizIpfsHashToArticleOrResponse(
        bytes32 _votingKey,
        bytes32 _articleKey,
        string memory _quizIpfsHash,
        bool assignToArticleContent
    ) public onlyRole(ADMINISTRATOR) {
        require(
            proConArticles[_votingKey][_articleKey].publisher != address(0),
            "Article not exists"
        );
        if (assignToArticleContent) {
            proConArticles[_votingKey][_articleKey]
                .articleContentCheckQuizIpfsHash = _quizIpfsHash;
        } else {
            proConArticles[_votingKey][_articleKey]
                .responseContentCheckQuizIpfsHash = _quizIpfsHash;
        }
    }

    function addKeccak256HashedAnswerToArticle(
        bytes32 _votingKey,
        bytes32 _articleKey,
        bytes32 _keccak256HashedAnswer
    ) public onlyRole(ADMINISTRATOR) {
        require(
            keccak256(
                bytes(
                    proConArticles[_votingKey][_articleKey]
                        .articleContentCheckQuizIpfsHash
                )
            ) != keccak256(bytes("")),
            "First article content check ipfs hash has to be assigned"
        );
        articleContentReadCheckAnswers[_articleKey].push(
            _keccak256HashedAnswer
        );
    }

    function approveArticle(
        bytes32 _votingKey,
        bytes32 _articleKey
    ) public onlyRole(ADMINISTRATOR) {
        require(
            votings[_votingKey].startDate > block.timestamp,
            "Voting already started"
        );
        require(
            proConArticles[_votingKey][_articleKey].publisher != address(0),
            "Article not exists"
        );
        require(
            articleContentReadCheckAnswers[_articleKey].length >=
                MIN_TOTAL_CONTENT_READ_CHECK_ANSWER,
            "You have to add at least the minimum number of content read check answers to this article"
        );
        proConArticles[_votingKey][_articleKey].isArticleApproved = true;
    }

    function publishProConArticleResponse(
        bytes32 _votingKey,
        bytes32 _proConArticleKey,
        string memory _ipfsHash
    ) public onlyRole(POLITICAL_ACTOR) {
        require(
            votings[_votingKey].startDate > block.timestamp,
            "Voting already started"
        );

        require(
            votings[proConArticles[_votingKey][_proConArticleKey].votingKey]
                .creator == msg.sender,
            "You can respond only articles what are related to your own votings"
        );

        proConArticles[_votingKey][_proConArticleKey]
            .responseStatementIpfsHash = _ipfsHash;
    }

    function addKeccak256HashedAnswerToArticleResponse(
        bytes32 _votingKey,
        bytes32 _articleKey,
        bytes32 _keccak256HashedAnswer
    ) public onlyRole(ADMINISTRATOR) {
        require(
            keccak256(
                bytes(
                    proConArticles[_votingKey][_articleKey]
                        .responseContentCheckQuizIpfsHash
                )
            ) != keccak256(bytes("")),
            "First article response content check ipfs hash has to be assigned"
        );

        articleContentResponseReadCheckAnswers[_articleKey].push(
            _keccak256HashedAnswer
        );
    }

    function approveArticleResponse(
        bytes32 _votingKey,
        bytes32 _articleKey
    ) public onlyRole(ADMINISTRATOR) {
        require(
            votings[_votingKey].startDate > block.timestamp,
            "Voting already started"
        );
        require(
            proConArticles[_votingKey][_articleKey].publisher != address(0),
            "Article not exists"
        );
        require(
            keccak256(
                bytes(
                    proConArticles[_votingKey][_articleKey]
                        .responseStatementIpfsHash
                )
            ) != keccak256(bytes("")),
            "No response belongs to this article"
        );
        require(
            articleContentResponseReadCheckAnswers[_articleKey].length >=
                MIN_TOTAL_CONTENT_READ_CHECK_ANSWER,
            "You have to add at least the minimum number of content response read check answers to this article"
        );
        proConArticles[_votingKey][_articleKey].isResponseApproved = true;
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

    function completeVotingQuiz(
        bytes32 _votingKey,
        string[] memory _answers
    ) public onlyRole(CITIZEN) {
        uint8[] memory answerIndexes = getAccountVotingQuizAnswerIndexes(
            _votingKey,
            msg.sender
        );
        bool areAnswersCorrect = true;
        for (uint8 i = 0; i < answerIndexes.length; i++) {
            if (
                votingContentReadCheckAnswers[_votingKey][answerIndexes[i]] !=
                keccak256(bytes(_answers[i]))
            ) {
                areAnswersCorrect = false;
            }
        }

        require(areAnswersCorrect, "Some of your provided answers are wrong");
    }

    function completeArticleQuiz(
        bytes32 _votingKey,
        bytes32 _articleKey,
        string[] memory _answers
    ) public onlyRole(CITIZEN) {}

    function completeArticleReponseQuiz(
        bytes32 _votingKey,
        bytes32 _articleKey,
        string[] memory _answers
    ) public onlyRole(CITIZEN) {}

    function vote(bytes32 _votingKey, bool _voteOnA) public onlyRole(CITIZEN) {
        // check if the actual voting is active
        // check if voter assigned answers are correct
        // check if there is any related article + article respons and calculate the final voting score
    }

    function getAccountVotingQuizAnswerIndexes(
        bytes32 _votingKey,
        address _account
    ) public view returns (uint8[] memory) {
        bytes32 hashCode = keccak256(
            abi.encodePacked(
                votings[_votingKey].votingContentCheckQuizIpfsHash,
                votings[_votingKey].contentIpfsHash,
                _account
            )
        );

        uint8 numOfVotingQuizQuestions = uint8(
            votingContentReadCheckAnswers[_votingKey].length
        );

        uint8[] memory questionsToAsk = new uint8[](
            VOTING_CHECK_ASKED_NUM_OF_QUESTIONS
        );

        uint8 countAddedQuestions = 0;
        for (
            uint8 i = uint8(
                votings[_votingKey].startDate % numOfVotingQuizQuestions
            );
            countAddedQuestions < VOTING_CHECK_ASKED_NUM_OF_QUESTIONS;
            i++
        ) {
            uint8 questionNth = (uint8(hashCode[i]) %
                numOfVotingQuizQuestions) + 1;

            uint8 u = 0;
            do {
                if (questionsToAsk[u] == questionNth) {
                    questionNth++;
                    u = 0;
                    if (questionNth > numOfVotingQuizQuestions) {
                        questionNth = 1;
                    }
                } else {
                    u++;
                }
            } while (u < countAddedQuestions);

            questionsToAsk[countAddedQuestions] = questionNth;
            countAddedQuestions++;
        }

        return questionsToAsk;
    }

    function getVotinCycleIndexesSize() public view returns (uint256) {
        return votingCycleIndexes.length;
    }
}
