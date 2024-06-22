interface IChristianState {
    function voteOnVoting(bytes32 votingKey, uint votingScore) external;

    function voteOnPreElection(address candidateAccount) external;

    function voteOnElection(address candidateAccount, uint voterScore) external;

    function isChurchCommunityApprovedByState(
        address churchCommunityAddress
    ) external view returns (bool);

    function electionsContractAddress() external view returns (address);
}
