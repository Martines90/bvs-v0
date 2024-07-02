// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IElections {
    function applyForElection(
        address headOfTheChurchCommuntiyAccount,
        string memory _programShortVersionIpfsHash,
        string memory _programLongVersionIpfsHash
    ) external;

    function voteOnPreElection(
        address voterAccount,
        address candidateAccount
    ) external;

    function electionStartDate() external view returns (uint);

    function setElectionStartDate(uint startDate) external;
}
