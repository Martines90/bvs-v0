// SPDX-License-Identifier: MIT

// pragma
pragma solidity ^0.8.9;

// imports
import "@thirdweb-dev/contracts/extension/Permissions.sol";

/**
 * @title Balanced Voting System:Roles - contract
 * @author Márton Sándor Horváth, email: hmartonsandor{@}gmail.com
 * @notice
 * @dev
 */

contract BVS_Roles is Permissions {
    bytes32 public constant ADMINISTRATOR = keccak256("ADMINISTRATOR");
    bytes32 public constant POLITICAL_ACTOR = keccak256("POLITICAL_ACTOR");
    bytes32 public constant CITIZEN = keccak256("CITIZEN");

    address[] public admins;
    address[] public politicalActors;
    address[] public citizens;

    constructor() {
        admins.push(msg.sender);
        citizens.push(msg.sender);

        _setupRole(POLITICAL_ACTOR, msg.sender); // this part has to be come from voting
        _setupRole(ADMINISTRATOR, msg.sender);
        _setupRole(CITIZEN, msg.sender);
    }

    function grantPoliticalActorRole(
        address account
    ) public onlyRole(ADMINISTRATOR) {
        require(
            !hasRole(POLITICAL_ACTOR, account),
            "Political actor role to this address alredy granted"
        );
        _setupRole(POLITICAL_ACTOR, account);
        politicalActors.push(account);
    }

    function grantAdministratorRole(
        address account
    ) public onlyRole(ADMINISTRATOR) {
        require(
            !hasRole(ADMINISTRATOR, account),
            "Admin role to this address alredy granted"
        );
        _setupRole(ADMINISTRATOR, account);
        admins.push(account);
    }

    function grantCitizenRole(address account) public onlyRole(ADMINISTRATOR) {
        require(
            !hasRole(CITIZEN, account),
            "Citizen role to this address alredy granted"
        );
        _setupRole(CITIZEN, account);
        citizens.push(account);
    }
}
