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

    error VoterAlreadyVotedOnPreElection();
    error CandidateNotAppliedForPreElection();
    error PreElectionPeriodIsNotOngoing();

    mapping(address => uint) public preElectionCandidateVoteScores;
    address[] public preElectionCandidates;

    mapping(address => bool) public preElectionVotes;

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
        if (getPreElectionApplicationStartDate() > block.timestamp) {
            revert PreElectionApplicationPeriodIsNotYetStarted();
        } else if (getPreElectionApplicationEndDate() < block.timestamp) {
            revert PreElectionApplicationPeriodIsAlreadyFinished();
        }
        _;
    }

    modifier candidateAppliedForPreElection(address candidateAddress) {
        if (preElectionCandidateVoteScores[candidateAddress] < 1) {
            revert CandidateNotAppliedForPreElection();
        }
        _;
    }

    modifier voterNotVotedYetOnPreElection(address voterAddress) {
        if (preElectionVotes[voterAddress]) {
            revert VoterAlreadyVotedOnPreElection();
        }
        _;
    }

    modifier preElectionVotingPeriodIsOngoing() {
        if (
            electionStartDate -
                PRE_ELECTIONS_ELECTIONS_GAP_DAYS -
                PRE_ELECTIONS_VOTING_DAYS >
            block.timestamp ||
            electionStartDate - PRE_ELECTIONS_ELECTIONS_GAP_DAYS <
            block.timestamp
        ) {
            revert PreElectionPeriodIsNotOngoing();
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
        preElectionVotes[headOfTheChurchCommuntiyAccount] = true;

        candidatesInfo[headOfTheChurchCommuntiyAccount]
            .churchCommunityAddress = msg.sender;
        candidatesInfo[headOfTheChurchCommuntiyAccount]
            .programShortVersionIpfsHash = _programShortVersionIpfsHash;
        candidatesInfo[headOfTheChurchCommuntiyAccount]
            .programLongVersionIpfsHash = _programLongVersionIpfsHash;
    }

    function voteOnPreElection(
        address voterAccount,
        address candidateAccount
    )
        public
        churchCommunityApprovedByState
        preElectionVotingPeriodIsOngoing
        candidateAppliedForPreElection(candidateAccount)
        voterNotVotedYetOnPreElection(voterAccount)
    {
        preElectionCandidateVoteScores[candidateAccount] += IChristianState(
            stateAddress
        ).getChurchCommunityTaxCategoryLevel(msg.sender);
        preElectionVotes[voterAccount] = true;
    }

    function closePreElection() public churchCommunityApprovedByState {}

    function getPreElectionCanidateSize() public view returns (uint) {
        return preElectionCandidates.length;
    }

    function getPreElectionApplicationStartDate() public view returns (uint) {
        return
            electionStartDate -
            PRE_ELECTIONS_ELECTIONS_GAP_DAYS -
            PRE_ELECTIONS_VOTING_DAYS -
            PRE_ELECTION_REGISTRATION_STARTS_BEFORE_START_DAYS;
    }

    function getPreElectionApplicationEndDate() public view returns (uint) {
        return
            electionStartDate -
            PRE_ELECTIONS_ELECTIONS_GAP_DAYS -
            PRE_ELECTIONS_VOTING_DAYS;
    }
}
