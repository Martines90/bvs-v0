// SPDX-License-Identifier: MIT

// pragma
pragma solidity ^0.8.9;

// imports
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "./PriceConverter.sol";

/**
 * @title Balanced Voting System contract
 * @author Márton Sándor Horváth
 * @notice
 * @dev
 */

contract BVS {
    enum FoundingSizeLevels {
        SMALL,
        MEDIUM,
        LARGE,
        XLARGE,
        XXLARGE,
        XXXLARGE
    }
    struct FoundSizes {
        uint256 small;
        uint256 medium;
        uint256 large;
        uint256 xlarge;
        uint256 xxlarge;
        uint256 xxxlarge;
    }
    struct FounderTicket {
        address account;
        uint256 foundedAmount;
        FoundingSizeLevels foundSizeLevel;
        bool exists;
    }

    uint256 public constant USD_CONVERT_RATE = 10 ** 18;

    FoundSizes foundSizes =
        FoundSizes(
            USD_CONVERT_RATE * 100,
            USD_CONVERT_RATE * 1000,
            USD_CONVERT_RATE * 10000,
            USD_CONVERT_RATE * 100000,
            USD_CONVERT_RATE * 1000000,
            USD_CONVERT_RATE * 10000000
        );

    AggregatorV3Interface public immutable priceFeed;

    mapping(address => FounderTicket) public addressToAmountFunded;
    address[] public funders;

    constructor(address priceFeedAddress) {
        // 0x694AA1769357215DE4FAC081bf1f309aDC325306
        priceFeed = AggregatorV3Interface(priceFeedAddress);
    }

    function fund() public payable {
        require(
            PriceConverter.getConversionRate(msg.value, priceFeed) >=
                foundSizes.small,
            "You need to spend more ETH!"
        );
        if (!addressToAmountFunded[msg.sender].exists) {
            funders.push(msg.sender);
            addressToAmountFunded[msg.sender] = FounderTicket(
                msg.sender,
                msg.value,
                getFoundSizeLevel(msg.value),
                true
            );
        } else {
            addressToAmountFunded[msg.sender].foundedAmount += msg.value;
            addressToAmountFunded[msg.sender]
                .foundSizeLevel = getFoundSizeLevel(
                addressToAmountFunded[msg.sender].foundedAmount
            );
        }
    }

    function getFoundSizeLevel(
        uint256 amount
    ) public view returns (FoundingSizeLevels) {
        if (amount >= foundSizes.xxxlarge) {
            return FoundingSizeLevels.XXXLARGE;
        }
        if (amount >= foundSizes.xxlarge) {
            return FoundingSizeLevels.XXLARGE;
        }
        if (amount >= foundSizes.xlarge) {
            return FoundingSizeLevels.XLARGE;
        }
        if (amount >= foundSizes.large) {
            return FoundingSizeLevels.LARGE;
        }
        if (amount >= foundSizes.medium) {
            return FoundingSizeLevels.MEDIUM;
        }
        return FoundingSizeLevels.SMALL;
    }
}
