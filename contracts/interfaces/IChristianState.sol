// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IChristianState {
    function voteOnVoting(bytes32 votingKey, uint votingScore) external;

    function voteOnPreElection(address candidateAccount) external;

    function voteOnElection(address candidateAccount, uint voterScore) external;

    function isChurchCommunityApprovedByState(
        address churchCommunityAddress
    ) external view returns (bool);

    function electionsContractAddress() external view returns (address);

    function accountsWithAdminRole(
        address adminAccount
    ) external view returns (bool);
}
