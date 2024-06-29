// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "hardhat/console.sol";

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
    address public immutable contractAddress;

    error AccountHasToBeTheState();

    error ChurchCommunityNotApprovedByState();
    error AccountIsNotTheHeadOfTheCurchCommunity();
    error AccountAlreadyAppliedForPreElection();

    error ElectionNotYetScheduled();
    error PreElectionStartAlreadyPassed();
    error PreElectionApplicationPeriodIsNotYetStarted();
    error PreElectionApplicationPeriodIsAlreadyFinished();

    mapping(address => uint) public preElectionCandidateVoteScores;
    address[] public preElectionCandidates;

    uint public electionStartDate;

    struct CandidateInfo {
        address churchCommunityAddress;
        string programShortVersionIpfsHash;
        string programLongVersionIpfsHash;
    }

    mapping(address => CandidateInfo) candidatesInfo;

    modifier onlyState() {
        if (msg.sender != stateAddress) {
            revert AccountHasToBeTheState();
        }
        _;
    }

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

    modifier preElectionApplicationPeriodIsOngoing() {
        if (
            electionStartDate -
                PRE_ELECTION_REGISTRATION_STARTS_BEFORE_START_DAYS >
            block.timestamp
        ) {
            revert PreElectionApplicationPeriodIsNotYetStarted();
        } else if (
            electionStartDate -
                PRE_ELECTIONS_VOTING_DAYS -
                PRE_ELECTIONS_ELECTIONS_GAP_DAYS <
            block.timestamp
        ) {
            revert PreElectionApplicationPeriodIsAlreadyFinished();
        }
        _;
    }

    constructor() {
        contractAddress = address(this);
        stateAddress = msg.sender;
    }

    function setElectionStartDate(uint startDate) public onlyState {
        electionStartDate = startDate;
    }

    function applyForElection(
        address headOfTheChurchCommuntiyAccount,
        string memory _programShortVersionIpfsHash,
        string memory _programLongVersionIpfsHash
    )
        public
        churchCommunityApprovedByState
        electionScheduled
        preElectionApplicationPeriodIsOngoing
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

    function getPreElectionCanidateSize() public view returns (uint) {
        return preElectionCandidates.length;
    }
}
