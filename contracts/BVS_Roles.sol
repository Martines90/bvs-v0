// SPDX-License-Identifier: MIT

// pragma
pragma solidity ^0.8.9;

/**
 * @title Balanced Voting System:Roles - contract
 * @author Márton Sándor Horváth, email: hmartonsandor{@}gmail.com
 * @notice
 * @dev
 */

contract BVS_Roles {
    uint public constant MIN_PERCENTAGE_GRANT_ADMIN_APPROVALS_REQUIRED = 50;
    uint public constant MAX_DAILY_NEW_CITIZENS_CAN_ADD_PERCENTAGE = 10;

    bytes32 public constant ADMINISTRATOR = keccak256("ADMINISTRATOR");
    bytes32 public constant POLITICAL_ACTOR = keccak256("POLITICAL_ACTOR");
    bytes32 public constant CITIZEN = keccak256("CITIZEN");

    uint public citizenRoleApplicationFee = 10000;

    address[] public admins;
    address[] public politicalActors;
    mapping(address => uint) public politicalActorVotingCredits;
    address[] public citizens;

    uint public immutable creationDate;

    mapping(address => address[]) public adminApprovalSentToAccount;
    mapping(address => uint) public adminRoleGrantApprovals;

    mapping(address => mapping(uint => uint))
        public dailyCitizenRoleModifyCredit;

    mapping(address => bytes32) public citizenshipApplications;

    mapping(bytes32 => mapping(address => bool)) private _hasRole;

    // Events

    event RoleGranted(bytes32 role, address account, address executer);

    event RoleRevoked(bytes32 role, address account, address executer);

    // Errors
    error CitizenRoleAlreadyGranted();
    error CitizenRoleAlreadyRevokedOrNotGranted();
    error NotAppliedForCitizenRole();
    error RunOutOfDailyCitizenRoleGrantCredit();
    error AdminRoleGrantApprovalAlreadySent();

    error MinimumApplicationFeeNotCovered();

    error PermissionsUnauthorizedAccount(address account, bytes32 role);

    modifier onlyRole(bytes32 role) {
        _checkRole(role, msg.sender);
        _;
    }

    modifier minCitizenshipApplicationFeeCovered() {
        if (msg.value < citizenRoleApplicationFee) {
            revert MinimumApplicationFeeNotCovered();
        }
        _;
    }

    modifier appliedForCitizenRole(
        address _account,
        bytes32 _emailPublicKeyHash,
        bool _revokeCitizenRole
    ) {
        if (
            citizenshipApplications[_account] != _emailPublicKeyHash &&
            !_revokeCitizenRole
        ) {
            revert NotAppliedForCitizenRole();
        }
        _;
    }

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

    constructor() {
        admins.push(msg.sender);
        adminRoleGrantApprovals[msg.sender] = 1;
        citizens.push(msg.sender);
        creationDate = block.timestamp;
        _setupRole(ADMINISTRATOR, msg.sender);
        _setupRole(CITIZEN, msg.sender);
    }

    function _setupRole(bytes32 role, address account) internal virtual {
        _hasRole[role][account] = true;
        emit RoleGranted(role, account, msg.sender);
    }

    function _revokeRole(bytes32 role, address account) internal virtual {
        _checkRole(role, account);
        delete _hasRole[role][account];
        emit RoleRevoked(role, account, msg.sender);
    }

    /// @dev Checks `role` for `account`. Reverts with a message including the required role.
    function _checkRole(bytes32 role, address account) internal view virtual {
        if (!_hasRole[role][account]) {
            revert PermissionsUnauthorizedAccount(account, role);
        }
    }

    function hasRole(bytes32 role, address account) public view returns (bool) {
        return _hasRole[role][account];
    }

    function applyForCitizenshipRole(
        bytes32 _emailPublicKeyCombinedHash
    ) public payable minCitizenshipApplicationFeeCovered {
        citizenshipApplications[msg.sender] = _emailPublicKeyCombinedHash;
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
            adminRoleGrantApprovals[_account]++;
            // also new admin has to automatically send his approvals to the already existing admins
            for (uint i = 0; i < admins.length; i++) {
                adminApprovalSentToAccount[_account].push(admins[i]);
                adminRoleGrantApprovals[admins[i]]++;
            }
            _setupRole(ADMINISTRATOR, _account);
            admins.push(_account);
        }
    }

    function revokeAdminRoleApproval(
        address revokedAccount
    ) public onlyRole(ADMINISTRATOR) {
        _revokeAdminRoleApproval(msg.sender, revokedAccount);
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
                    adminRoleGrantApprovals[revokedAccount]--;
                    _revokeRole(ADMINISTRATOR, revokedAccount);
                    for (uint u = 0; u < admins.length; u++) {
                        if (admins[u] == revokedAccount) {
                            delete admins[u];
                            admins[u] = admins[admins.length - 1];
                            admins.pop();
                            break;
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
                            adminApprovalSentToAccount[revokedAccount][k]
                        );
                        delete adminApprovalSentToAccount[revokedAccount][k];
                    }
                    break;
                }
            }
        }
    }

    function grantCitizenRole(
        address _account,
        bytes32 _emailPublicKeyHash,
        bool _revokeCitizenRole
    )
        public
        onlyRole(ADMINISTRATOR)
        hasRoleToModify(_account, _revokeCitizenRole)
        hasCitizenRoleGrantCredit
        appliedForCitizenRole(_account, _emailPublicKeyHash, _revokeCitizenRole)
    {
        uint daysPassed = (block.timestamp - creationDate) / 60 / 60 / 24;
        dailyCitizenRoleModifyCredit[msg.sender][daysPassed]++;
        if (!_revokeCitizenRole) {
            _setupRole(CITIZEN, _account);
            citizens.push(_account);
            delete citizenshipApplications[_account];
        } else {
            if (hasRole(CITIZEN, _account)) {
                _revokeRole(CITIZEN, _account);
            }
            delete citizenshipApplications[_account];
            for (uint i; i < citizens.length; i++) {
                if (citizens[i] == _account) {
                    delete citizens[i];
                    break;
                }
            }
        }
    }

    function checkIfAccountHasRole(
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
