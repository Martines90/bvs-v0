// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./interfaces/IChristianState.sol";
import "./interfaces/IElections.sol";
import "./interfaces/IChurchCommunity.sol";

contract ChurchCommunity is IChurchCommunity {
    uint public MAX_DAILY_ADMIN_ACTIVITY = 10;
    uint public constant MAX_NUM_OF_CITIZENS = 1000;
    uint public constant MAX_NUM_OF_ADMINS = 12;

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

    mapping(uint => bool) yarlyHeadOfCommunityChanged;

    error AccountHasNoCitizenship();
    error AccountHasNoAdminRole();
    error AccountIsNotTheHeadOfTheCommunity();

    error ProvidedAccountAlreadyHasCitizenship();
    error ProvidedAccountHasNoCitizenship();

    error MaxNumberOfCitizensLimitAlreadyReached();

    error AdminDailyActivityLimitReached();

    error headOfCommunityAlreadyChangedThisYear();

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

    modifier onlyHeadOfTheCommunity() {
        if (msg.sender != headOfTheCommunity) {
            revert AccountIsNotTheHeadOfTheCommunity();
        }
        _;
    }

    modifier headOfCommunityNotChangedThisYear() {
        if (yarlyHeadOfCommunityChanged[getYear()]) {
            revert headOfCommunityAlreadyChangedThisYear();
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

    modifier belowMaxNumberOfCitizensLimit() {
        if (MAX_NUM_OF_CITIZENS <= citizens.length) {
            revert MaxNumberOfCitizensLimitAlreadyReached();
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
        onlyAdmin
        headOfCommunityNotChangedThisYear
        accountHasCitizenship(_newHeadOfCommunityAccount)
    {
        headOfTheCommunity = _newHeadOfCommunityAccount;
    }

    function updateCommunityInfo(
        CommunityInfo memory _communityInfo
    ) public onlyAdmin {
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
                break;
            }
        }
    }

    function applyForElections() public onlyHeadOfTheCommunity {
        IElections(
            IChristianState(christianStateAddress).electionsContractAddress()
        ).applyForElection(msg.sender);
    }

    function getYear() public view returns (uint) {
        return (block.timestamp / 31557600) + 1970;
    }

    function getDaysPassed() public view returns (uint) {
        return (block.timestamp - communityContractCreationDate) / 86400;
    }
}
