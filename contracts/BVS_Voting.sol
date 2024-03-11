// SPDX-License-Identifier: MIT

// pragma
pragma solidity ^0.8.9;

import "./BVS_Roles.sol";
import "./BVS_Helpers.sol";

import "./BVS_Funding.sol";
import "./BVS_Elections.sol";

import "hardhat/console.sol";

/**
 * @title Balanced Voting System: Voting contract
 * @author Márton Sándor Horváth, email: hmartonsandor{@}gmail.com
 * @notice
 * @dev
 */

contract BVS_Voting is BVS_Roles {
    // CONSTANTS

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

    uint public firstVotingCycleStartDate;

    // DATA OBJECTS

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

    BVS_Elections public immutable bvsElections;
    BVS_Funding public immutable bvsFuding;

    // ERRORS **************************************************************

    error VotingAlreadyStarted();
    error VotingCanBeApproved3DaysOrLessBeforeItsStart();

    error ArticleNotExists();
    error ArticleNotRelatedToYourVoting();
    error ContentCheckIpfsNotAssigned();
    error NoArticleContentCheckIpfsAssignedToThisArticle();

    error NoArticleResponseAssigned();
    error NoArticleResponseContentCheckIpfsAssigned();
    error NoMorePublishArticleCreditsRelatedToThisVoting();

    error NoEnoughContentReadQuizAnswerAdded();

    error FirstVotingCycleStartDateHasToBeInTheFuture();
    error NoOngoingVotingPeriod();
    error NewVotingHasToBeScheduled10DaysAhead();
    error NewVotingHasToBeScheduledLessThan30daysAhead();

    error VotingNotExists();
    error VotingNotYetStartedOrAlreadyFinished();
    error VotingNotBelongsToSender();
    error VotingDidNotWon();
    error VotingNotFinished();
    error VotingNotApproved();
    error VotingContentCheckQuizNotCompleted();
    error AlreadyVotedOnThisVoting();
    error NoEnoughVotesReceived();
    error VotingContentCheckQuizNotAssigned();
    error VotingOwnerNotRespondedOnAllArticles();

    modifier criticisedArticleRelatedToYourVoting(
        bytes32 _votingKey,
        bytes32 _proConArticleKey
    ) {
        if (
            votings[proConArticles[_votingKey][_proConArticleKey].votingKey]
                .creator != msg.sender
        ) revert ArticleNotRelatedToYourVoting();
        _;
    }

    modifier hasContentIpfs(bytes32 _votingKey, bytes32 _articleKey) {
        if (
            isEmptyString(
                proConArticles[_votingKey][_articleKey]
                    .responseContentCheckQuizIpfsHash
            )
        ) revert ContentCheckIpfsNotAssigned();
        _;
    }

    modifier firstVotingCycleStartDateIsInTheFuture(
        uint _firstVotingCycleStartDate
    ) {
        if (_firstVotingCycleStartDate < block.timestamp) {
            revert FirstVotingCycleStartDateHasToBeInTheFuture();
        }
        _;
    }

    modifier votingNotYetStarted(bytes32 _votingKey) {
        if (votings[_votingKey].startDate < block.timestamp) {
            revert VotingAlreadyStarted();
        }
        _;
    }

    modifier votingWon(bytes32 _votingKey) {
        if (!isVotingWon(_votingKey, true)) {
            revert VotingDidNotWon();
        }
        _;
    }

    modifier votingBelongsToSender(bytes32 _votingKey) {
        if (getVoting(_votingKey).creator != msg.sender) {
            revert VotingNotBelongsToSender();
        }
        _;
    }

    modifier votingNotFinished(bytes32 _votingKey) {
        if (votings[_votingKey].startDate + VOTING_DURATION > block.timestamp) {
            revert VotingNotFinished();
        }
        _;
    }

    modifier votingApproved(bytes32 _votingKey) {
        if (!votings[_votingKey].approved) {
            revert VotingNotApproved();
        }
        _;
    }

    modifier enoughVotesArrived(bytes32 _votingKey) {
        if (
            (votings[_votingKey].voteCount * 100) / citizens.length <
            MIN_PERCENTAGE_OF_VOTES
        ) {
            revert NoEnoughVotesReceived();
        }
        _;
    }

    modifier votingExists(bytes32 _votingKey) {
        if (votings[_votingKey].creator == address(0)) {
            revert VotingNotExists();
        }
        _;
    }

    modifier votingPeriodIsActive() {
        if (
            firstVotingCycleStartDate > block.timestamp ||
            firstVotingCycleStartDate == 0
        ) {
            revert NoOngoingVotingPeriod();
        }
        _;
    }

    modifier votingIsOngoing(bytes32 _votingKey) {
        if (
            votings[_votingKey].startDate > block.timestamp ||
            votings[_votingKey].startDate + VOTING_DURATION < block.timestamp
        ) {
            revert VotingNotYetStartedOrAlreadyFinished();
        }
        _;
    }

    modifier contentCheckQuizCompleted(bytes32 _votingKey) {
        if (!votes[msg.sender][_votingKey].isContentCompleted) {
            revert VotingContentCheckQuizNotCompleted();
        }
        _;
    }

    modifier notVotedYetOnThisVoting(bytes32 _votingKey) {
        if (votes[msg.sender][_votingKey].voted) {
            revert AlreadyVotedOnThisVoting();
        }
        _;
    }

    modifier newVotingScheduledAtLeast10daysAhead(uint _startDate) {
        if (
            _startDate <
            block.timestamp + NEW_VOTING_PERIOD_MIN_SCHEDULE_AHEAD_TIME
        ) {
            revert NewVotingHasToBeScheduled10DaysAhead();
        }
        _;
    }

    modifier newVotingScheduledMaximum30daysAhead(uint _startDate) {
        if (_startDate > block.timestamp + VOTING_CYCLE_INTERVAL) {
            revert NewVotingHasToBeScheduledLessThan30daysAhead();
        }
        _;
    }

    modifier votingContentQuizIpfsAssigned(bytes32 _votingKey) {
        if (isEmptyString(votings[_votingKey].votingContentCheckQuizIpfsHash)) {
            revert VotingContentCheckQuizNotAssigned();
        }
        _;
    }

    modifier creatorOfVotingRespondedOnArticles(bytes32 _votingKey) {
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
        if (!isRespondedAllTheCritics) {
            revert VotingOwnerNotRespondedOnAllArticles();
        }
        _;
    }

    modifier approveAttempt3DaysBeforeVotingStarts(bytes32 _votingKey) {
        if (
            votings[_votingKey].startDate -
                APPROVE_VOTING_BEFORE_IT_STARTS_LIMIT >
            block.timestamp
        ) {
            revert VotingCanBeApproved3DaysOrLessBeforeItsStart();
        }
        _;
    }

    modifier enoughContentReadQuizAnswerAdded(
        bytes32[] memory _keccak256HashedAnswers
    ) {
        if (
            _keccak256HashedAnswers.length < MIN_TOTAL_CONTENT_READ_CHECK_ANSWER
        ) {
            revert NoEnoughContentReadQuizAnswerAdded();
        }
        _;
    }

    modifier hasArticleContentIpfsHashAssigned(
        bytes32 _votingKey,
        bytes32 _articleKey
    ) {
        if (
            isEmptyString(
                proConArticles[_votingKey][_articleKey]
                    .articleContentCheckQuizIpfsHash
            )
        ) {
            revert NoArticleContentCheckIpfsAssignedToThisArticle();
        }
        _;
    }

    modifier articleShouldExists(bytes32 _votingKey, bytes32 _articleKey) {
        if (proConArticles[_votingKey][_articleKey].publisher == address(0)) {
            revert ArticleNotExists();
        }
        _;
    }

    modifier hasArticleReponseAssigned(
        bytes32 _votingKey,
        bytes32 _articleKey
    ) {
        if (
            isEmptyString(
                proConArticles[_votingKey][_articleKey]
                    .responseStatementIpfsHash
            )
        ) {
            revert NoArticleResponseAssigned();
        }
        _;
    }

    modifier hasArticleResponseContentCheckIpfsHash(
        bytes32 _votingKey,
        bytes32 _articleKey
    ) {
        if (
            isEmptyString(
                proConArticles[_votingKey][_articleKey]
                    .responseContentCheckQuizIpfsHash
            )
        ) {
            revert NoArticleResponseContentCheckIpfsAssigned();
        }
        _;
    }

    modifier hasCreditsLeftToPublishArticle(bytes32 _votingKey) {
        if (
            publishArticleToVotingsCount[msg.sender][_votingKey] >=
            politicalActorVotingCredits[msg.sender]
        ) {
            revert NoMorePublishArticleCreditsRelatedToThisVoting();
        }
        _;
    }

    // CONTRACT LOGIC *****************************************************************

    constructor(address priceFeed) BVS_Roles() {
        bvsHelpers = new BVS_Helpers();
        bvsElections = new BVS_Elections();
        bvsElections.sendGrantAdministratorRoleApproval(msg.sender);
        bvsElections.grantCitizenRole(msg.sender, false);
        bvsFuding = new BVS_Funding(priceFeed);
    }

    function fund(string memory email) public payable {
        bvsFuding.addFunder(msg.value, email);
    }

    function _grantCitizenRole(
        address _account
    ) public onlyRole(ADMINISTRATOR) {
        grantCitizenRole(_account, false);
        bvsElections.grantCitizenRole(_account, false);
    }

    function _grantAdminRole(address _account) public onlyRole(ADMINISTRATOR) {
        sendGrantAdministratorRoleApproval(_account);
        bvsElections.sendGrantAdministratorRoleApproval(_account);
    }

    function _revokeAdminRoleApproval(
        address _account
    ) public onlyRole(ADMINISTRATOR) {
        revokeAdminRoleApproval(_account);
        bvsElections.revokeAdminRoleApproval(_account);
    }

    function unlockVotingBudget(
        bytes32 _votingKey
    )
        public
        onlyRole(POLITICAL_ACTOR)
        votingBelongsToSender(_votingKey)
        votingWon(_votingKey)
    {
        (bool callSuccess, ) = payable(msg.sender).call{
            value: getVoting(_votingKey).budget
        }("");
        require(callSuccess, "Call failed");

        votings[_votingKey].budget = 0; // make sure no more money can be requested
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

    function setFirstVotingCycleStartDate(
        uint _firstVotingCycleStartDate
    )
        public
        onlyRole(ADMINISTRATOR)
        firstVotingCycleStartDateIsInTheFuture(_firstVotingCycleStartDate)
    {
        // reset votingCycleStartVoteCount;
        for (uint i = 0; i < votingCycleIndexes.length; i++) {
            for (uint u = 0; u < politicalActors.length; u++) {
                delete votingCycleStartVoteCount[votingCycleIndexes[i]][
                    politicalActors[u]
                ];
            }
        }

        votingCycleIndexes = new uint[](0);

        firstVotingCycleStartDate = _firstVotingCycleStartDate;
    }

    function scheduleNewVoting(
        string calldata _contentIpfsHash,
        uint _startDate,
        uint _budget
    )
        public
        onlyRole(POLITICAL_ACTOR)
        votingPeriodIsActive
        newVotingScheduledAtLeast10daysAhead(_startDate)
        newVotingScheduledMaximum30daysAhead(_startDate)
    {
        uint timePassed = block.timestamp - firstVotingCycleStartDate;
        uint votingCycleCount = uint(timePassed / VOTING_CYCLE_INTERVAL);

        require(
            timePassed - votingCycleCount * VOTING_CYCLE_INTERVAL <
                VOTING_CYCLE_INTERVAL -
                    NEW_VOTING_PERIOD_MIN_SCHEDULE_AHEAD_TIME,
            "You can't start new voting 10 days or less before the ongoing voting cycle ends"
        );
        require(
            politicalActorVotingCredits[msg.sender] >
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
    ) public onlyRole(ADMINISTRATOR) votingExists(_votingKey) {
        votings[_votingKey].votingContentCheckQuizIpfsHash = _quizIpfsHash;
    }

    function addKeccak256HashedAnswersToVotingContent(
        bytes32 _votingKey,
        bytes32[] memory _keccak256HashedAnswers
    )
        public
        onlyRole(ADMINISTRATOR)
        votingContentQuizIpfsAssigned(_votingKey)
        enoughContentReadQuizAnswerAdded(_keccak256HashedAnswers)
    {
        votingContentReadCheckAnswers[_votingKey] = _keccak256HashedAnswers;
    }

    function approveVoting(
        bytes32 _votingKey
    )
        public
        onlyRole(ADMINISTRATOR)
        votingNotYetStarted(_votingKey)
        approveAttempt3DaysBeforeVotingStarts(_votingKey)
        enoughContentReadQuizAnswerAdded(
            votingContentReadCheckAnswers[_votingKey]
        )
        creatorOfVotingRespondedOnArticles(_votingKey)
    {
        votings[_votingKey].approved = true;
    }

    function publishProConArticle(
        bytes32 _votingKey,
        string memory _ipfsHash,
        bool _isVoteOnA
    )
        public
        onlyRole(POLITICAL_ACTOR)
        hasCreditsLeftToPublishArticle(_votingKey)
    {
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
    )
        public
        onlyRole(ADMINISTRATOR)
        articleShouldExists(_votingKey, _articleKey)
    {
        if (assignToArticleContent) {
            proConArticles[_votingKey][_articleKey]
                .articleContentCheckQuizIpfsHash = _quizIpfsHash;
        } else {
            proConArticles[_votingKey][_articleKey]
                .responseContentCheckQuizIpfsHash = _quizIpfsHash;
        }
    }

    function addKeccak256HashedAnswersToArticle(
        bytes32 _votingKey,
        bytes32 _articleKey,
        bytes32[] memory _keccak256HashedAnswers
    )
        public
        onlyRole(ADMINISTRATOR)
        hasArticleContentIpfsHashAssigned(_votingKey, _articleKey)
        enoughContentReadQuizAnswerAdded(_keccak256HashedAnswers)
    {
        proConArticles[_votingKey][_articleKey].isArticleApproved = true;
        articleContentReadCheckAnswers[_articleKey] = _keccak256HashedAnswers;
    }

    function publishProConArticleResponse(
        bytes32 _votingKey,
        bytes32 _proConArticleKey,
        string memory _ipfsHash
    )
        public
        onlyRole(POLITICAL_ACTOR)
        votingNotYetStarted(_votingKey)
        criticisedArticleRelatedToYourVoting(_votingKey, _proConArticleKey)
    {
        proConArticles[_votingKey][_proConArticleKey]
            .responseStatementIpfsHash = _ipfsHash;
    }

    function addKeccak256HashedAnswersToArticleResponse(
        bytes32 _votingKey,
        bytes32 _articleKey,
        bytes32[] memory _keccak256HashedAnswers
    )
        public
        onlyRole(ADMINISTRATOR)
        articleShouldExists(_votingKey, _articleKey)
        hasArticleReponseAssigned(_votingKey, _articleKey)
        hasArticleResponseContentCheckIpfsHash(_votingKey, _articleKey)
        votingNotYetStarted(_votingKey)
        enoughContentReadQuizAnswerAdded(_keccak256HashedAnswers)
    {
        articleContentResponseReadCheckAnswers[
            _articleKey
        ] = _keccak256HashedAnswers;
        proConArticles[_votingKey][_articleKey].isResponseApproved = true;
    }

    function completeContentReadQuiz(
        uint contentType,
        bytes32 _votingKey,
        bytes32 _articleKey,
        string[] memory _answers
    ) public onlyRole(CITIZEN) {
        uint[] memory answerIndexes;
        bool isCorrect;

        // voting
        if (contentType == 1) {
            answerIndexes = getAccountVotingQuizAnswerIndexes(
                _votingKey,
                msg.sender
            );

            isCorrect = isContentReadQuizCorrect(
                answerIndexes,
                votingContentReadCheckAnswers[_votingKey],
                _answers
            );
            votes[msg.sender][_votingKey].isContentCompleted = true;
        }
        // article
        else if (contentType == 2) {
            answerIndexes = getAccountArticleQuizAnswerIndexes(
                _votingKey,
                _articleKey,
                msg.sender
            );

            isCorrect = isContentReadQuizCorrect(
                answerIndexes,
                articleContentReadCheckAnswers[_articleKey],
                _answers
            );
            articlesCompleted[msg.sender].push(_articleKey);
            // article respond
        } else if (contentType == 3) {
            answerIndexes = getAccountArticleResponseQuizAnswerIndexes(
                _votingKey,
                _articleKey,
                msg.sender
            );

            isCorrect = isContentReadQuizCorrect(
                answerIndexes,
                articleContentResponseReadCheckAnswers[_articleKey],
                _answers
            );

            articlesResponseCompleted[msg.sender].push(_articleKey);
        }

        require(isCorrect, "Some of your provided answers are wrong");
    }

    function calculateVoteScore(
        bytes32 _votingKey,
        address _account
    ) public view returns (uint) {
        uint voteScore = MIN_VOTE_SCORE;

        uint completedArticlesLength = articlesCompleted[_account].length;

        uint numOfVoteOnACompletedArticleValue = 0;
        uint numOfVoteOnBCompletedArticleValue = 0;

        uint numOfVoteOnACompletedResponseValue = 0;
        uint numOfVoteOnBCompletedResponseValue = 0;

        for (uint i = 0; i < completedArticlesLength; i++) {
            ProConArticle memory completedProConArticle = proConArticles[
                _votingKey
            ][articlesCompleted[_account][i]];
            if (completedProConArticle.votingKey == _votingKey) {
                if (completedProConArticle.isVoteOnA) {
                    numOfVoteOnACompletedArticleValue += 1;
                } else {
                    numOfVoteOnBCompletedArticleValue += 1;
                }
            }
        }

        uint completedArticlesResponseLength = articlesResponseCompleted[
            _account
        ].length;
        for (uint u = 0; u < completedArticlesResponseLength; u++) {
            ProConArticle
                memory completedProConArticleWithResponse = proConArticles[
                    _votingKey
                ][articlesResponseCompleted[_account][u]];
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
        return voteScore;
    }

    function voteOnVoting(
        bytes32 _votingKey,
        bool _voteOnA
    )
        public
        onlyRole(CITIZEN)
        votingIsOngoing(_votingKey)
        votingApproved(_votingKey)
        contentCheckQuizCompleted(_votingKey)
        notVotedYetOnThisVoting(_votingKey)
    {
        // calculate vote score
        uint voteScore = calculateVoteScore(_votingKey, msg.sender);

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
    )
        public
        view
        votingNotFinished(_votingKey)
        votingApproved(_votingKey)
        enoughVotesArrived(_votingKey)
        returns (bool)
    {
        if (_isAWinExpected) {
            return
                votings[_votingKey].voteOnAScore >=
                votings[_votingKey].voteOnBScore;
        } else {
            return
                votings[_votingKey].voteOnBScore >
                votings[_votingKey].voteOnAScore;
        }
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

    function isEmptyString(string memory _string) public pure returns (bool) {
        return keccak256(bytes(_string)) == keccak256(bytes(""));
    }
}
