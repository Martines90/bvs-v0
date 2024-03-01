import { deployments, ethers } from 'hardhat';

import { BVS, BVS_Voting, MockV3Aggregator } from '../../typechain-types';
import { assert, expect } from 'chai';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { Roles, TimeQuantities, addQuizAndContentCheckAnswersToVoting, completeVoting, getPermissionDenyReasonMessage, grantCitizenshipForAllAccount, sendValuesInEth, startNewVoting } from '../../utils/helpers';

import { time } from "@nomicfoundation/hardhat-network-helpers";

import * as helpers from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("BVS main contract", () => {
    before(async () => {
        await helpers.reset();
    })
    
    let bvs: BVS;
    let bvsAdmin: BVS;
    let accounts: SignerWithAddress[];
    let mockV3Aggregator: MockV3Aggregator;


    let VOTING_DURATION: number;
    let VOTING_CYCLE_INTERVAL: number;
    let APPROVE_VOTING_BEFORE_IT_STARTS_LIMIT: number;
    let NEW_VOTING_PERIOD_MIN_SCHEDULE_AHEAD_TIME: number;
    let MIN_VOTE_SCORE: number;

    beforeEach(async () => {
        accounts = await ethers.getSigners()

        const deploymentResults = await deployments.fixture(['mocks', 'bvs']);

        const bvsAddress: string = deploymentResults['BVS']?.address;

        bvs = await ethers.getContractAt('BVS', bvsAddress);

        const mockV3AggregatorAddress: string = deploymentResults['MockV3Aggregator']?.address;

        mockV3Aggregator = await ethers.getContractAt('MockV3Aggregator', mockV3AggregatorAddress);

        VOTING_DURATION = Number(await bvs.VOTING_DURATION());
        VOTING_CYCLE_INTERVAL = Number(await bvs.VOTING_CYCLE_INTERVAL());
        APPROVE_VOTING_BEFORE_IT_STARTS_LIMIT = Number(await bvs.APPROVE_VOTING_BEFORE_IT_STARTS_LIMIT());
        NEW_VOTING_PERIOD_MIN_SCHEDULE_AHEAD_TIME = Number(await bvs.NEW_VOTING_PERIOD_MIN_SCHEDULE_AHEAD_TIME());
        MIN_VOTE_SCORE = Number(await bvs.MIN_VOTE_SCORE());


        bvsAdmin = await bvs.connect(accounts[0]);
        await bvsAdmin.grantPoliticalActorRole(accounts[1].address, 2);

        bvsAdmin = await bvs.connect(accounts[0]);

    })

    describe("unlockVotedBudget", () => {
        const farFutureDate = 2524687964; // Sat Jan 01 2050 22:12:44
        const votingTargetBudget = sendValuesInEth.medium / BigInt(2);
        let politicalActor: BVS;
        let votingKey: string
        let articleKey: string

        beforeEach(async () => {
            bvsAdmin.setFirstVotingCycleStartDate(farFutureDate - 13 * TimeQuantities.DAY);

            politicalActor = await bvs.connect(accounts[1]);

            await grantCitizenshipForAllAccount([accounts[2], accounts[3], accounts[4], accounts[5], accounts[6], accounts[7]], bvsAdmin);


            await time.increaseTo(farFutureDate - 12 * TimeQuantities.DAY);

            await startNewVoting(politicalActor, farFutureDate, votingTargetBudget)

            votingKey = await politicalActor.votingKeys(0);

            await addQuizAndContentCheckAnswersToVoting(bvsAdmin)

            await time.increaseTo(farFutureDate - APPROVE_VOTING_BEFORE_IT_STARTS_LIMIT);

            await bvsAdmin.approveVoting(votingKey)

            await time.increaseTo(farFutureDate + VOTING_DURATION - TimeQuantities.DAY);

            const account = await bvs.connect(accounts[2]);
            const account2 = await bvs.connect(accounts[3]);
            const account3 = await bvs.connect(accounts[4]);

            await completeVoting(bvsAdmin, accounts[2]);
            await completeVoting(bvsAdmin, accounts[3]);
            await completeVoting(bvsAdmin, accounts[4]);

            await account.voteOnVoting(votingKey, true);
            await account2.voteOnVoting(votingKey, false);
            await account3.voteOnVoting(votingKey, false);
        })
        it("should forbid to unlock voting budget money for non POLITICAL_ACTOR account", async () => {
            const citizen1 = await bvs.connect(accounts[3]);
            await expect(citizen1.unlockVotingBudget(votingKey)).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[3].address, Roles.POLITICAL_ACTOR));;
        })

        it("should forbid to unlock voting budget money when voting did not win", async () => {
            await time.increaseTo(farFutureDate + VOTING_DURATION + TimeQuantities.DAY);

            await expect(politicalActor.unlockVotingBudget(votingKey)).to.be.revertedWith(
                "Voting did not received the majority of support"
            );;
        })

        it("should fail to unlock voting budget money when BVS balance can't cover it", async () => {
            const account6 = await bvs.connect(accounts[6]);
            const account7 = await bvs.connect(accounts[7]);

            await completeVoting(bvsAdmin, accounts[6]);
            await completeVoting(bvsAdmin, accounts[7]);

            await account6.voteOnVoting(votingKey, true);
            await account7.voteOnVoting(votingKey, true);

            await time.increaseTo(farFutureDate + VOTING_DURATION + TimeQuantities.DAY);

            await expect(politicalActor.unlockVotingBudget(votingKey)).to.be.revertedWith(
                "Call failed"
            );;
        })

        it("should withdraw money when voting is finished and won", async () => {
            const bvsAccount5 = await bvs.connect(accounts[5])
            await bvsAccount5.fund("test@email.com", { value: BigInt(2) * votingTargetBudget })

            const account6 = await bvs.connect(accounts[6]);
            const account7 = await bvs.connect(accounts[7]);

            await completeVoting(bvsAdmin, accounts[6]);
            await completeVoting(bvsAdmin, accounts[7]);

            await account6.voteOnVoting(votingKey, true);
            await account7.voteOnVoting(votingKey, true);

            await time.increaseTo(farFutureDate + VOTING_DURATION + TimeQuantities.DAY);

            const bvsAddress = await bvs.getAddress();
            const provider = bvs.runner?.provider;

            const startingBVS_FundingBalance = (await provider?.getBalance(bvsAddress)) || BigInt(0);


            const startingPoliticalActorBalance = (await provider?.getBalance(accounts[1])) || BigInt(0);

            const transactionResponse = await politicalActor.unlockVotingBudget(votingKey);
 
            const transactionReceipt = (await transactionResponse.wait(1)) || {
                gasUsed: BigInt(0),
                gasPrice: BigInt(0),
            };

            const { gasUsed, gasPrice } = transactionReceipt;
            const gasCost = gasUsed * gasPrice;

            const endingBVS_FundingBalance = ((await provider?.getBalance(bvsAddress))  || BigInt(0));
            const endingPoliticalActorBalance = (await provider?.getBalance(accounts[1])) || BigInt(0);

            assert.equal(endingBVS_FundingBalance, startingBVS_FundingBalance - votingTargetBudget);
            assert.equal(
                (votingTargetBudget + startingPoliticalActorBalance).toString(),
                (endingPoliticalActorBalance + gasCost).toString()
              );

            assert.equal((await bvsAdmin.votings(votingKey)).budget, BigInt(0));
        })
    })
})