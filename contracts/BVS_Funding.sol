// SPDX-License-Identifier: MIT

// pragma
pragma solidity ^0.8.9;

import "hardhat/console.sol";

/**
 * @title Balanced Voting System - Funding - contract
 * @author Márton Sándor Horváth, email: hmartonsandor{@}gmail.com
 * @notice
 * @dev
 */

contract BVS_Funding {
    uint256 public constant DECIMALS = 10 ** 18;

    constructor() {}

    receive() external payable {
        // This function is executed when a contract receives plain Ether (without data)
    }
}
