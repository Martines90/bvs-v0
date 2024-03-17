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
    bytes32 public constant VOTER = keccak256("VOTER");

    address[] public admins;
    address[] public politicalActors;
    mapping(address => uint) public politicalActorVotingCredits;
    address[] public citizens;

    uint public immutable creationDate;

    mapping(address => address[]) public adminApprovalSentToAccount;
    mapping(address => uint) public adminRoleGrantApprovals;

    mapping(address => mapping(uint => uint))
        public dailyCitizenRoleModifyCredit;

    mapping(address => string) public citizenshipApplications;

    // Events
    event adminRoleRevoked(address account);

    // Errors
    error CitizenRoleAlreadyGranted();
    error CitizenRoleAlreadyRevokedOrNotGranted();
    error RunOutOfDailyCitizenRoleGrantCredit();
    error AdminRoleGrantApprovalAlreadySent();

    modifier hasRoleToModify(address _account, bool isRevoke) {
        if (!isRevoke && hasRole(CITIZEN, _account))
            revert CitizenRoleAlreadyGranted();
        if (isRevoke && !hasRole(CITIZEN, _account))
            revert CitizenRoleAlreadyRevokedOrNotGranted();
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
            dailyCitizenRoleModifyCredit[msg.sender][daysPassed] >=
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

    constructor(bool isElections) {
        if (!isElections) {
            admins.push(msg.sender);
            citizens.push(msg.sender);
        }
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
            admins.length == 0 ||
            (adminRoleGrantApprovals[_account] * 1000) / admins.length >
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

    function grantVoterRole(address _account) public onlyRole(ADMINISTRATOR) {
        _setupRole(VOTER, _account);
    }

    function i_RevokeAdminRoleApproval(
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
                        i_RevokeAdminRoleApproval(
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
        i_RevokeAdminRoleApproval(msg.sender, _account);
    }

    function grantCitizenRole(
        address _account,
        bool _revokeCitizenRole
    )
        public
        onlyRole(ADMINISTRATOR)
        hasRoleToModify(_account, _revokeCitizenRole)
        hasCitizenRoleGrantCredit
    {
        require(
            !isEmptyString(citizenshipApplications[_account]),
            "This account not applied for citizenship role"
        );
        uint daysPassed = (block.timestamp - creationDate) / 60 / 60 / 24;
        dailyCitizenRoleModifyCredit[msg.sender][daysPassed]++;
        if (!_revokeCitizenRole) {
            _setupRole(CITIZEN, _account);
            citizens.push(_account);
        } else {
            _revokeRole(CITIZEN, _account);
            for (uint i; i < citizens.length; i++) {
                if (citizens[i] == _account) {
                    delete citizens[i];
                    break;
                }
            }
        }
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

    function isEmptyString(string memory _string) public pure returns (bool) {
        return keccak256(bytes(_string)) == keccak256(bytes(""));
    }
}
