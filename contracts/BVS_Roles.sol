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
    bytes32 public constant SUPER_ADMINISTRATOR =
        keccak256("SUPER_ADMINISTRATOR");
    bytes32 public constant ADMINISTRATOR = keccak256("ADMINISTRATOR");
    bytes32 public constant POLITICAL_ACTOR = keccak256("POLITICAL_ACTOR");
    bytes32 public constant CITIZEN = keccak256("CITIZEN");

    struct PoliticalActorProfile {
        address account;
        uint16 votingCycleTotalCredits;
    }

    address[] public admins;
    address[] public politicalActors;
    mapping(address => PoliticalActorProfile) public politicalActorProfiles;
    address[] public citizens;

    constructor() {
        admins.push(msg.sender);
        citizens.push(msg.sender);

        _setupRole(SUPER_ADMINISTRATOR, msg.sender);
        _setupRole(ADMINISTRATOR, msg.sender);
        _setupRole(CITIZEN, msg.sender);
    }

    function grantPoliticalActorRole(
        address account,
        uint16 _votingCycleTotalCredit
    ) public onlyRole(SUPER_ADMINISTRATOR) {
        require(
            !hasRole(POLITICAL_ACTOR, account),
            "Political actor role to this address alredy granted"
        );
        _setupRole(POLITICAL_ACTOR, account);
        politicalActorProfiles[account] = PoliticalActorProfile(
            account,
            _votingCycleTotalCredit
        );
        politicalActors.push(account);
    }

    function grantAdministratorRole(
        address account
    ) public onlyRole(SUPER_ADMINISTRATOR) {
        require(
            !hasRole(ADMINISTRATOR, account),
            "Admin role to this address already granted"
        );
        _setupRole(ADMINISTRATOR, account);
        admins.push(account);
    }

    function grantCitizenRole(address account) public onlyRole(ADMINISTRATOR) {
        require(
            !hasRole(CITIZEN, account),
            "Citizen role to this address already granted"
        );
        _setupRole(CITIZEN, account);
        citizens.push(account);
    }

    function checkIfAccounthasRole(
        address _account,
        bytes32 _role
    ) public view returns (bool) {
        return hasRole(_role, _account);
    }

    function getAdminsSize() public view returns (uint256) {
        return admins.length;
    }

    function getCitizensSize() public view returns (uint256) {
        return citizens.length;
    }

    function getPoliticalActorsSize() public view returns (uint256) {
        return politicalActors.length;
    }
}
