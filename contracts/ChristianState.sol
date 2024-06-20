// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./interfaces/IChristianState.sol";

contract ChristianState is IChristianState {
    uint public MAX_DAILY_ADMIN_ACTIVITY = 10;
    string public bankCurrency = "USD";
    string public cryptoCurrency = "ETH";
    address public cryptoWalletAddress;

    uint ethUsdExchangeUnit = 3584;

    string public bankName;
    string public bankAccountNumber;

    mapping(string => string) public commonInfo;
    string[] public commonInfoKeys;

    uint public electionStartDate;
    uint public immutable stateContracCreationDate;
    mapping(address => mapping(uint => uint)) public annualTotalPayments;
    mapping(address => uint) public totalPayments;

    mapping(address => bool) public acceptedChurchCommunities;
    address[] churchCommunities;
    address[] blockedChurchCommunities;
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

    error AdminDailyActivityLimitReached();

    modifier onlyAdmin() {
        if (!accountsWithAdminRole[msg.sender]) {
            revert AccountHasNoAdminRole();
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

    modifier checkAndCountAdminDailyActivity() {
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

    constructor() {
        stateContracCreationDate = block.timestamp;
        accountsWithAdminRole[msg.sender] = true;
        admins.push(msg.sender);
    }

    function modifyChurchCommunityState(
        address churchCommunityAddress,
        bool accepted
    ) public onlyAdmin {
        acceptedChurchCommunities[churchCommunityAddress] = accepted;
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
    ) public onlyAdmin checkAndCountAdminDailyActivity {
        acceptedChurchCommunities[curchCommunityAddress] = false;
        blockedChurchCommunities.push(curchCommunityAddress);
    }

    function updateBankData(
        string memory _bankName,
        string memory _bankAccountNumber
    ) public onlyAdmin checkAndCountAdminDailyActivity {
        bankAccountNumber = _bankAccountNumber;
        bankName = _bankName;
    }

    function updateCryptoData(
        address _walletAddress,
        string memory _cryptoCurrency
    ) public onlyAdmin checkAndCountAdminDailyActivity {
        cryptoWalletAddress = _walletAddress;
        cryptoCurrency = _cryptoCurrency;
    }

    function updateCommonInfoValue(
        string memory key,
        string memory value
    ) public onlyAdmin checkAndCountAdminDailyActivity {
        commonInfo[key] = value;
        commonInfoKeys.push(key);
    }

    function getYear() public view returns (uint) {
        return (block.timestamp / 31557600) + 1970;
    }

    function getDaysPassed() public view returns (uint) {
        return (block.timestamp - stateContracCreationDate) / 86400;
    }
}
