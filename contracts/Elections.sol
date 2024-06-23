// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./interfaces/IElections.sol";
import "./interfaces/IChristianState.sol";
import "./interfaces/IChurchCommunity.sol";

contract Elections is IElections {
    uint public constant PRE_ELECTION_REGISTRATION_STARTS_BEFORE_START_DAYS =
        90 days;

    uint public constant ELECTIONS_VOTING_DAYS = 7 days;

    uint public constant PRE_ELECTIONS_VOTING_DAYS = 14 days;

    uint public constant PRE_ELECTIONS_ELECTIONS_GAP_DAYS = 10 days;

    address public immutable stateAddress;

    error ChurchCommunityNotApprovedByState();
    error AccountIsNotTheHeadOfTheCurchCommunity();
    error AccountAlreadyAppliedForPreElection();

    error ElectionNotYetScheduled();
    error PreElectionStartAlreadyPassed();
    error PreElectionPeriodIsNotYetOpen();

    mapping(address => uint) preElectionCandidateVoteScores;
    address[] preElectionCandidates;

    uint public electionStartDate;

    struct CandidateInfo {
        address churchCommunityAddress;
        string programShortVersionIpfsHash;
        string programLongVersionIpfsHash;
    }

    mapping(address => CandidateInfo) candidatesInfo;

    modifier churchCommunityApprovedByState() {
        if (
            !IChristianState(stateAddress).isChurchCommunityApprovedByState(
                msg.sender
            )
        ) {
            revert ChurchCommunityNotApprovedByState();
        }
        _;
    }

    modifier accountIsHeadOfChurchCommunity(address applicantAccount) {
        if (
            IChurchCommunity(msg.sender).headOfTheCommunity() !=
            applicantAccount
        ) {
            revert AccountIsNotTheHeadOfTheCurchCommunity();
        }
        _;
    }

    modifier applicantNotAppliedForPreElection(address applicantAddress) {
        if (preElectionCandidateVoteScores[applicantAddress] != 0) {
            revert AccountAlreadyAppliedForPreElection();
        }
        _;
    }

    modifier electionScheduled() {
        if (electionStartDate == 0) {
            revert ElectionNotYetScheduled();
        }
        _;
    }

    modifier preElectionIsNotYetPassed() {
        if (
            electionStartDate -
                PRE_ELECTIONS_VOTING_DAYS -
                PRE_ELECTIONS_ELECTIONS_GAP_DAYS <
            block.timestamp
        ) {
            revert PreElectionStartAlreadyPassed();
        }
        _;
    }

    modifier preElectionApplicationPeriodIsOpen() {
        if (
            electionStartDate -
                PRE_ELECTION_REGISTRATION_STARTS_BEFORE_START_DAYS >
            block.timestamp
        ) {
            revert PreElectionPeriodIsNotYetOpen();
        }
        _;
    }

    constructor() {
        stateAddress = msg.sender;
    }

    function applyForElection(
        address headOfTheChurchCommuntiyAccount,
        string memory _programShortVersionIpfsHash,
        string memory _programLongVersionIpfsHash
    )
        public
        churchCommunityApprovedByState
        electionScheduled
        preElectionApplicationPeriodIsOpen
        preElectionIsNotYetPassed
        accountIsHeadOfChurchCommunity(headOfTheChurchCommuntiyAccount)
        applicantNotAppliedForPreElection(headOfTheChurchCommuntiyAccount)
    {
        preElectionCandidates.push(headOfTheChurchCommuntiyAccount);
        preElectionCandidateVoteScores[headOfTheChurchCommuntiyAccount] = 1;

        candidatesInfo[headOfTheChurchCommuntiyAccount]
            .churchCommunityAddress = msg.sender;
        candidatesInfo[headOfTheChurchCommuntiyAccount]
            .programShortVersionIpfsHash = _programShortVersionIpfsHash;
        candidatesInfo[headOfTheChurchCommuntiyAccount]
            .programLongVersionIpfsHash = _programLongVersionIpfsHash;
    }
}
