// SPDX-License-Identifier: MIT

// pragma
pragma solidity ^0.8.9;

contract BVS_Helpers {
    function calculateExtraVotingScore(
        uint _numOfVoteOnACompletedArticleValue,
        uint _numOfVoteOnBCompletedArticleValue,
        uint _numOfVoteOnACompletedResponseValue,
        uint _numOfVoteOnBCompletedResponseValue
    ) public pure returns (uint) {
        uint extraVoteScore = 0;

        uint noPairArticleCompleteCount = 0;

        if (
            _numOfVoteOnACompletedArticleValue >
            _numOfVoteOnBCompletedArticleValue
        ) {
            noPairArticleCompleteCount = (_numOfVoteOnACompletedArticleValue -
                _numOfVoteOnBCompletedArticleValue);
        } else {
            noPairArticleCompleteCount = (_numOfVoteOnBCompletedArticleValue -
                _numOfVoteOnACompletedArticleValue);
        }

        extraVoteScore +=
            ((_numOfVoteOnACompletedArticleValue +
                _numOfVoteOnBCompletedArticleValue -
                noPairArticleCompleteCount) / 2) *
            25 +
            (noPairArticleCompleteCount * 5);

        // add the balanced way calculated scores after completed responses
        uint noPairResponseCompleteCount = 0;

        if (
            _numOfVoteOnACompletedResponseValue >
            _numOfVoteOnBCompletedResponseValue
        ) {
            noPairResponseCompleteCount = (_numOfVoteOnACompletedResponseValue -
                _numOfVoteOnBCompletedResponseValue);
        } else {
            noPairResponseCompleteCount = (_numOfVoteOnBCompletedResponseValue -
                _numOfVoteOnACompletedResponseValue);
        }

        extraVoteScore +=
            ((_numOfVoteOnACompletedResponseValue +
                _numOfVoteOnBCompletedResponseValue -
                noPairResponseCompleteCount) / 2) *
            10 +
            (noPairResponseCompleteCount * 2);

        return extraVoteScore;
    }

    function isBytes32ArrayContains(
        bytes32[] memory _array,
        bytes32 _item
    ) public pure returns (bool) {
        for (uint i = 0; i < _array.length; i++) {
            if (_array[i] == _item) {
                return true;
            }
        }
        return false;
    }
}
