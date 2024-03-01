import { deployments, ethers } from 'hardhat';

import { BVS_Funding, MockV3Aggregator } from '../../typechain-types';
import { assert, expect } from 'chai';
import { FundingSizeLevels, sendValuesInEth, valuesInUsd } from '../../utils/helpers';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

import * as helpers from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("BVS_Funding", () => {
    before(async () => {
        await helpers.reset();
    })

    let bvsFunding: BVS_Funding;
    let deployer: SignerWithAddress;
    let accounts: SignerWithAddress[];
    let mockV3Aggregator: MockV3Aggregator;

    // const conversionEthToUsdRate = INITIAL_PRICE / Math.pow(10, DECIMALS);

    beforeEach(async () => {
        accounts = await ethers.getSigners()

        deployer = accounts[0]

        const deploymentResults = await deployments.fixture(['mocks', 'bvsFunding']);

        const fundMeAddress: string = deploymentResults['BVS_Funding']?.address;
        bvsFunding = await ethers.getContractAt('BVS_Funding', fundMeAddress);

        const mockV3AggregatorAddress: string = deploymentResults['MockV3Aggregator']?.address;

        mockV3Aggregator = await ethers.getContractAt('MockV3Aggregator', mockV3AggregatorAddress);
    })
    
    describe("constructor", () => {
        it("sets the price feed address", async () => {
            const repsonse = await bvsFunding.priceFeed();
            assert.equal(repsonse, await mockV3Aggregator.getAddress());
        })
    })

    describe("fund", () => {
        it("should revert fund if the sent ETH below the minimum amount", async () => {
            await expect(bvsFunding.fund("test@email.com", { value: sendValuesInEth.small - BigInt(1) })).to.be.revertedWith("You need to spend more ETH!");
        });
        it("should add a new funder and create a founder ticket when minimum amount payed", async () => {
            await bvsFunding.fund("test@email.com", { value: sendValuesInEth.small});

            const repsonse = await bvsFunding.addressToAmountFunded(deployer.address);

            assert.equal(await bvsFunding.funders(0), deployer.address)
   
            assert.equal(repsonse.account, deployer.address)
            assert.equal(repsonse.fundedAmountInUsd, valuesInUsd.small)
            assert.equal(repsonse.exists, true)
            assert.equal(repsonse.fundSizeLevel, BigInt(FundingSizeLevels.SMALL))
        })

        it("should only update funder's ticket when funder sends found again", async () => {
            await bvsFunding.fund("test@email.com", { value: sendValuesInEth.small});

            const repsonse1 = await bvsFunding.addressToAmountFunded(deployer.address);

            assert.equal(repsonse1.fundSizeLevel, BigInt(FundingSizeLevels.SMALL))

            // send more found with the same account
            await bvsFunding.fund("test@email.com", { value: sendValuesInEth.medium});

            const repsonse2 = await bvsFunding.addressToAmountFunded(deployer.address);

            assert.equal(repsonse2.fundedAmountInUsd, valuesInUsd.small + valuesInUsd.medium)
            assert.equal(repsonse2.fundSizeLevel, BigInt(FundingSizeLevels.MEDIUM))

            assert.equal(await bvsFunding.getNumberOfFunders(), BigInt(1));
        })

        it("should provide more tickets for more users", async () => {
            const bvsAccount1 = await bvsFunding.connect(accounts[1]);
            await bvsAccount1.fund("test@email.com", { value: sendValuesInEth.medium});

            await bvsFunding.fund("test@email.com", { value: sendValuesInEth.large});

            const repsonse1 = await bvsFunding.addressToAmountFunded(deployer.address);
            const repsonse2 = await bvsFunding.addressToAmountFunded(accounts[1].address);
            
            assert.equal(repsonse1.fundSizeLevel, BigInt(FundingSizeLevels.LARGE));
            assert.equal(repsonse2.fundSizeLevel, BigInt(FundingSizeLevels.MEDIUM));
        });
    })

    describe("getfundSizeLevel", () => {
        it("should return the correct fund size levels when amount in usd equals with the level minimum", async () => {
            assert.equal(await bvsFunding.getfundSizeLevel(valuesInUsd.small), BigInt(FundingSizeLevels.SMALL))
            assert.equal(await bvsFunding.getfundSizeLevel(valuesInUsd.medium), BigInt(FundingSizeLevels.MEDIUM))
            assert.equal(await bvsFunding.getfundSizeLevel(valuesInUsd.large), BigInt(FundingSizeLevels.LARGE))
        })

        it("should return the correct fund size levels when amount in usd just below the next level minimum", async () => {
            assert.equal(await bvsFunding.getfundSizeLevel(valuesInUsd.medium - BigInt(1)), BigInt(FundingSizeLevels.SMALL))
            assert.equal(await bvsFunding.getfundSizeLevel(valuesInUsd.large - BigInt(1)), BigInt(FundingSizeLevels.MEDIUM))
        })
    })
});