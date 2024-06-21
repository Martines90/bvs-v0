interface IChristianState {
    function voteOnVoting(bytes32 votingKey, uint votingScore) external;

    function isMyCurchCommunityApprovedByState() external view returns (bool);
}
