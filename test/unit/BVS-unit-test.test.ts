import { deployments, ethers } from 'hardhat';

import { BVS, MockV3Aggregator } from '../../typechain-types';
import { assert, expect } from 'chai';
import { usdToEther, usdWithDecimals } from '../../utils/helpers';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

enum FundingSizeLevels {
    SMALL = 0,
    MEDIUM = 1,
    LARGE = 2,
    XLARGE = 3,
    XXLARGE = 4,
    XXXLARGE = 5
}

describe("BVS", () => {
    let bvs: BVS;
    let deployer: SignerWithAddress;
    let accounts: SignerWithAddress[];
    let mockV3Aggregator: MockV3Aggregator;

    // const conversionEthToUsdRate = INITIAL_PRICE / Math.pow(10, DECIMALS);
    const sendValuesInEth = {
        small: usdToEther(100),
        medium: usdToEther(1000),
        large: usdToEther(10000),
    }

    const valuesInUsd = {
        small: usdWithDecimals(100),
        medium: usdWithDecimals(1000),
        large: usdWithDecimals(10000),
        xlarge: usdWithDecimals(100000),
        xxlarge: usdWithDecimals(1000000),
        xxxlarge: usdWithDecimals(10000000),
    }



    beforeEach(async () => {
        accounts = await ethers.getSigners()
        deployer = accounts[0]

        const deploymentResults = await deployments.fixture(['all']);

        const fundMeAddress: string = deploymentResults['BVS']?.address;
        bvs = await ethers.getContractAt('BVS', fundMeAddress);

        const mockV3AggregatorAddress: string = deploymentResults['MockV3Aggregator']?.address;

        mockV3Aggregator = await ethers.getContractAt('MockV3Aggregator', mockV3AggregatorAddress);
    })
    
    describe("constructor", () => {
        it("sets the price feed address", async () => {
            const repsonse = await bvs.priceFeed();
            assert.equal(repsonse, await mockV3Aggregator.getAddress());
        })
    })

    describe("fund", () => {
        it("should revert fund if the sent ETH below the minimum amount", async () => {
            await expect(bvs.fund({ value: sendValuesInEth.small - BigInt(1) })).to.be.revertedWith("You need to spend more ETH!");
        });
        it("should add a new funder and create a founder ticket when minimum amount payed", async () => {
            await bvs.fund({ value: sendValuesInEth.small});

            const repsonse = await bvs.addressToAmountFunded(deployer.address);

            assert.equal(await bvs.funders(0), deployer.address)
   
            assert.equal(repsonse.account, deployer.address)
            assert.equal(repsonse.fundedAmountInUsd, valuesInUsd.small)
            assert.equal(repsonse.exists, true)
            assert.equal(repsonse.fundSizeLevel, BigInt(FundingSizeLevels.SMALL))
        })

        it("should only update funder's ticket when funder sends found again", async () => {
            await bvs.fund({ value: sendValuesInEth.small});

            const repsonse1 = await bvs.addressToAmountFunded(deployer.address);

            assert.equal(repsonse1.fundSizeLevel, BigInt(FundingSizeLevels.SMALL))

            // send more found with the same account
            await bvs.fund({ value: sendValuesInEth.medium});

            const repsonse2 = await bvs.addressToAmountFunded(deployer.address);

            assert.equal(repsonse2.fundedAmountInUsd, valuesInUsd.small + valuesInUsd.medium)
            assert.equal(repsonse2.fundSizeLevel, BigInt(FundingSizeLevels.MEDIUM))

            assert.equal(await bvs.getNumberOfFunders(), BigInt(1));
        })

        it("should provide more tickets for more users", async () => {
            const bvsAccount1 = await bvs.connect(accounts[1]);
            await bvsAccount1.fund({ value: sendValuesInEth.medium});

            await bvs.fund({ value: sendValuesInEth.large});

            const repsonse1 = await bvs.addressToAmountFunded(deployer.address);
            const repsonse2 = await bvs.addressToAmountFunded(accounts[1].address);
            
            assert.equal(repsonse1.fundSizeLevel, BigInt(FundingSizeLevels.LARGE));
            assert.equal(repsonse2.fundSizeLevel, BigInt(FundingSizeLevels.MEDIUM));
        });
    })

    describe("getfundSizeLevel", () => {
        it("should return the correct fund size levels when amount in usd equals with the level minimum", async () => {
            assert.equal(await bvs.getfundSizeLevel(valuesInUsd.small), BigInt(FundingSizeLevels.SMALL))
            assert.equal(await bvs.getfundSizeLevel(valuesInUsd.medium), BigInt(FundingSizeLevels.MEDIUM))
            assert.equal(await bvs.getfundSizeLevel(valuesInUsd.large), BigInt(FundingSizeLevels.LARGE))
            assert.equal(await bvs.getfundSizeLevel(valuesInUsd.xlarge), BigInt(FundingSizeLevels.XLARGE))
            assert.equal(await bvs.getfundSizeLevel(valuesInUsd.xxlarge), BigInt(FundingSizeLevels.XXLARGE))
            assert.equal(await bvs.getfundSizeLevel(valuesInUsd.xxxlarge), BigInt(FundingSizeLevels.XXXLARGE))
        })

        it("should return the correct fund size levels when amount in usd just below the next level minimum", async () => {
            assert.equal(await bvs.getfundSizeLevel(valuesInUsd.medium - BigInt(1)), BigInt(FundingSizeLevels.SMALL))
            assert.equal(await bvs.getfundSizeLevel(valuesInUsd.large - BigInt(1)), BigInt(FundingSizeLevels.MEDIUM))
            assert.equal(await bvs.getfundSizeLevel(valuesInUsd.xlarge - BigInt(1)), BigInt(FundingSizeLevels.LARGE))
            assert.equal(await bvs.getfundSizeLevel(valuesInUsd.xxlarge - BigInt(1)), BigInt(FundingSizeLevels.XLARGE))
            assert.equal(await bvs.getfundSizeLevel(valuesInUsd.xxxlarge - BigInt(1)), BigInt(FundingSizeLevels.XXLARGE))
        })
    })

    describe("unlockTenderBudget", () => {
        beforeEach(async () => {
            await bvs.fund({ value: sendValuesInEth.small});
        })

        it("should forbid to unlock tender budget money for unauthorized account", async () => {
            const bvsAccount1 = await bvs.connect(accounts[1]);

            await expect(bvsAccount1.unlockTenderBudget()).to.be.reverted;
        })

        it("should unlock tender budget money", async () => {
            // add found from another account
            const bvsAccount1 = await bvs.connect(accounts[1])
            await bvsAccount1.fund({ value: sendValuesInEth.medium })

            const bvsAddress = await bvs.getAddress();
            const provider = bvs.runner?.provider;

            const startingBVSBalance = (await provider?.getBalance(bvsAddress)) || BigInt(0);
            const startingDeployerBalance = (await provider?.getBalance(deployer)) || BigInt(0);

            const transactionResponse = await bvs.unlockTenderBudget();
            const transactionReceipt = (await transactionResponse.wait(1)) || {
                gasUsed: BigInt(0),
                gasPrice: BigInt(0),
            };

            const { gasUsed, gasPrice } = transactionReceipt;
            const gasCost = gasUsed * gasPrice;

            const endingBVSBalance = (await provider?.getBalance(bvsAddress)) || BigInt(0);
            const endingDeployerBalance = (await provider?.getBalance(deployer)) || BigInt(0);

            assert.equal(endingBVSBalance, BigInt(0));
            assert.equal(
                (startingBVSBalance + startingDeployerBalance).toString(),
                (endingDeployerBalance + gasCost).toString()
              );
        })
    })
});