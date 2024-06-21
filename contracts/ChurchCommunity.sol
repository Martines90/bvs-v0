// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./interfaces/IChristianState.sol";

contract ChurchCommunity {
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

    error ProvidedAccountAlreadyHasCitizenship();
    error ProvidedAccountHasNoCitizenship();

    error MaxNumberOfCitizensLimitAlreadyReached();

    error AdminDailyActivityLimitReached();

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
        headOfTheCommunity = msg.sender;

        accountsWithCitizenRole[msg.sender] = true;
        accountsWithAdminRole[msg.sender] = true;
        admins.push(msg.sender);
        citizens.push(msg.sender);
    }

    function isCommunityApprovedByState() public view returns (bool) {
        return
            IChristianState(christianStateAddress)
                .isMyCurchCommunityApprovedByState();
    }

    function setCommunityWebsite(string memory _websiteUrl) public onlyAdmin {
        communityInfo.websiteUrl = _websiteUrl;
    }

    function voteOnStateVoting(bytes32 votingKey) public onlyCitizen {
        IChristianState(christianStateAddress).voteOnVoting(votingKey, 100);
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

    function getDaysPassed() public view returns (uint) {
        return (block.timestamp - communityContractCreationDate) / 86400;
    }
}
