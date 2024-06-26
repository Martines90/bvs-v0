// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./interfaces/IChristianState.sol";

import "./Elections.sol";

contract ChristianState is IChristianState {
    uint immutable level;
    address public immutable electionsContractAddress;
    uint public MAX_DAILY_ADMIN_ACTIVITY = 10;
    uint public constant CRITICAL_ADMIN_ACTIVITY_FREEZE_DAY_COUNT = 3;

    uint public constant MAIN_PRIO_REQUIRED_ADMIN_APPROVALS = 5;
    uint public constant NEW_ADMIN_FREEZE_ACTIVITY_DAY_COUNT = 7;

    string public bankCurrency = "USD";
    string public cryptoCurrency = "ETH";
    address public cryptoWalletAddress;

    uint ethUsdExchangeUnit = 3584;

    string public bankName;
    string public bankAccountNumber;

    mapping(string => string) public commonInfo;
    string[] public commonInfoKeys;

    uint public electionStartDate;
    uint public immutable stateContractCreationDate;
    mapping(address => mapping(uint => uint)) public annualTotalPayments;
    mapping(address => uint) public totalPayments;

    mapping(string => mapping(uint => uint))
        public adminAttemptsOnMethodCallUintVAL;

    mapping(address => bool) public acceptedChurchCommunities;
    address[] churchCommunities;
    address[] blockedChurchCommunities;

    mapping(address => uint) public preElectionScores;
    mapping(address => uint) public electionScores;
    mapping(bytes32 => uint) public votingScores;
    mapping(address => bool) public accountsWithAdminRole;
    mapping(address => bool) public accountsWithRepresentativeRole;

    bytes32[] public votingKeys;
    address[] public admins;
    address[] public representatives;

    mapping(address => mapping(uint => uint)) public dailyAdminActivityCounter;

    error AddressBelongsToNonAcceptedChurchCommunity();
    error AddressBelongsToAnAlreadyAcceptedChurchCommunity();
    error AccountHasNoAdminRole();
    error ProvidedAccountHasAdminRole();

    error AdminDailyActivityLimitReached();

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

    modifier accountHasNoAdminRole(address _account) {
        if (accountsWithAdminRole[_account]) {
            revert ProvidedAccountHasAdminRole();
        }
        _;
    }

    modifier onlyAcceptedChurchCommunity(address curchCommunityAddress) {
        if (!acceptedChurchCommunities[curchCommunityAddress]) {
            revert AddressBelongsToNonAcceptedChurchCommunity();
        }
        _;
    }

    modifier churchCommunityNotYetRegistered(address churchCommunityAddress) {
        if (acceptedChurchCommunities[churchCommunityAddress]) {
            revert AddressBelongsToAnAlreadyAcceptedChurchCommunity();
        }
        _;
    }

    constructor(uint _level) {
        electionsContractAddress = address(new Elections());
        level = _level;
        stateContractCreationDate = block.timestamp;
        accountsWithAdminRole[msg.sender] = true;
        admins.push(msg.sender);
    }

    function addAdmin(address accountAddress) public onlyAdminOnce {
        uint daysPassed = getDaysPassed();
        for (uint i = 0; i < NEW_ADMIN_FREEZE_ACTIVITY_DAY_COUNT; i++) {
            dailyAdminActivityCounter[accountAddress][
                daysPassed + i
            ] = MAX_DAILY_ADMIN_ACTIVITY;
        }

        accountsWithAdminRole[accountAddress] = true;
        admins.push(accountAddress);
    }

    function modifyChurchCommunityState(
        address churchCommunityAddress,
        bool accepted
    ) public onlyAdmin {
        acceptedChurchCommunities[churchCommunityAddress] = accepted;
    }

    function isChurchCommunityApprovedByState(
        address churchCommunityAddress
    ) external view returns (bool) {
        return acceptedChurchCommunities[churchCommunityAddress];
    }

    function voteOnPreElection(
        address candidateAccount
    ) external onlyAcceptedChurchCommunity(msg.sender) {
        preElectionScores[candidateAccount] += 1;
    }

    function voteOnElection(
        address candidateAccount,
        uint voteScore
    ) external onlyAcceptedChurchCommunity(msg.sender) {
        electionScores[candidateAccount] += voteScore;
    }

    function voteOnVoting(
        bytes32 votingKey,
        uint votingScore
    ) external onlyAcceptedChurchCommunity(msg.sender) {
        votingScores[votingKey] += votingScore;
    }

    function registerPaymentFromChurchCommunity(
        address curchCommunityAddress,
        uint amount
    ) public onlyAdmin onlyAcceptedChurchCommunity(curchCommunityAddress) {
        annualTotalPayments[curchCommunityAddress][getYear()] = amount;
    }

    function registerChurchCommunity(
        address curchCommunityAddress
    ) public onlyAdmin churchCommunityNotYetRegistered(curchCommunityAddress) {
        acceptedChurchCommunities[curchCommunityAddress] = true;
        churchCommunities.push(curchCommunityAddress);
    }

    function blockChurchCommunity(
        address curchCommunityAddress
    ) public onlyAdmin {
        acceptedChurchCommunities[curchCommunityAddress] = false;
        blockedChurchCommunities.push(curchCommunityAddress);
    }

    function setElectionStartDate(uint startDate) public onlyAdminOnce {
        if (
            adminAttemptsOnMethodCallUintVAL["setElectionStartDate"][
                startDate
            ] >= MAIN_PRIO_REQUIRED_ADMIN_APPROVALS
        ) {
            IElections(electionsContractAddress).setElectionStartDate(
                startDate
            );
            adminAttemptsOnMethodCallUintVAL["setElectionStartDate"][
                startDate
            ] = 0;
        } else {
            adminAttemptsOnMethodCallUintVAL["setElectionStartDate"][
                startDate
            ]++;
        }
    }

    function updateBankData(
        string memory _bankName,
        string memory _bankAccountNumber
    ) public onlyAdmin {
        bankAccountNumber = _bankAccountNumber;
        bankName = _bankName;
    }

    function updateCryptoData(
        address _walletAddress,
        string memory _cryptoCurrency
    ) public onlyAdmin {
        cryptoWalletAddress = _walletAddress;
        cryptoCurrency = _cryptoCurrency;
    }

    function updateCommonInfoValue(
        string memory key,
        string memory value
    ) public onlyAdmin {
        commonInfo[key] = value;
        commonInfoKeys.push(key);
    }

    function getYear() public view returns (uint) {
        return (block.timestamp / 31557600) + 1970;
    }

    function getDaysPassed() public view returns (uint) {
        return (block.timestamp - stateContractCreationDate) / 86400;
    }
}
