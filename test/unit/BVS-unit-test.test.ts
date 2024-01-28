import { deployments, ethers, getNamedAccounts } from 'hardhat';

import { BVS, MockV3Aggregator } from '../../typechain-types';
import { assert, expect } from 'chai';

describe("BVS", () => {
    let bvs: BVS;
    let deployer;
    let mockV3Aggregator: MockV3Aggregator;
    beforeEach(async () => {
        // deal with hardhat generated default accounts
        // const accounts = await ethers.getSigners();
        // const accountFirst = accounts[0];

        deployer = (await getNamedAccounts()).deployer;

        console.log('deploying all contracts');
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
});