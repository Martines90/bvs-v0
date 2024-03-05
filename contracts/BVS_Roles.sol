// SPDX-License-Identifier: MIT

// pragma
pragma solidity ^0.8.9;

// imports
import "@thirdweb-dev/contracts/extension/Permissions.sol";

import "hardhat/console.sol";

/**
 * @title Balanced Voting System:Roles - contract
 * @author Márton Sándor Horváth, email: hmartonsandor{@}gmail.com
 * @notice
 * @dev
 */

contract BVS_Roles is Permissions {
    uint public constant MIN_PERCENTAGE_GRANT_ADMIN_APPROVALS_REQUIRED = 50;
    uint public constant ADMIN_MAX_DAILY_GRANT_CITIZEN_ROLE_CREDIT = 100;

    bytes32 public constant SUPER_ADMINISTRATOR =
        keccak256("SUPER_ADMINISTRATOR");
    bytes32 public constant ADMINISTRATOR = keccak256("ADMINISTRATOR");
    bytes32 public constant POLITICAL_ACTOR = keccak256("POLITICAL_ACTOR");
    bytes32 public constant CITIZEN = keccak256("CITIZEN");

    address[] public admins;
    address[] public politicalActors;
    mapping(address => uint) public politicalActorVotingCredits;
    address[] public citizens;

    uint public immutable creationDate;

    mapping(address => address[]) public adminApprovalSentToAccount;
    mapping(address => uint) public adminRoleGrantApprovals;

    mapping(address => mapping(uint => uint)) public dailyCitizenApprovalCount;

    // Events
    event adminRoleGranted(address account);

    constructor() {
        admins.push(msg.sender);
        citizens.push(msg.sender);
        creationDate = block.timestamp;
        _setupRole(ADMINISTRATOR, msg.sender);
        _setupRole(SUPER_ADMINISTRATOR, msg.sender);
        _setupRole(CITIZEN, msg.sender);
    }

    function grantPoliticalActorRole(
        address account,
        uint _votingCycleTotalCredit
    ) public onlyRole(SUPER_ADMINISTRATOR) {
        require(
            !hasRole(POLITICAL_ACTOR, account),
            "Political actor role alredy granted"
        );
        _setupRole(POLITICAL_ACTOR, account);
        politicalActorVotingCredits[account] = _votingCycleTotalCredit;
        politicalActors.push(account);
    }

    function grantAdministratorRole(
        address _account
    ) public onlyRole(ADMINISTRATOR) {
        require(
            !hasRole(ADMINISTRATOR, _account),
            "Admin role already granted"
        );
        bool adminRoleGrantApprovalAlreadySent = false;
        for (
            uint i = 0;
            i < adminApprovalSentToAccount[msg.sender].length;
            i++
        ) {
            if (adminApprovalSentToAccount[msg.sender][i] == _account) {
                adminRoleGrantApprovalAlreadySent = true;
            }
        }
        require(
            !adminRoleGrantApprovalAlreadySent,
            "You already sent your admin role grant approval to this account"
        );

        adminApprovalSentToAccount[msg.sender].push(_account);
        adminRoleGrantApprovals[_account]++;

        if (
            (adminRoleGrantApprovals[_account] * 1000) / admins.length >=
            MIN_PERCENTAGE_GRANT_ADMIN_APPROVALS_REQUIRED * 10
        ) {
            _setupRole(ADMINISTRATOR, _account);
            admins.push(_account);
            emit adminRoleGranted(_account);
        }
    }

    function grantCitizenRole(address account) public onlyRole(ADMINISTRATOR) {
        require(!hasRole(CITIZEN, account), "Citizen role already granted");
        uint daysPassed = (block.timestamp - creationDate) / 60 / 60 / 24;

        require(
            dailyCitizenApprovalCount[msg.sender][daysPassed] <
                ADMIN_MAX_DAILY_GRANT_CITIZEN_ROLE_CREDIT,
            "You ran out of your daily grant citizen role credit"
        );

        dailyCitizenApprovalCount[msg.sender][daysPassed]++;
        _setupRole(CITIZEN, account);
        citizens.push(account);
    }

    function checkIfAccounthasRole(
        address _account,
        bytes32 _role
    ) public view returns (bool) {
        return hasRole(_role, _account);
    }

    function getAdminsSize() public view returns (uint) {
        return admins.length;
    }

    function getCitizensSize() public view returns (uint) {
        return citizens.length;
    }

    function getPoliticalActorsSize() public view returns (uint) {
        return politicalActors.length;
    }
}
