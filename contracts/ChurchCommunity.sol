// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "hardhat/console.sol";

import "./interfaces/IChristianState.sol";
import "./interfaces/IElections.sol";
import "./interfaces/IChurchCommunity.sol";

contract ChurchCommunity is IChurchCommunity {
    uint public MAX_DAILY_ADMIN_ACTIVITY = 10;
    uint public constant MAX_NUM_OF_CITIZENS = 1000;
    uint public constant MAX_NUM_OF_ADMINS = 12;
    uint public constant NEW_ADMIN_FREEZE_ACTIVITY_DAY_COUNT = 7;
    uint public constant CRITICAL_ADMIN_ACTIVITY_FREEZE_DAY_COUNT = 3;

    uint public immutable communityContractCreationDate;
    struct CommunityInfo {
        string websiteUrl;
        string name;
        string country;
        string state;
        string county;
        string zipcode;
        string cityTownVillage;
        string district;
        string _address;
    }

    CommunityInfo public communityInfo;
    mapping(address => mapping(uint => uint)) public dailyAdminActivityCounter;

    address public immutable christianStateAddress;
    mapping(address => bool) public accountsWithCitizenRole;
    mapping(address => bool) public accountsWithAdminRole;

    address[] public citizens;
    address[] public admins;

    address public headOfTheCommunity;

    error AccountHasNoCitizenship();
    error AccountHasNoAdminRole();
    error AccountIsNotTheHeadOfTheCommunity();

    error ProvidedAccountAlreadyHasCitizenship();
    error ProvidedAccountHasNoCitizenship();
    error ProvidedAccountHasNoAdminRole();
    error ProvidedAccountHasAdminRole();

    error MaxNumberOfCitizensLimitAlreadyReached();

    error AdminDailyActivityLimitReached();

    error NewStateElectionAlreadyScheduled();

    modifier onlyCitizen() {
        if (!accountsWithCitizenRole[msg.sender]) {
            revert AccountHasNoCitizenship();
        }
        _;
    }

    modifier onlyAdmin() {
        if (!accountsWithAdminRole[msg.sender]) {
            revert AccountHasNoAdminRole();
        }

        uint daysPassed = getDaysPassed();
        if (
            dailyAdminActivityCounter[msg.sender][daysPassed] + 1 >
            MAX_DAILY_ADMIN_ACTIVITY
        ) {
            revert AdminDailyActivityLimitReached();
        }
        dailyAdminActivityCounter[msg.sender][daysPassed]++;
        _;
    }

    modifier onlyAdminOnce() {
        if (!accountsWithAdminRole[msg.sender]) {
            revert AccountHasNoAdminRole();
        }

        uint daysPassed = getDaysPassed();
        if (
            dailyAdminActivityCounter[msg.sender][daysPassed] + 1 >
            MAX_DAILY_ADMIN_ACTIVITY
        ) {
            revert AdminDailyActivityLimitReached();
        }

        for (uint i = 0; i < CRITICAL_ADMIN_ACTIVITY_FREEZE_DAY_COUNT; i++) {
            dailyAdminActivityCounter[msg.sender][
                daysPassed + i
            ] = MAX_DAILY_ADMIN_ACTIVITY;
        }
        _;
    }

    modifier onlyHeadOfTheCommunity() {
        if (msg.sender != headOfTheCommunity) {
            revert AccountIsNotTheHeadOfTheCommunity();
        }
        _;
    }

    modifier accountHasNoCitizenship(address _account) {
        if (accountsWithCitizenRole[_account]) {
            revert ProvidedAccountAlreadyHasCitizenship();
        }
        _;
    }

    modifier accountHasCitizenship(address _account) {
        if (!accountsWithCitizenRole[_account]) {
            revert ProvidedAccountHasNoCitizenship();
        }
        _;
    }

    modifier accountHasAdminRole(address _account) {
        if (!accountsWithAdminRole[_account]) {
            revert ProvidedAccountHasNoAdminRole();
        }
        _;
    }

    modifier accountHasNoAdminRole(address _account) {
        if (accountsWithAdminRole[_account]) {
            revert ProvidedAccountHasAdminRole();
        }
        _;
    }

    modifier belowMaxNumberOfCitizensLimit() {
        if (MAX_NUM_OF_CITIZENS <= citizens.length) {
            revert MaxNumberOfCitizensLimitAlreadyReached();
        }
        _;
    }

    modifier newStateElectionNotScheduled() {
        uint stateElectionStartDate = IElections(
            IChristianState(christianStateAddress).electionsContractAddress()
        ).electionStartDate();
        if (stateElectionStartDate != 0) {
            revert NewStateElectionAlreadyScheduled();
        }
        _;
    }

    constructor(address _stateAddress) {
        christianStateAddress = _stateAddress;
        communityContractCreationDate = block.timestamp;

        accountsWithCitizenRole[msg.sender] = true;
        accountsWithAdminRole[msg.sender] = true;
        admins.push(msg.sender);
        citizens.push(msg.sender);
    }

    function setHeadOfTheCommunity(
        address _newHeadOfCommunityAccount
    )
        public
        onlyAdminOnce
        newStateElectionNotScheduled
        accountHasAdminRole(_newHeadOfCommunityAccount)
    {
        headOfTheCommunity = _newHeadOfCommunityAccount;
    }

    function updateCommunityInfo(
        CommunityInfo memory _communityInfo
    ) public onlyAdminOnce {
        communityInfo = _communityInfo;
    }

    function voteOnStateVoting(bytes32 votingKey) public onlyCitizen {
        IChristianState(christianStateAddress).voteOnVoting(votingKey, 100);
    }

    function voteOnStatePreElection(
        address candidateAccount
    ) public onlyCitizen {
        IChristianState(christianStateAddress).voteOnPreElection(
            candidateAccount
        );
    }

    function voteOnStateElection(address candidateAccount) public onlyCitizen {
        IChristianState(christianStateAddress).voteOnElection(
            candidateAccount,
            100
        );
    }

    function registerCitizen(
        address accountAddress
    )
        public
        onlyAdmin
        accountHasNoCitizenship(accountAddress)
        belowMaxNumberOfCitizensLimit
    {
        accountsWithCitizenRole[accountAddress] = true;
        citizens.push(accountAddress);
    }

    function removeCitizen(
        address accountAddress
    ) public onlyAdmin accountHasCitizenship(accountAddress) {
        accountsWithCitizenRole[accountAddress] = false;

        for (uint index = 0; index < citizens.length; index++) {
            if (citizens[index] == accountAddress) {
                for (uint i = index; i < citizens.length - 1; i++) {
                    citizens[i] = citizens[i + 1];
                }
                delete citizens[citizens.length - 1];
                citizens.pop();
                break;
            }
        }
    }

    function addAdmin(
        address accountAddress
    ) public onlyAdminOnce accountHasNoAdminRole(accountAddress) {
        // For security reasons make sure newly added admin can't do anything in the following days
        uint daysPassed = getDaysPassed();
        for (uint i = 0; i < NEW_ADMIN_FREEZE_ACTIVITY_DAY_COUNT; i++) {
            dailyAdminActivityCounter[accountAddress][
                daysPassed + i
            ] = MAX_DAILY_ADMIN_ACTIVITY;
        }

        accountsWithAdminRole[accountAddress] = true;
        admins.push(accountAddress);
    }

    function removeAdmin(
        address accountAddress
    ) public onlyAdminOnce accountHasAdminRole(accountAddress) {
        accountsWithAdminRole[accountAddress] = false;

        for (uint index = 0; index < admins.length; index++) {
            if (admins[index] == accountAddress) {
                for (uint i = index; i < admins.length - 1; i++) {
                    admins[i] = admins[i + 1];
                }
                delete admins[admins.length - 1];
                admins.pop();
                break;
            }
        }
    }

    function applyForElections(
        string memory _programShortVersionIpfsHash,
        string memory _programLongVersionIpfsHash
    ) public onlyHeadOfTheCommunity onlyAdminOnce {
        IElections(
            IChristianState(christianStateAddress).electionsContractAddress()
        ).applyForElection(
                msg.sender,
                _programShortVersionIpfsHash,
                _programLongVersionIpfsHash
            );
    }

    function getYear() public view returns (uint) {
        return (block.timestamp / 31557600) + 1970;
    }

    function getDaysPassed() public view returns (uint) {
        return (block.timestamp - communityContractCreationDate) / 86400;
    }

    function getCitizensSize() public view returns (uint) {
        return citizens.length;
    }

    function getAdminsSize() public view returns (uint) {
        return admins.length;
    }
}
