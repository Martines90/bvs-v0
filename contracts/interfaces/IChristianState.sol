// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IChristianState {
    function voteOnVoting(bytes32 votingKey, uint votingScore) external;

    function isChurchCommunityApprovedByState(
        address churchCommunityAddress
    ) external view returns (bool);

    function electionsContractAddress() external view returns (address);

    function getChurchCommunityTaxCategoryLevel(
        address churchCommunityAddress
    ) external view returns (uint);

    function accountsWithAdminRole(
        address adminAccount
    ) external view returns (bool);
}
