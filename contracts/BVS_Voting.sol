// SPDX-License-Identifier: MIT

// pragma
pragma solidity ^0.8.9;

import "./BVS_Roles.sol";
import "./BVS_Helpers.sol";

import "hardhat/console.sol";

/**
 * @title Balanced Voting System: Voting contract
 * @author Márton Sándor Horváth, email: hmartonsandor{@}gmail.com
 * @notice
 * @dev
 */

contract BVS_Voting is BVS_Roles {
    uint public firstVotingCycleStartDate;
    uint public constant VOTING_CYCLE_INTERVAL = 30 days;
    uint public constant VOTING_DURATION = 14 days;
    uint public constant APPROVE_VOTING_BEFORE_IT_STARTS_LIMIT = 3 days;
    uint public constant NEW_VOTING_PERIOD_MIN_SCHEDULE_AHEAD_TIME = 10 days;

    uint public constant MIN_TOTAL_CONTENT_READ_CHECK_ANSWER = 10;
    uint public constant VOTING_CHECK_ASKED_NUM_OF_QUESTIONS = 5;
    uint public constant ARTICLE_CHECK_ASKED_NUM_OF_QUESTIONS = 5;
    uint public constant ARTICLE_RESPONSE_CHECK_ASKED_NUM_OF_QUESTIONS = 5;

    uint public constant MIN_VOTE_SCORE = 5;
    uint public constant MIN_PERCENTAGE_OF_VOTES = 10;

    error NotYetActiveVoting();

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
        uint budget;
        uint voteCount;
        address creator;
        string contentIpfsHash;
        uint startDate; // 10 days before start date critics can appear
        uint voteOnAScore;
        uint voteOnBScore;
        string votingContentCheckQuizIpfsHash;
    }

    struct Vote {
        bool voted;
        bool isContentCompleted;
    }

    // article content check answers
    mapping(bytes32 => bytes32[]) public articleContentReadCheckAnswers; // article key => answers

    mapping(bytes32 => bytes32[]) public articleContentResponseReadCheckAnswers; // article key => answers

    mapping(bytes32 => bytes32[]) public votingContentReadCheckAnswers; // voting key => answers

    // track the number of votes political actors created during voting cycles
    mapping(uint => mapping(address => uint)) public votingCycleStartVoteCount;

    // track the number of articles published related to scheduled votings
    mapping(address => mapping(bytes32 => uint)) // political_actor =>  voting key => published articles count
        public publishArticleToVotingsCount;

    // register the voting cycle indexes in order to clear votingCycleStartVoteCount data
    uint[] public votingCycleIndexes;

    // store votings
    mapping(bytes32 => Voting) public votings;

    // store pro/con articles
    mapping(bytes32 => mapping(bytes32 => ProConArticle)) public proConArticles; // voting key => article key => article

    // register voting and article keys
    bytes32[] public votingKeys;
    bytes32[] public articleKeys;

    mapping(address => mapping(bytes32 => Vote)) public votes;

    mapping(address => bytes32[]) public articlesCompleted;
    mapping(address => bytes32[]) public articlesResponseCompleted;

    BVS_Helpers public immutable bvsHelpers;

    constructor() BVS_Roles() {
        bvsHelpers = new BVS_Helpers();
    }

    function setFirstVotingCycleStartDate(
        uint _firstVotingCycleStartDate
    ) public onlyRole(ADMINISTRATOR) {
        require(
            _firstVotingCycleStartDate > block.timestamp,
            "Voting cycle start date has to be in the future"
        );
        firstVotingCycleStartDate = _firstVotingCycleStartDate;

        // reset votingCycleStartVoteCount;
        for (uint i = 0; i < votingCycleIndexes.length; i++) {
            for (uint u = 0; u < politicalActors.length; u++) {
                delete votingCycleStartVoteCount[votingCycleIndexes[i]][
                    politicalActors[u]
                ];
            }
        }

        votingCycleIndexes = new uint[](0);
    }

    function scheduleNewVoting(
        string calldata _contentIpfsHash,
        uint _startDate,
        uint _budget
    ) public onlyRole(POLITICAL_ACTOR) {
        require(
            firstVotingCycleStartDate < block.timestamp &&
                firstVotingCycleStartDate != 0,
            "Start new voting period is not yet active"
        );
        require(
            _startDate >
                block.timestamp + NEW_VOTING_PERIOD_MIN_SCHEDULE_AHEAD_TIME,
            "New voting has to be scheduled 10 days later from now"
        );
        require(
            _startDate < block.timestamp + VOTING_CYCLE_INTERVAL,
            "New voting start date can only be scheduled within 30 days ahead"
        );
        uint timePassed = block.timestamp - firstVotingCycleStartDate;
        uint votingCycleCount = uint(timePassed / VOTING_CYCLE_INTERVAL);

        require(
            timePassed - votingCycleCount * VOTING_CYCLE_INTERVAL <
                VOTING_CYCLE_INTERVAL -
                    NEW_VOTING_PERIOD_MIN_SCHEDULE_AHEAD_TIME,
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

        votings[_votingKey].budget = _budget;
        votings[_votingKey].key = _votingKey;
        votings[_votingKey].creator = msg.sender;
        votings[_votingKey].contentIpfsHash = _contentIpfsHash;
        votings[_votingKey].startDate = _startDate;
        votings[_votingKey].voteOnAScore = 0;
        votings[_votingKey].voteOnBScore = 0;

        bool votingCycleIndexAlreadyAdded = false;
        for (uint i = 0; i < votingCycleIndexes.length; i++) {
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
            !isEmptyString(votings[_votingKey].votingContentCheckQuizIpfsHash),
            "No voting content check quiz ipfs assigned yet"
        );

        votingContentReadCheckAnswers[_votingKey].push(_keccak256HashedAnswer);
    }

    function approveVoting(bytes32 _votingKey) public onlyRole(ADMINISTRATOR) {
        votingShouldNotYetStarted(_votingKey);
        require(
            votings[_votingKey].startDate -
                APPROVE_VOTING_BEFORE_IT_STARTS_LIMIT <
                block.timestamp,
            "Voting can only be approved 3 days or less before it's start"
        );
        require(
            votingContentReadCheckAnswers[_votingKey].length >=
                MIN_TOTAL_CONTENT_READ_CHECK_ANSWER,
            "No enough content read quiz answer added"
        );
        // make sure the creator of the voting responded for all the ciritcal articles
        bool isRespondedAllTheCritics = true;
        uint articleKeysLength = articleKeys.length;

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
        articleShouldExists(_votingKey, _articleKey);
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
            !isEmptyString(
                proConArticles[_votingKey][_articleKey]
                    .articleContentCheckQuizIpfsHash
            ),
            "Article content check ipfs not assigned yet"
        );
        articleContentReadCheckAnswers[_articleKey].push(
            _keccak256HashedAnswer
        );
    }

    function approveArticle(
        bytes32 _votingKey,
        bytes32 _articleKey
    ) public onlyRole(ADMINISTRATOR) {
        votingShouldNotYetStarted(_votingKey);
        articleShouldExists(_votingKey, _articleKey);
        require(
            articleContentReadCheckAnswers[_articleKey].length >=
                MIN_TOTAL_CONTENT_READ_CHECK_ANSWER,
            "No enough content read check answers added"
        );
        proConArticles[_votingKey][_articleKey].isArticleApproved = true;
    }

    function publishProConArticleResponse(
        bytes32 _votingKey,
        bytes32 _proConArticleKey,
        string memory _ipfsHash
    ) public onlyRole(POLITICAL_ACTOR) {
        votingShouldNotYetStarted(_votingKey);

        require(
            votings[proConArticles[_votingKey][_proConArticleKey].votingKey]
                .creator == msg.sender,
            "This article not related to your voting"
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
            !isEmptyString(
                proConArticles[_votingKey][_articleKey]
                    .responseContentCheckQuizIpfsHash
            ),
            "Content check ipfs not assigned"
        );

        articleContentResponseReadCheckAnswers[_articleKey].push(
            _keccak256HashedAnswer
        );
    }

    function approveArticleResponse(
        bytes32 _votingKey,
        bytes32 _articleKey
    ) public onlyRole(ADMINISTRATOR) {
        votingShouldNotYetStarted(_votingKey);
        articleShouldExists(_votingKey, _articleKey);
        require(
            !isEmptyString(
                proConArticles[_votingKey][_articleKey]
                    .responseStatementIpfsHash
            ),
            "No response added yet"
        );
        require(
            articleContentResponseReadCheckAnswers[_articleKey].length >=
                MIN_TOTAL_CONTENT_READ_CHECK_ANSWER,
            "No enough content check answers"
        );
        proConArticles[_votingKey][_articleKey].isResponseApproved = true;
    }

    function completeVotingContentReadQuiz(
        bytes32 _votingKey,
        string[] memory _answers
    ) public onlyRole(CITIZEN) {
        uint[] memory answerIndexes = getAccountVotingQuizAnswerIndexes(
            _votingKey,
            msg.sender
        );

        bool isCorrect = isContentReadQuizCorrect(
            answerIndexes,
            votingContentReadCheckAnswers[_votingKey],
            _answers
        );

        require(isCorrect, "Some of your provided answers are wrong");
        votes[msg.sender][_votingKey].isContentCompleted = true;
    }

    function completeArticleReadQuiz(
        bytes32 _votingKey,
        bytes32 _articleKey,
        string[] memory _answers
    ) public onlyRole(CITIZEN) {
        require(
            !isBytes32ArrayContains(articlesCompleted[msg.sender], _articleKey),
            "You already completed this article quiz"
        );
        uint[] memory answerIndexes = getAccountArticleQuizAnswerIndexes(
            _votingKey,
            _articleKey,
            msg.sender
        );

        bool isCorrect = isContentReadQuizCorrect(
            answerIndexes,
            articleContentReadCheckAnswers[_articleKey],
            _answers
        );

        require(isCorrect, "Some of your provided answers are wrong");
        articlesCompleted[msg.sender].push(_articleKey);
    }

    function completeArticleResponseQuiz(
        bytes32 _votingKey,
        bytes32 _articleKey,
        string[] memory _answers
    ) public onlyRole(CITIZEN) {
        require(
            !isBytes32ArrayContains(
                articlesResponseCompleted[msg.sender],
                _articleKey
            ),
            "You already completed this article response quiz"
        );
        uint[]
            memory answerIndexes = getAccountArticleResponseQuizAnswerIndexes(
                _votingKey,
                _articleKey,
                msg.sender
            );

        bool isCorrect = isContentReadQuizCorrect(
            answerIndexes,
            articleContentResponseReadCheckAnswers[_articleKey],
            _answers
        );

        require(isCorrect, "Some of your provided answers are wrong");
        articlesResponseCompleted[msg.sender].push(_articleKey);
    }

    function voteOnVoting(
        bytes32 _votingKey,
        bool _voteOnA
    ) public onlyRole(CITIZEN) {
        // check if the actual voting is active / exists
        require(
            votings[_votingKey].startDate < block.timestamp &&
                votings[_votingKey].startDate + VOTING_DURATION >
                block.timestamp,
            "Voting is not yet started or it is already finished"
        );
        require(
            votings[_votingKey].approved,
            "Voting is not approved for some reason"
        );
        // check if voting content check quiz completed
        require(
            votes[msg.sender][_votingKey].isContentCompleted,
            "Content check quiz not completed"
        );
        // check if citizen already voted
        require(
            !votes[msg.sender][_votingKey].voted,
            "You already voted on this voting"
        );

        // calculate vote score

        uint voteScore = MIN_VOTE_SCORE;

        uint completedArticlesLength = articlesCompleted[msg.sender].length;

        uint numOfVoteOnACompletedArticleValue = 0;
        uint numOfVoteOnBCompletedArticleValue = 0;

        uint numOfVoteOnACompletedResponseValue = 0;
        uint numOfVoteOnBCompletedResponseValue = 0;

        for (uint i = 0; i < completedArticlesLength; i++) {
            ProConArticle memory completedProConArticle = proConArticles[
                _votingKey
            ][articlesCompleted[msg.sender][i]];
            if (completedProConArticle.votingKey == _votingKey) {
                if (completedProConArticle.isVoteOnA) {
                    numOfVoteOnACompletedArticleValue += 1;
                } else {
                    numOfVoteOnBCompletedArticleValue += 1;
                }
            }
        }

        uint completedArticlesResponseLength = articlesResponseCompleted[
            msg.sender
        ].length;
        for (uint u = 0; u < completedArticlesResponseLength; u++) {
            ProConArticle
                memory completedProConArticleWithResponse = proConArticles[
                    _votingKey
                ][articlesResponseCompleted[msg.sender][u]];
            if (completedProConArticleWithResponse.votingKey == _votingKey) {
                if (completedProConArticleWithResponse.isVoteOnA) {
                    numOfVoteOnACompletedResponseValue += 1;
                } else {
                    numOfVoteOnBCompletedResponseValue += 1;
                }
            }
        }

        voteScore += bvsHelpers.calculateExtraVotingScore(
            numOfVoteOnACompletedArticleValue,
            numOfVoteOnBCompletedArticleValue,
            numOfVoteOnACompletedResponseValue,
            numOfVoteOnBCompletedResponseValue
        );

        // add new vote
        if (_voteOnA) {
            votings[_votingKey].voteOnAScore += voteScore;
        } else {
            votings[_votingKey].voteOnBScore += voteScore;
        }

        votings[_votingKey].voteCount++;
        votes[msg.sender][_votingKey].voted = true;
    }

    function getAccountVotingQuizAnswerIndexes(
        bytes32 _votingKey,
        address _account
    ) public view returns (uint[] memory) {
        return
            getAccountQuizAnswerIndexes(
                votings[_votingKey].votingContentCheckQuizIpfsHash,
                votings[_votingKey].contentIpfsHash,
                votings[_votingKey].startDate,
                votingContentReadCheckAnswers[_votingKey].length,
                VOTING_CHECK_ASKED_NUM_OF_QUESTIONS,
                _account
            );
    }

    function getAccountArticleQuizAnswerIndexes(
        bytes32 _votingKey,
        bytes32 _articleKey,
        address _account
    ) public view returns (uint[] memory) {
        return
            getAccountQuizAnswerIndexes(
                proConArticles[_votingKey][_articleKey]
                    .articleContentCheckQuizIpfsHash,
                proConArticles[_votingKey][_articleKey].articleIpfsHash,
                votings[_votingKey].startDate,
                articleContentReadCheckAnswers[_articleKey].length,
                ARTICLE_CHECK_ASKED_NUM_OF_QUESTIONS,
                _account
            );
    }

    function getAccountArticleResponseQuizAnswerIndexes(
        bytes32 _votingKey,
        bytes32 _articleKey,
        address _account
    ) public view returns (uint[] memory) {
        return
            getAccountQuizAnswerIndexes(
                proConArticles[_votingKey][_articleKey]
                    .responseContentCheckQuizIpfsHash,
                proConArticles[_votingKey][_articleKey]
                    .responseStatementIpfsHash,
                votings[_votingKey].startDate,
                articleContentResponseReadCheckAnswers[_articleKey].length,
                ARTICLE_RESPONSE_CHECK_ASKED_NUM_OF_QUESTIONS,
                _account
            );
    }

    function isContentReadQuizCorrect(
        uint[] memory _answerIndexes,
        bytes32[] memory _readCheckAnswers,
        string[] memory _answers
    ) public view onlyRole(CITIZEN) returns (bool) {
        bool areAnswersCorrect = true;

        for (uint i = 0; i < _answerIndexes.length; i++) {
            if (
                _readCheckAnswers[_answerIndexes[i] - 1] !=
                keccak256(bytes(_answers[i]))
            ) {
                areAnswersCorrect = false;
            }
        }

        return areAnswersCorrect;
    }

    function getAccountQuizAnswerIndexes(
        string memory ipfsHash1,
        string memory ipfsHash2,
        uint _date,
        uint _numOfTotalQuestions,
        uint _numOfQuiestionsToAsk,
        address _account
    ) internal pure returns (uint[] memory) {
        bytes32 hashCode = keccak256(
            abi.encodePacked(ipfsHash1, ipfsHash2, _account)
        );

        uint numOfVotingQuizQuestions = uint(_numOfTotalQuestions);

        uint[] memory questionsToAsk = new uint[](_numOfQuiestionsToAsk);

        uint countAddedQuestions = 0;
        for (
            uint i = uint(_date % numOfVotingQuizQuestions);
            countAddedQuestions < _numOfQuiestionsToAsk;
            i++
        ) {
            uint questionNth = (uint8(hashCode[i]) % numOfVotingQuizQuestions) +
                1;

            uint u = 0;
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

    function isVotingWon(
        bytes32 _votingKey,
        bool _isAWinExpected
    ) public view returns (bool) {
        require(
            votings[_votingKey].startDate + VOTING_DURATION < block.timestamp,
            "Voting is not yet started or it is already ongoing"
        );
        require(votings[_votingKey].approved, "Voting not approved");
        require(
            (votings[_votingKey].voteCount * 100) / citizens.length >
                MIN_PERCENTAGE_OF_VOTES,
            "No enough vote received"
        );
        if (_isAWinExpected) {
            return
                votings[_votingKey].voteOnAScore >
                votings[_votingKey].voteOnBScore;
        } else {
            return
                votings[_votingKey].voteOnBScore >
                votings[_votingKey].voteOnAScore;
        }
    }

    function articleShouldExists(
        bytes32 _votingKey,
        bytes32 _articleKey
    ) public view {
        require(
            proConArticles[_votingKey][_articleKey].publisher != address(0),
            "Article not exists"
        );
    }

    function votingShouldNotYetStarted(bytes32 _votingKey) public view {
        require(
            votings[_votingKey].startDate > block.timestamp,
            "Voting already started"
        );
    }

    function getVoting(bytes32 _votingKey) public view returns (Voting memory) {
        return votings[_votingKey];
    }

    function getVotingKeysLength() public view returns (uint) {
        return votingKeys.length;
    }

    function getArticleKeysLength() public view returns (uint) {
        return articleKeys.length;
    }

    function getVotinCycleIndexesSize() public view returns (uint) {
        return votingCycleIndexes.length;
    }

    function isBytes32ArrayContains(
        bytes32[] memory _array,
        bytes32 _item
    ) public pure returns (bool) {
        for (uint i = 0; i < _array.length; i++) {
            if (_array[i] == _item) {
                return true;
            }
        }
        return false;
    }

    function isEmptyString(string memory _string) public pure returns (bool) {
        return keccak256(bytes(_string)) == keccak256(bytes(""));
    }
}
