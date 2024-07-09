// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IChurchCommunity {
    function headOfTheCommunity() external view returns (address);

    function getCitizensSize() external view returns (uint);
}
