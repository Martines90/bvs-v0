// SPDX-License-Identifier: MIT

// pragma
pragma solidity ^0.8.9;

// imports
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@thirdweb-dev/contracts/extension/Permissions.sol";
import "hardhat/console.sol";

import "./PriceConverter.sol";

/**
 * @title Balanced Voting System contract
 * @author Márton Sándor Horváth
 * @notice
 * @dev
 */

contract BVS is Permissions {
    bytes32 public constant SYSTEM_ADMIN = keccak256("SYSTEM_ADMIN");
    bytes32 public constant POLITICAL_ACTOR = keccak256("POLITICAL_ACTOR");

    enum FundingSizeLevels {
        SMALL,
        MEDIUM,
        LARGE,
        XLARGE,
        XXLARGE,
        XXXLARGE
    }
    struct FundSizes {
        uint256 small;
        uint256 medium;
        uint256 large;
        uint256 xlarge;
        uint256 xxlarge;
        uint256 xxxlarge;
    }
    struct FunderTicket {
        address account;
        string email;
        string fingerprintOrPalmPrintbase64Img;
        uint256 fundedAmountInUsd;
        FundingSizeLevels fundSizeLevel;
        bool exists;
    }

    uint256 public constant DECIMALS = 10 ** 18;

    FundSizes fundSizes =
        FundSizes(
            DECIMALS * 100,
            DECIMALS * 1000,
            DECIMALS * 10000,
            DECIMALS * 100000,
            DECIMALS * 1000000,
            DECIMALS * 10000000
        );

    AggregatorV3Interface public immutable priceFeed;

    mapping(address => FunderTicket) public addressToAmountFunded;
    address[] public funders;

    constructor(address priceFeedAddress) {
        priceFeed = AggregatorV3Interface(priceFeedAddress);
        console.log("GRANT role to: ", msg.sender);
        _setupRole(SYSTEM_ADMIN, msg.sender);
    }

    function fund(
        string memory email,
        string memory fingerprintOrPalmPrintbase64Img
    ) public payable {
        uint256 amount = PriceConverter.getConversionRate(msg.value, priceFeed);
        require(amount >= fundSizes.small, "You need to spend more ETH!");

        if (!addressToAmountFunded[msg.sender].exists) {
            funders.push(msg.sender);
            addressToAmountFunded[msg.sender] = FunderTicket(
                msg.sender,
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

    function unlockTenderBudget() public onlyRole(SYSTEM_ADMIN) {
        console.log("unlock budget with account:", msg.sender);
        (bool callSuccess, ) = payable(msg.sender).call{
            value: address(this).balance
        }("");
        require(callSuccess, "Unlock tender budget failed");
    }

    function getfundSizeLevel(
        uint256 amount
    ) public view returns (FundingSizeLevels) {
        if (amount >= fundSizes.xxxlarge) {
            return FundingSizeLevels.XXXLARGE;
        }
        if (amount >= fundSizes.xxlarge) {
            return FundingSizeLevels.XXLARGE;
        }
        if (amount >= fundSizes.xlarge) {
            return FundingSizeLevels.XLARGE;
        }
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
}
