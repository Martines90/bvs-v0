import { deployments, ethers } from 'hardhat';

import { BVS, MockV3Aggregator } from '../../typechain-types';
import { assert, expect } from 'chai';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { Roles, getPermissionDenyReasonMessage, sendValuesInEth } from '../../utils/helpers';


describe("BVS main contract", () => {
    let bvs: BVS;
    let deployer: SignerWithAddress;
    let accounts: SignerWithAddress[];
    let mockV3Aggregator: MockV3Aggregator;

    beforeEach(async () => {
        accounts = await ethers.getSigners()
        deployer = accounts[0]

        const deploymentResults = await deployments.fixture(['mocks', 'bvs']);

        const bvsAddress: string = deploymentResults['BVS']?.address;

        bvs = await ethers.getContractAt('BVS', bvsAddress);

        const mockV3AggregatorAddress: string = deploymentResults['MockV3Aggregator']?.address;

        mockV3Aggregator = await ethers.getContractAt('MockV3Aggregator', mockV3AggregatorAddress);
    })

    describe("unlockTenderBudget", () => {
        beforeEach(async () => {
            const bvsAccount0 = await bvs.connect(accounts[0]);
            await bvsAccount0.grantPoliticalActorRole(accounts[0].address, 2);
        })
        it("should forbid to unlock tender budget money for non POLITICAL_ACTOR account", async () => {
            const bvsAccount1 = await bvs.connect(accounts[1]);

            await expect(bvsAccount1.unlockTenderBudget()).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[1].address, Roles.POLITICAL_ACTOR));;
        })

        it("should allow unlock tender budget money for POLITICAL_ACTOR account", async () => {
            await expect(bvs.unlockTenderBudget()).not.to.be.reverted;
        })


        it("should widthdraw money when parent contract attempts", async () => {
            // add found from another account
            const bvsAccount1 = await bvs.connect(accounts[1])
            await bvsAccount1.fund("test@email.com", { value: sendValuesInEth.medium })

            const bvsAddress = await bvs.getAddress();
            const provider = bvs.runner?.provider;

            const startingBVS_FundingBalance = (await provider?.getBalance(bvsAddress)) || BigInt(0);
            const startingDeployerBalance = (await provider?.getBalance(deployer)) || BigInt(0);

            const transactionResponse = await bvs.unlockTenderBudget();
 
            const transactionReceipt = (await transactionResponse.wait(1)) || {
                gasUsed: BigInt(0),
                gasPrice: BigInt(0),
            };

            const { gasUsed, gasPrice } = transactionReceipt;
            const gasCost = gasUsed * gasPrice;

            const endingBVS_FundingBalance = (await provider?.getBalance(bvsAddress)) || BigInt(0);
            const endingDeployerBalance = (await provider?.getBalance(deployer)) || BigInt(0);

            assert.equal(endingBVS_FundingBalance, BigInt(0));
            assert.equal(
                (startingBVS_FundingBalance + startingDeployerBalance).toString(),
                (endingDeployerBalance + gasCost).toString()
              );
        })
    })
})