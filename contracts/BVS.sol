// SPDX-License-Identifier: MIT

// pragma
pragma solidity ^0.8.9;

// imports
import "@thirdweb-dev/contracts/extension/Permissions.sol";

import "./BVS_Funding.sol";

/**
 * @title Balanced Voting System contract
 * @author Márton Sándor Horváth, email: hmartonsandor{@}gmail.com
 * @notice
 * @dev
 */

contract BVS is Permissions, BVS_Funding {
    bytes32 public constant SYSTEM_ADMIN = keccak256("SYSTEM_ADMIN");
    bytes32 public constant POLITICAL_ACTOR = keccak256("POLITICAL_ACTOR");

    uint256 constant ELECTION_START_END_INTERVAL = 30 days;

    mapping(address => bool) public admins;
    mapping(address => bool) public politicalActors;
    mapping(address => bool) public voters;

    uint256 public preElectionStartDate;

    address[] public preElectionCandidates;
    address[] public preElectionVotes;
    mapping(address => uint32) public preElectionCandidateScores;
    address[] public preElectionWinners;

    address[] public electionCandidates;
    address[] public electionVotes;
    mapping(address => uint32) public electionCandidateScores;

    constructor(address priceFeed) BVS_Funding(priceFeed) {
        admins[msg.sender] = true;

        _setupRole(SYSTEM_ADMIN, msg.sender);
    }

    function startNewElections(
        uint256 _preElectionStartDate
    ) public onlyRole(SYSTEM_ADMIN) {
        require(
            _preElectionStartDate > now + 30 days,
            "New election start date has to be at least 30 days ahead"
        );
        require(
            preElectionStartDate + 2 * ELECTION_START_END_INTERVAL <
                _preElectionStartDate + 30 days,
            "New election date has to be at least 30 days after the latest prepared election end date"
        );
        require(
            preElectionStartDate + 2 * ELECTION_START_END_INTERVAL + 30 days <
                now,
            "New election can only start after 30 days of last prepared election end"
        );

        for (uint i = 0; i < preElectionCandidates.length; i++) {
            delete preElectionCandidateScores[preElectionCandidates[i]];
        }

        preElectionCandidates = new address[](0);
        preElectionVotes = new address[](0);
        preElectionWinners = new address[](0);

        for (uint i = 0; i < electionCandidates.length; i++) {
            delete electionCandidateScores[electionCandidates[i]];
        }

        electionCandidates = new address[](0);
        electionVotes = new address[](0);
        electionWinners = new address[](0);

        preElectionStartDate = _preElectionStartDate;
    }

    function unlockTenderBudget() public onlyRole(POLITICAL_ACTOR) {
        (bool callSuccess, ) = payable(msg.sender).call{
            value: address(this).balance
        }("");
        require(callSuccess, "Call failed");
    }

    function grantSystemAdminRole(
        address account
    ) public onlyRole(SYSTEM_ADMIN) {
        _setupRole(SYSTEM_ADMIN, account);
    }

    function registerVoter(address voterAddress) public onlyRole(SYSTEM_ADMIN) {
        voters[voterAddress] = true;
    }

    function putMeInChargeAsAPoliticalActor() public {
        if (electionWinners.includes(msg.sender]) {
            _setupRole(POLITICAL_ACTOR, msg.sender);
        }
    }

    function getTotalCandidateScores() {
        
    }
}
