// SPDX-License-Identifier: MIT

// pragma
pragma solidity ^0.8.9;

library BVS_Constants {
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
}
