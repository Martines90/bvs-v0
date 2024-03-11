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
    uint public constant MAX_DAILY_NEW_CITIZENS_CAN_ADD_PERCENTAGE = 10;

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
    event adminRoleRevoked(address account);

    // Errors
    error CitizenRoleAlreadyGranted();
    error RunOutOfDailyCitizenRoleGrantCredit();
    error AdminRoleGrantApprovalAlreadySent();

    modifier hasNoCitizenRole(address _account) {
        if (hasRole(CITIZEN, _account)) revert CitizenRoleAlreadyGranted();
        _;
    }

    modifier hasCitizenRoleGrantCredit() {
        uint daysPassed = (block.timestamp - creationDate) / 60 / 60 / 24;

        uint maxCitizensCanBeAddPerAdmin = (citizens.length /
            MAX_DAILY_NEW_CITIZENS_CAN_ADD_PERCENTAGE) / admins.length;
        maxCitizensCanBeAddPerAdmin = maxCitizensCanBeAddPerAdmin > 0
            ? maxCitizensCanBeAddPerAdmin
            : 1;

        if (
            dailyCitizenApprovalCount[msg.sender][daysPassed] >=
            maxCitizensCanBeAddPerAdmin
        ) revert RunOutOfDailyCitizenRoleGrantCredit();
        _;
    }

    modifier adminRoleGrantApprovalNotSent(address _account) {
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

        if (adminRoleGrantApprovalAlreadySent)
            revert AdminRoleGrantApprovalAlreadySent();
        _;
    }

    constructor() {
        admins.push(msg.sender);
        citizens.push(msg.sender);
        creationDate = block.timestamp;
        _setupRole(ADMINISTRATOR, msg.sender);
        _setupRole(CITIZEN, msg.sender);
    }

    function sendGrantAdministratorRoleApproval(
        address _account
    ) public onlyRole(ADMINISTRATOR) adminRoleGrantApprovalNotSent(_account) {
        adminApprovalSentToAccount[msg.sender].push(_account);
        adminRoleGrantApprovals[_account]++;

        if (
            (adminRoleGrantApprovals[_account] * 1000) / admins.length >=
            MIN_PERCENTAGE_GRANT_ADMIN_APPROVALS_REQUIRED * 10
        ) {
            // also new admin has to automatically send his approvals to the already existing admins
            for (uint i = 0; i < admins.length; i++) {
                adminApprovalSentToAccount[_account].push(admins[i]);
                adminRoleGrantApprovals[admins[i]]++;
            }
            _setupRole(ADMINISTRATOR, _account);
            admins.push(_account);
        }
    }

    function _revokeAdminRoleApproval(
        address admin,
        address revokedAccount
    ) internal {
        for (uint i = 0; i < adminApprovalSentToAccount[admin].length; i++) {
            if (adminApprovalSentToAccount[admin][i] == revokedAccount) {
                delete adminApprovalSentToAccount[admin][i];
                adminRoleGrantApprovals[revokedAccount]--;
                if (
                    (adminRoleGrantApprovals[revokedAccount] * 1000) /
                        admins.length <
                    MIN_PERCENTAGE_GRANT_ADMIN_APPROVALS_REQUIRED * 10
                ) {
                    _revokeRole(ADMINISTRATOR, revokedAccount);
                    for (uint u = 0; u < admins.length; u++) {
                        if (admins[u] == revokedAccount) {
                            delete admins[u];
                        }
                    }
                    // make sure all the other admins get revoked their approval receieved from this admin
                    for (
                        uint k = 0;
                        k < adminApprovalSentToAccount[revokedAccount].length;
                        k++
                    ) {
                        _revokeAdminRoleApproval(
                            revokedAccount,
                            adminApprovalSentToAccount[revokedAccount][i]
                        );
                    }
                    emit adminRoleRevoked(revokedAccount);
                    break;
                }
            }
        }
    }

    function revokeAdminRoleApproval(
        address _account
    ) public onlyRole(ADMINISTRATOR) {
        _revokeAdminRoleApproval(msg.sender, _account);
    }

    function grantCitizenRole(
        address _account
    )
        public
        onlyRole(ADMINISTRATOR)
        hasNoCitizenRole(_account)
        hasCitizenRoleGrantCredit
    {
        uint daysPassed = (block.timestamp - creationDate) / 60 / 60 / 24;

        dailyCitizenApprovalCount[msg.sender][daysPassed]++;
        _setupRole(CITIZEN, _account);
        citizens.push(_account);
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
