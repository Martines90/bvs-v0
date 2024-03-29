// SPDX-License-Identifier: MIT

// pragma
pragma solidity ^0.8.9;

// imports
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "hardhat/console.sol";

import "./PriceConverter.sol";

/**
 * @title Balanced Voting System - Funding - contract
 * @author Márton Sándor Horváth, email: hmartonsandor{@}gmail.com
 * @notice
 * @dev
 */

contract BVS_Funding__ {
    enum FundingSizeLevels {
        SMALL,
        MEDIUM,
        LARGE
    }
    struct FundSizes {
        uint256 small;
        uint256 medium;
        uint256 large;
    }
    struct FunderTicket {
        address account;
        string email;
        uint256 fundedAmountInUsd;
        FundingSizeLevels fundSizeLevel;
        bool exists;
    }

    uint256 public constant DECIMALS = 10 ** 18;

    FundSizes fundSizes =
        FundSizes(DECIMALS * 1000, DECIMALS * 10000, DECIMALS * 100000);

    AggregatorV3Interface public immutable priceFeed;

    mapping(address => FunderTicket) public addressToAmountFunded;
    address[] public funders;

    constructor(address priceFeedAddress) {
        priceFeed = AggregatorV3Interface(priceFeedAddress);
    }

    function fund(string memory email) public payable {
        addFunder(msg.value, email);
    }

    function addFunder(uint value, string memory email) public {
        uint256 amount = PriceConverter.getConversionRate(value, priceFeed);
        require(amount >= fundSizes.small, "You need to spend more ETH!");

        if (!addressToAmountFunded[msg.sender].exists) {
            funders.push(msg.sender);
            addressToAmountFunded[msg.sender] = FunderTicket(
                msg.sender,
                email,
                amount,
                getfundSizeLevel(amount),
                true
            );
        } else {
            addressToAmountFunded[msg.sender].fundedAmountInUsd += amount;
            addressToAmountFunded[msg.sender].fundSizeLevel = getfundSizeLevel(
                addressToAmountFunded[msg.sender].fundedAmountInUsd
            );
        }
    }

    function getfundSizeLevel(
        uint256 amount
    ) public view returns (FundingSizeLevels) {
        if (amount >= fundSizes.large) {
            return FundingSizeLevels.LARGE;
        }
        if (amount >= fundSizes.medium) {
            return FundingSizeLevels.MEDIUM;
        }
        return FundingSizeLevels.SMALL;
    }

    function getNumberOfFunders() public view returns (uint256) {
        return funders.length;
    }

    receive() external payable {
        // This function is executed when a contract receives plain Ether (without data)
    }
}
