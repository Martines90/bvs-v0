import { deployments, ethers } from 'hardhat';

import { BVS_Elections, BVS_Voting } from '../../typechain-types';
import { assert, expect } from 'chai';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

import { time } from "@nomicfoundation/hardhat-network-helpers";
import { FAR_FUTURE_DATE, NOW, Roles, TimeQuantities, addArticleToVotingWithQuizAndAnswers, addQuizAndContentCheckAnswersToVoting, addResponseToArticleWithQuizAndAnswers, assignAnswersToArticle, assignAnswersToArticleResponse, assignAnswersToVoting, completeArticle, completeArticleResponse, completeVoting, electCandidates, generatBytes32InputArray, getPermissionDenyReasonMessage, grantCitizenshipForAllAccount2, mockHashedAnwers, sendValuesInEth, startNewVoting } from '../../utils/helpers';
import { deepEqual } from 'assert';

import * as helpers from "@nomicfoundation/hardhat-toolbox/network-helpers";

const bytes32 = require('bytes32');

describe("BVS_Voting", () => {
    before(async () => {
        await helpers.reset();
    })

    let admin: BVS_Voting;
    let bvsVoting: BVS_Voting;
    let bvsElections: BVS_Elections;
    let accounts: SignerWithAddress[];
    let MIN_TOTAL_CONTENT_READ_CHECK_ANSWER: number

    // contract constants
    let VOTING_DURATION: number;
    let VOTING_CYCLE_INTERVAL: number;
    let APPROVE_VOTING_BEFORE_IT_STARTS_LIMIT: number;
    let NEW_VOTING_PERIOD_MIN_SCHEDULE_AHEAD_TIME: number;
    let MIN_VOTE_SCORE: number;

    beforeEach(async () => {
        accounts = await ethers.getSigners()

        const deploymentResults = await deployments.fixture(['mocks', 'bvs_voting']);

        const bvsAddress: string = deploymentResults['BVS_Voting']?.address;

        bvsVoting = await ethers.getContractAt('BVS_Voting', bvsAddress);

        bvsElections = await ethers.getContractAt('BVS_Elections', (await bvsVoting.bvsElections()));

        // read contract constants
        VOTING_DURATION = Number(await bvsVoting.VOTING_DURATION());
        VOTING_CYCLE_INTERVAL = Number(await bvsVoting.VOTING_CYCLE_INTERVAL());
        APPROVE_VOTING_BEFORE_IT_STARTS_LIMIT = Number(await bvsVoting.APPROVE_VOTING_BEFORE_IT_STARTS_LIMIT());
        NEW_VOTING_PERIOD_MIN_SCHEDULE_AHEAD_TIME = Number(await bvsVoting.NEW_VOTING_PERIOD_MIN_SCHEDULE_AHEAD_TIME());
        MIN_VOTE_SCORE = Number(await bvsVoting.MIN_VOTE_SCORE());

        admin = await bvsVoting.connect(accounts[0]);

        MIN_TOTAL_CONTENT_READ_CHECK_ANSWER = Number(await admin.MIN_TOTAL_CONTENT_READ_CHECK_ANSWER())

        await grantCitizenshipForAllAccount2(accounts, bvsVoting, 20)
    })

    describe("unlockVotedBudget", () => {
        const votingTargetBudget = sendValuesInEth.medium / BigInt(2);
        let politicalActor: BVS_Voting;
        let votingKey: string
        let articleKey: string

        beforeEach(async () => {
            admin.setFirstVotingCycleStartDate(FAR_FUTURE_DATE - 13 * TimeQuantities.DAY);

            await electCandidates(bvsElections,[accounts[1]]);
            await admin.syncElectedPoliticalActors();

            politicalActor = await admin.connect(accounts[1]);

            await time.increaseTo(FAR_FUTURE_DATE - 12 * TimeQuantities.DAY);

            await startNewVoting(politicalActor, FAR_FUTURE_DATE, votingTargetBudget)

            votingKey = await politicalActor.votingKeys(0);

            await addQuizAndContentCheckAnswersToVoting(admin)

            await time.increaseTo(FAR_FUTURE_DATE - APPROVE_VOTING_BEFORE_IT_STARTS_LIMIT);

            await admin.approveVoting(votingKey)

            await time.increaseTo(FAR_FUTURE_DATE + VOTING_DURATION - TimeQuantities.DAY);

            const account = await admin.connect(accounts[2]);
            const account2 = await admin.connect(accounts[3]);
            const account3 = await admin.connect(accounts[4]);

            await completeVoting(admin, accounts[2]);
            await completeVoting(admin, accounts[3]);
            await completeVoting(admin, accounts[4]);

            await account.voteOnVoting(votingKey, true);
            await account2.voteOnVoting(votingKey, false);
            await account3.voteOnVoting(votingKey, false);
        })
        it("should forbid to unlock voting budget money for non POLITICAL_ACTOR account", async () => {
            const citizen1 = await admin.connect(accounts[3]);
            await expect(citizen1.unlockVotingBudget(votingKey)).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[3].address, Roles.POLITICAL_ACTOR));;
        })

        it("should forbid to unlock voting budget money when voting did not win", async () => {
            await time.increaseTo(FAR_FUTURE_DATE + VOTING_DURATION + TimeQuantities.DAY);

            await expect(politicalActor.unlockVotingBudget(votingKey)).to.be.revertedWith(
                "Voting did not received the majority of support"
            );;
        })

        it("should fail to unlock voting budget money when BVS balance can't cover it", async () => {
            const account6 = await admin.connect(accounts[6]);
            const account7 = await admin.connect(accounts[7]);

            await completeVoting(admin, accounts[6]);
            await completeVoting(admin, accounts[7]);

            await account6.voteOnVoting(votingKey, true);
            await account7.voteOnVoting(votingKey, true);

            await time.increaseTo(FAR_FUTURE_DATE + VOTING_DURATION + TimeQuantities.DAY);

            await expect(politicalActor.unlockVotingBudget(votingKey)).to.be.revertedWith(
                "Call failed"
            );;
        })

        it("should withdraw money when voting is finished and won", async () => {
            const bvsAccount5 = await admin.connect(accounts[5])
            await bvsAccount5.fund("test@email.com", { value: BigInt(2) * votingTargetBudget })

            const account6 = await admin.connect(accounts[6]);
            const account7 = await admin.connect(accounts[7]);

            await completeVoting(admin, accounts[6]);
            await completeVoting(admin, accounts[7]);

            await account6.voteOnVoting(votingKey, true);
            await account7.voteOnVoting(votingKey, true);

            await time.increaseTo(FAR_FUTURE_DATE + VOTING_DURATION + TimeQuantities.DAY);

            const bvsAddress = await admin.getAddress();
            const provider = admin.runner?.provider;

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

            assert.equal((await admin.votings(votingKey)).budget, BigInt(0));
        })
    })

    describe("_grantCitizenRole", () => {})
    describe("_grantAdminRole", () => {})

    describe("syncElectedPoliticalActors", () => {})

    describe('setFirstVotingCycleStartDate', () => {
        const firstVotingCycleStartDate = FAR_FUTURE_DATE

        it('should revert when non ADMINISTRATOR calls it', async () => {
            const bvsVotingAccount1 = await bvsVoting.connect(accounts[1]);

            await expect(
                bvsVotingAccount1.setFirstVotingCycleStartDate(firstVotingCycleStartDate)
            ).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[1].address, Roles.ADMINISTRATOR));
        })

        it('should revert when passed date is before now', async () => {
            await time.increaseTo(firstVotingCycleStartDate);

            await expect(admin.setFirstVotingCycleStartDate(firstVotingCycleStartDate - TimeQuantities.HOUR)).to.be.revertedWith('Voting cycle start date has to be in the future');
        })

        it('should update firstVotingCycleStartDate with passed date', async () => {
            await admin.setFirstVotingCycleStartDate(firstVotingCycleStartDate);

            await assert.equal(await admin.firstVotingCycleStartDate(), BigInt(firstVotingCycleStartDate))
        })

        it('should update firstVotingCycleStartDate with passed date and has to clear previous voting cycle indexes', async () => {
            await admin.setFirstVotingCycleStartDate(firstVotingCycleStartDate);

            await admin.firstVotingCycleStartDate(), BigInt(firstVotingCycleStartDate)

            await electCandidates(bvsElections,[accounts[1]]);
            await admin.syncElectedPoliticalActors();

            const politicalActor = await bvsVoting.connect(accounts[1]);

            await time.increaseTo(firstVotingCycleStartDate + 10 * TimeQuantities.DAY);

            await startNewVoting(politicalActor, firstVotingCycleStartDate + 22 * TimeQuantities.DAY);

            await assert.equal((await admin.votingCycleStartVoteCount(BigInt(0), accounts[1].address)), BigInt(1))
            await assert.equal(await admin.getVotinCycleIndexesSize(), BigInt(1))
            

            await admin.setFirstVotingCycleStartDate(firstVotingCycleStartDate + VOTING_CYCLE_INTERVAL);

            await assert.equal((await admin.votingCycleStartVoteCount(BigInt(0), accounts[0].address)), BigInt(0))
            await assert.equal(await admin.getVotinCycleIndexesSize(), BigInt(0))
            
        })
    })

    describe('scheduleNewVoting', () => {
        const mockFirstVotingCycleStartDate = FAR_FUTURE_DATE

        beforeEach(async () => {
            await admin.setFirstVotingCycleStartDate(mockFirstVotingCycleStartDate);

            await electCandidates(bvsElections,[accounts[1],accounts[2], accounts[3], accounts[4], accounts[5]]);
            await admin.syncElectedPoliticalActors();
        })

        it('should revert when non POLITICAL_ACTOR calls it', async () => {
            const bvsVotingAccount2 = await bvsVoting.connect(accounts[10]);

            await expect(
                bvsVotingAccount2.scheduleNewVoting(
                    'ipfs-hash',
                    NOW,
                    0
                )
            ).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[10].address, Roles.POLITICAL_ACTOR));
        })

        it('should revert when actual date is before first voting cycle start date', async () => {
            const politicalActor = await bvsVoting.connect(accounts[1]);

            await time.increaseTo(mockFirstVotingCycleStartDate - 1);

            await expect(politicalActor.scheduleNewVoting('ipfs-hash', mockFirstVotingCycleStartDate, 0)).to.be.revertedWith('Start new voting period is not yet active');
        })
        
        it('should revert when new voting not scheduled 10 days ahead from now', async () => {
            const politicalActor = await bvsVoting.connect(accounts[1]);

            await time.increaseTo(mockFirstVotingCycleStartDate + TimeQuantities.HOUR);

            await expect(politicalActor.scheduleNewVoting('ipfs-hash', mockFirstVotingCycleStartDate + NEW_VOTING_PERIOD_MIN_SCHEDULE_AHEAD_TIME, 0)).to.be.revertedWith('New voting has to be scheduled 10 days later from now');
        })

        it('should revert when new voting scheduled later than one VOTING_CYCLE_INTERVAL', async () => {
            const politicalActor = await bvsVoting.connect(accounts[1]);

            await time.increaseTo(mockFirstVotingCycleStartDate + TimeQuantities.HOUR);

            await expect(politicalActor.scheduleNewVoting('ipfs-hash', mockFirstVotingCycleStartDate + VOTING_CYCLE_INTERVAL + TimeQuantities.DAY, 0)).to.be.revertedWith('New voting start date can only be scheduled within 30 days ahead');
        })


        it('should revert when new voting scheduled before 10 days at the end of the actual ongoing voting cycle', async () => {
            const politicalActor = await bvsVoting.connect(accounts[1]);

            await time.increaseTo(mockFirstVotingCycleStartDate + VOTING_CYCLE_INTERVAL - NEW_VOTING_PERIOD_MIN_SCHEDULE_AHEAD_TIME);

            await expect(politicalActor.scheduleNewVoting('ipfs-hash', mockFirstVotingCycleStartDate + VOTING_CYCLE_INTERVAL + TimeQuantities.DAY, 0)).to.be.revertedWith(
                "You can't start new voting 10 days or less before the ongoing voting cycle ends"
            );
        })

        it('should revert when political actor runs out of start new voting credits', async () => {
            const politicalActor = await bvsVoting.connect(accounts[1]);

            await time.increaseTo(mockFirstVotingCycleStartDate + NEW_VOTING_PERIOD_MIN_SCHEDULE_AHEAD_TIME);

            await assert.equal((await politicalActor.votingCycleStartVoteCount(BigInt(0), accounts[1].address)), BigInt(0))

            await politicalActor.scheduleNewVoting('ipfs-hash', mockFirstVotingCycleStartDate + 22 * TimeQuantities.DAY, 0);

            await assert.equal((await politicalActor.votingCycleStartVoteCount(BigInt(0), accounts[1].address)), BigInt(1))

            await politicalActor.scheduleNewVoting('ipfs-hash', mockFirstVotingCycleStartDate + 22 * TimeQuantities.DAY, 0);

            await assert.equal((await politicalActor.votingCycleStartVoteCount(BigInt(0), accounts[1].address)), BigInt(2))

            await expect(politicalActor.scheduleNewVoting('ipfs-hash', mockFirstVotingCycleStartDate + 22 * TimeQuantities.DAY, 0)).to.be.revertedWith(
                "You ran out of start new voting credits in this voting cycle"
            );
        })

        it('should add new voting', async () => {
            const politicalActor = await bvsVoting.connect(accounts[1]);

            await time.increaseTo(mockFirstVotingCycleStartDate + NEW_VOTING_PERIOD_MIN_SCHEDULE_AHEAD_TIME);

            const newVotingStartDate = mockFirstVotingCycleStartDate + 22 * TimeQuantities.DAY;

            await startNewVoting(politicalActor, newVotingStartDate);

            await assert.equal((await politicalActor.votingCycleStartVoteCount(BigInt(0), accounts[1].address)), BigInt(1));


            const votingKey = await politicalActor.votingKeys(0);

            deepEqual((await politicalActor.votings(votingKey)),[
                false,
                false,
                votingKey,
                0,
                0,
                accounts[1].address,
                'content-ipfs-hash',
                newVotingStartDate,
                0,
                0,
                ''
            ])
        })

        it("should increase voting cycle count when we are in the following voting cycle", async () => {
            const politicalActor = await bvsVoting.connect(accounts[1]);

            await time.increaseTo(mockFirstVotingCycleStartDate + NEW_VOTING_PERIOD_MIN_SCHEDULE_AHEAD_TIME);

            await assert.equal((await politicalActor.votingCycleStartVoteCount(BigInt(0), accounts[1].address)), BigInt(0))

            await startNewVoting(politicalActor, mockFirstVotingCycleStartDate + 22 * TimeQuantities.DAY)

            await time.increaseTo(mockFirstVotingCycleStartDate + 31 * TimeQuantities.DAY);

            await startNewVoting(politicalActor, mockFirstVotingCycleStartDate + 42 * TimeQuantities.DAY)

            await assert.equal(await politicalActor.getVotinCycleIndexesSize(), BigInt(2))
            await assert.equal(await politicalActor.votingCycleIndexes(0), BigInt(0))
            await assert.equal(await politicalActor.votingCycleIndexes(1), BigInt(1))
        })
    })



    describe('assignQuizIpfsHashToVoting', () => {
        const mockFirstVotingCycleStartDate = FAR_FUTURE_DATE
        let politicalActor: BVS_Voting
        let newVotingStartDate: number

        beforeEach(async () => {
            await admin.setFirstVotingCycleStartDate(mockFirstVotingCycleStartDate);
        
            await electCandidates(bvsElections,[accounts[1],accounts[2], accounts[3], accounts[4], accounts[5]]);
            await admin.syncElectedPoliticalActors();

            politicalActor = await bvsVoting.connect(accounts[1]);


            await time.increaseTo(mockFirstVotingCycleStartDate + TimeQuantities.DAY);

            newVotingStartDate = mockFirstVotingCycleStartDate + 12 * TimeQuantities.DAY;
 
            await startNewVoting(politicalActor, newVotingStartDate)
        })

        it('should revert when account has no ADMINISTRATOR role', async () => {
            const votingKey = await politicalActor.votingKeys(0);

            const account2 = await bvsVoting.connect(accounts[2]);

            await expect(
                account2.assignQuizIpfsHashToVoting(votingKey, 'quiz-ipfs-hash')
            ).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[2].address, Roles.ADMINISTRATOR));
        })

        it('should revert when voting not exists', async () => {
            await expect(admin.assignQuizIpfsHashToVoting(bytes32({ input: 'non-existing-voting-key' }), 'quiz-ipfs-hash')).to.be.revertedWith(
                "Voting not exists"
            );
        })

        it('should assign quiz to voting', async () => {
            const votingKey = await politicalActor.votingKeys(0);

            await admin.assignQuizIpfsHashToVoting(votingKey, 'quiz-ipfs-hash')

            assert.equal((await politicalActor.votings(votingKey)).votingContentCheckQuizIpfsHash, 'quiz-ipfs-hash');
        })
    })

    describe('addKeccak256HashedAnswerToVotingContent', async () => {
        const mockFirstVotingCycleStartDate = FAR_FUTURE_DATE
        let politicalActor: BVS_Voting
        let newVotingStartDate: number

        beforeEach(async () => {
            await admin.setFirstVotingCycleStartDate(mockFirstVotingCycleStartDate);

            await electCandidates(bvsElections,[accounts[1],accounts[2], accounts[3], accounts[4], accounts[5]]);
            await admin.syncElectedPoliticalActors();

            politicalActor = await bvsVoting.connect(accounts[1]);


            await time.increaseTo(mockFirstVotingCycleStartDate + TimeQuantities.DAY);

            newVotingStartDate = mockFirstVotingCycleStartDate + 12 * TimeQuantities.DAY;

            await startNewVoting(politicalActor, newVotingStartDate)
        })

        it('should revert when account has no ADMINISTRATOR role', async () => {
            const votingKey = await politicalActor.votingKeys(0);

            const account2 = await bvsVoting.connect(accounts[2]);

            await expect(
                account2.addKeccak256HashedAnswerToVotingContent(votingKey, bytes32({ input: 'hashed-answer'}))
            ).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[2].address, Roles.ADMINISTRATOR));
        })

        it('should revert when voting content check quiz ipfs not yet assigned', async () => {
            const votingKey = await politicalActor.votingKeys(0);

            await expect(admin.addKeccak256HashedAnswerToVotingContent(votingKey, bytes32({ input: 'hashed-answer'}))).to.be.revertedWith(
                "No voting content check quiz ipfs assigned yet"
            );
        })

        it('should assign answers to voting quiz', async () => {
            const votingKey = await politicalActor.votingKeys(0);

            await admin.assignQuizIpfsHashToVoting(votingKey, 'quiz-ipfs-hash')

            await admin.addKeccak256HashedAnswerToVotingContent(votingKey, bytes32({ input: 'hashed-answer-1'}))
            await admin.addKeccak256HashedAnswerToVotingContent(votingKey, bytes32({ input: 'hashed-answer-2'}))

            assert.equal((await politicalActor.votingContentReadCheckAnswers(votingKey, 0)), bytes32({ input: 'hashed-answer-1'}));
            assert.equal((await politicalActor.votingContentReadCheckAnswers(votingKey, 1)), bytes32({ input: 'hashed-answer-2'}));
        })
    })

    describe('approveVoting', async () => {
        const mockFirstVotingCycleStartDate = FAR_FUTURE_DATE
        let politicalActor: BVS_Voting
        let newVotingStartDate: number
        let votingKey: string

        beforeEach(async () => {
            await admin.setFirstVotingCycleStartDate(mockFirstVotingCycleStartDate);

            await electCandidates(bvsElections,[accounts[1],accounts[2], accounts[3], accounts[4], accounts[5]]);
            await admin.syncElectedPoliticalActors();

            politicalActor = await bvsVoting.connect(accounts[1]);


            await time.increaseTo(mockFirstVotingCycleStartDate + TimeQuantities.DAY);

            newVotingStartDate = mockFirstVotingCycleStartDate + 12 * TimeQuantities.DAY;

            await startNewVoting(politicalActor, newVotingStartDate)

            votingKey = await politicalActor.votingKeys(0);
            await admin.assignQuizIpfsHashToVoting(votingKey, 'quiz-ipfs-hash')

            await assignAnswersToVoting(bvsVoting, votingKey, 10);
        })

        it('should revert when account has no ADMINISTRATOR role', async () => {
            const account2 = await bvsVoting.connect(accounts[2]);

            await expect(
                account2.approveVoting(votingKey)
            ).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[2].address, Roles.ADMINISTRATOR));
        })

        it('should revert when voting start date already passed', async () => {
            const votingKey = await admin.votingKeys(0);

            await time.increaseTo(newVotingStartDate);

            await expect(admin.approveVoting(votingKey)).to.be.revertedWithCustomError(bvsVoting,
                "VotingAlreadyStarted"
            );
        })

        it('should revert when voting start date is not within 3 days', async () => {
            const votingKey = await admin.votingKeys(0);

            await time.increaseTo(newVotingStartDate - APPROVE_VOTING_BEFORE_IT_STARTS_LIMIT - TimeQuantities.HOUR);

            await expect(admin.approveVoting(votingKey)).to.be.revertedWithCustomError(bvsVoting,
                "VotingCanBeApproved3DaysOrLessBeforeItsStart"
            );
        })

        it('should revert when no enough content check quiz questions added', async () => {
            const votingKey = await admin.votingKeys(0);

            await time.increaseTo(newVotingStartDate - APPROVE_VOTING_BEFORE_IT_STARTS_LIMIT - TimeQuantities.HOUR);

            await expect(admin.approveVoting(votingKey)).to.be.revertedWithCustomError(bvsVoting,
                "VotingCanBeApproved3DaysOrLessBeforeItsStart"
            );
        })

        it('should revert when creator not responded on all the critical articles', async () => {
            const votingKey = await politicalActor.votingKeys(0);

            const politicalActor2 = await bvsVoting.connect(accounts[2]);

            await politicalActor2.publishProConArticle(votingKey, 'ipfs-hash', true)

            const articleKey = await politicalActor.articleKeys(0);

            await time.increaseTo(newVotingStartDate - 7 * TimeQuantities.DAY);

            await admin.assignQuizIpfsHashToArticleOrResponse(votingKey, articleKey, 'article-content-quiz-ipfs-hash', true)

            await assignAnswersToArticle(admin, votingKey, articleKey)

            await time.increaseTo(newVotingStartDate - 2 * TimeQuantities.DAY);

            await expect(admin.approveVoting(votingKey)).to.be.revertedWith(
                "Creator of the voting not yet responded on all the critics"
            );
        })

        it('should approve voting', async () => {
            const votingKey = await politicalActor.votingKeys(0);

            const politicalActor2 = await bvsVoting.connect(accounts[2]);

            await politicalActor2.publishProConArticle(votingKey, 'ipfs-hash', true)

            const articleKey = await politicalActor.articleKeys(0);

            await time.increaseTo(newVotingStartDate - 7 * TimeQuantities.DAY);

            await admin.assignQuizIpfsHashToArticleOrResponse(votingKey, articleKey, 'article-content-quiz-ipfs-hash', true)

            await assignAnswersToArticle(admin, votingKey, articleKey)

            await politicalActor.publishProConArticleResponse(votingKey, articleKey, 'ipfs-response-hash')

            await admin.assignQuizIpfsHashToArticleOrResponse(votingKey, articleKey, 'ipfs-quiz-hash', false)

            await assignAnswersToArticleResponse(admin, votingKey, articleKey)

            await time.increaseTo(newVotingStartDate - 2 * TimeQuantities.DAY);
            await admin.approveVoting(votingKey)


            assert.equal((await admin.votings(votingKey)).approved, true);
        })
    })

    describe('publishProConArticle', async () => {
        const mockFirstVotingCycleStartDate = FAR_FUTURE_DATE
        let politicalActor: BVS_Voting

        beforeEach(async () => {
            await admin.setFirstVotingCycleStartDate(mockFirstVotingCycleStartDate);

            await electCandidates(bvsElections,[accounts[1],accounts[2], accounts[3], accounts[4], accounts[5]]);
            await admin.syncElectedPoliticalActors();

            politicalActor = await bvsVoting.connect(accounts[1]);

            await time.increaseTo(mockFirstVotingCycleStartDate + TimeQuantities.DAY);

            const newVotingStartDate = mockFirstVotingCycleStartDate + 12 * TimeQuantities.DAY;
            await startNewVoting(politicalActor, newVotingStartDate)
        })

        it('should revert when account has no POLITICAL_ACTOR role', async () => {
            const votingKey = await politicalActor.votingKeys(0);

            const account2 = await bvsVoting.connect(accounts[10]);

            await expect(
                account2.publishProConArticle(votingKey, 'ipfs-hash', true)
            ).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[10].address, Roles.POLITICAL_ACTOR));
        })

        it('should revert when account has no more publish credit related to a specific voting', async () => {
            const votingKey = await politicalActor.votingKeys(0);

            await politicalActor.publishProConArticle(votingKey, 'ipfs-hash', true)
            await politicalActor.publishProConArticle(votingKey, 'ipfs-hash', true)

            await expect(politicalActor.publishProConArticle(votingKey, 'ipfs-hash', true)).to.be.revertedWith(
                "You don't have more credit (related to this voting) to publish"
            );
        })

        it('should publish an article', async () => {
            const votingKey = await politicalActor.votingKeys(0);

            await politicalActor.publishProConArticle(votingKey, 'ipfs-hash', true)

            const articleKey = await politicalActor.articleKeys(0);
            
            deepEqual((await politicalActor.proConArticles(votingKey, articleKey)),[
                votingKey,
                false,
                false,
                accounts[1].address,
                'ipfs-hash',
                true,
                "",
                "",
                ""
            ])

            assert.equal(await politicalActor.publishArticleToVotingsCount(accounts[1].address, votingKey), BigInt(1))
        })
    })

    describe('assignQuizIpfsHashToArticleOrResponse', async () => {
        const mockFirstVotingCycleStartDate = FAR_FUTURE_DATE
        let politicalActor: BVS_Voting
        let votingKey: string;
        let articleKey: string      

        beforeEach(async () => {
            await admin.setFirstVotingCycleStartDate(mockFirstVotingCycleStartDate);

            await electCandidates(bvsElections,[accounts[1],accounts[2], accounts[3], accounts[4], accounts[5]]);
            await admin.syncElectedPoliticalActors();

            politicalActor = await bvsVoting.connect(accounts[1]);

            await time.increaseTo(mockFirstVotingCycleStartDate + TimeQuantities.DAY);

            const newVotingStartDate = mockFirstVotingCycleStartDate + 12 * TimeQuantities.DAY;
            await startNewVoting(politicalActor, newVotingStartDate)

            votingKey = await politicalActor.votingKeys(0);

            await politicalActor.publishProConArticle(votingKey, 'ipfs-hash', true)

            articleKey = await politicalActor.articleKeys(0);
        })

        it('should revert when account has no ADMINISTRATOR role', async () => {
            const account2 = await bvsVoting.connect(accounts[2]);

            await expect(
                account2.assignQuizIpfsHashToArticleOrResponse(votingKey, articleKey, 'quiz-ipfs-hash', true)
            ).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[2].address, Roles.ADMINISTRATOR));
        })

        it('should revert when article not exists', async () => {
            await expect(admin.assignQuizIpfsHashToArticleOrResponse(votingKey, votingKey, 'quiz-ipfs-hash', true)).to.be.revertedWithCustomError(bvsVoting,
                "ArticleNotExists"
            );
        })

        it('should assign ipfs-hash to article content check', async () => {
            await admin.assignQuizIpfsHashToArticleOrResponse(votingKey, articleKey, 'article-content-quiz-ipfs-hash', true)
            
            assert.equal((await admin.proConArticles(votingKey, articleKey)).articleContentCheckQuizIpfsHash, 'article-content-quiz-ipfs-hash')
        })

        it('should assign ipfs-hash to article response check', async () => {
            await admin.assignQuizIpfsHashToArticleOrResponse(votingKey, articleKey, 'article-response-quiz-ipfs-hash', false)
            
            assert.equal((await admin.proConArticles(votingKey, articleKey)).responseContentCheckQuizIpfsHash, 'article-response-quiz-ipfs-hash')
        })
    })

    describe('addKeccak256HashedAnswerToArticle', async () => {
        const mockFirstVotingCycleStartDate = FAR_FUTURE_DATE
        let politicalActor: BVS_Voting
        let votingKey: string;
        let articleKey: string

        beforeEach(async () => {
            await admin.setFirstVotingCycleStartDate(mockFirstVotingCycleStartDate);

            await electCandidates(bvsElections,[accounts[1],accounts[2], accounts[3], accounts[4], accounts[5]]);
            await admin.syncElectedPoliticalActors();

            politicalActor = await bvsVoting.connect(accounts[1]);

            await time.increaseTo(mockFirstVotingCycleStartDate + TimeQuantities.DAY);

            const newVotingStartDate = mockFirstVotingCycleStartDate + 12 * TimeQuantities.DAY;
            await startNewVoting(politicalActor, newVotingStartDate)

            votingKey = await politicalActor.votingKeys(0);

            await politicalActor.publishProConArticle(votingKey, 'ipfs-hash', true)

            articleKey = await politicalActor.articleKeys(0);
        })

        it('should revert when account has no ADMINISTRATOR role', async () => {
            const account2 = await bvsVoting.connect(accounts[2]);

            await expect(
                account2.addKeccak256HashedAnswersToArticle(votingKey, articleKey, [bytes32({ input: 'hashed-answer'})])
            ).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[2].address, Roles.ADMINISTRATOR));
        })

        it('should revert when article has no assigned content check quiz yet', async () => {
            await expect(admin.addKeccak256HashedAnswersToArticle(votingKey, articleKey, [bytes32({ input: 'hashed-answer'})])).to.be.revertedWithCustomError(bvsVoting,
                "NoArticleContentCheckIpfsAssignedToThisArticle"
            );
        })

        it('should revert when new no enough answers sent', async () => {
            await admin.assignQuizIpfsHashToArticleOrResponse(votingKey, articleKey, 'article-content-quiz-ipfs-hash', true)
            
            await expect(admin.addKeccak256HashedAnswersToArticle(votingKey, articleKey, generatBytes32InputArray(MIN_TOTAL_CONTENT_READ_CHECK_ANSWER-1))).to.be.revertedWithCustomError(bvsVoting,
                "NoEnoughContentReadQuizAnswerAdded"
            );

            assert.equal((await admin.proConArticles(votingKey, articleKey)).isArticleApproved, false)
        })


         it('should make article approved when min required answers get assigned', async () => {
            await admin.assignQuizIpfsHashToArticleOrResponse(votingKey, articleKey, 'article-content-quiz-ipfs-hash', true)

            await assignAnswersToArticle(admin, votingKey, articleKey)

            // assert.equal(await admin.articleContentReadCheckAnswers(articleKey, 0), bytes32({ input: 'hashed-answer'}))
            assert.equal(await admin.articleContentReadCheckAnswers(articleKey, 0), mockHashedAnwers[0])
            assert.equal((await admin.proConArticles(votingKey, articleKey)).isArticleApproved, true)
         })
    })

    describe('publishProConArticleResponse', async () => {
        const mockFirstVotingCycleStartDate = FAR_FUTURE_DATE
        let politicalActor: BVS_Voting
        let votingKey: string
        let articleKey: string
        let newVotingStartDate: number

        beforeEach(async () => {
            await admin.setFirstVotingCycleStartDate(mockFirstVotingCycleStartDate);

            await electCandidates(bvsElections,[accounts[1],accounts[2], accounts[3], accounts[4], accounts[5]]);
            await admin.syncElectedPoliticalActors();

            politicalActor = await bvsVoting.connect(accounts[1]);

            await time.increaseTo(mockFirstVotingCycleStartDate + TimeQuantities.DAY);

            newVotingStartDate = mockFirstVotingCycleStartDate + 12 * TimeQuantities.DAY;
            await startNewVoting(politicalActor, newVotingStartDate)

            votingKey = await politicalActor.votingKeys(0);

            await politicalActor.publishProConArticle(votingKey, 'ipfs-hash', true)

            articleKey = await politicalActor.articleKeys(0);
        })

        it('should revert when account has no POLITICAL_ACTOR role', async () => {
            const votingKey = await politicalActor.votingKeys(0);

            const account2 = await bvsVoting.connect(accounts[10]);

            await expect(
                account2.publishProConArticleResponse(votingKey, articleKey, 'response-ipfs-hash')
            ).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[10].address, Roles.POLITICAL_ACTOR));
        })

        it('should revert when voting already started', async () => {
            time.increaseTo(newVotingStartDate)

            await expect(politicalActor.publishProConArticleResponse(votingKey, articleKey, 'response-ipfs-hash')).to.be.revertedWithCustomError(bvsVoting,
                "VotingAlreadyStarted"
            );
        })

        it('should revert when criticized voting not belongs to the political actor', async () => {
            const politicalActor2 = await bvsVoting.connect(accounts[2]);

            time.increaseTo(newVotingStartDate - TimeQuantities.DAY)

            await expect(politicalActor2.publishProConArticleResponse(votingKey, articleKey, 'response-ipfs-hash')).to.be.revertedWithCustomError(bvsVoting,
                "ArticleNotRelatedToYourVoting"
            );
        })

        it('should publish response', async () => {
            time.increaseTo(newVotingStartDate - TimeQuantities.DAY)

            await politicalActor.publishProConArticleResponse(votingKey, articleKey, 'response-ipfs-hash')

            assert.equal((await politicalActor.proConArticles(votingKey, articleKey)).responseStatementIpfsHash, 'response-ipfs-hash')
        })
    })

    // assign quiz (assignQuizIpfsHashToArticleOrResponse) - tested

    describe('addKeccak256HashedAnswersToArticleResponse', async () => {
        const mockFirstVotingCycleStartDate = FAR_FUTURE_DATE
        let politicalActor: BVS_Voting
        let votingKey: string;
        let articleKey: string

        let newVotingStartDate: number;
        

        beforeEach(async () => {
            await admin.setFirstVotingCycleStartDate(mockFirstVotingCycleStartDate);

            await electCandidates(bvsElections,[accounts[1],accounts[2], accounts[3], accounts[4], accounts[5]]);
            await admin.syncElectedPoliticalActors();

            politicalActor = await bvsVoting.connect(accounts[1]);

            await time.increaseTo(mockFirstVotingCycleStartDate + TimeQuantities.DAY);

            newVotingStartDate = mockFirstVotingCycleStartDate + 12 * TimeQuantities.DAY;
            await startNewVoting(politicalActor, newVotingStartDate)

            votingKey = await politicalActor.votingKeys(0);

            await politicalActor.publishProConArticle(votingKey, 'ipfs-hash', true)

            articleKey = await politicalActor.articleKeys(0);
        })

        it('should revert when account has no ADMINISTRATOR role', async () => {
            const account2 = await bvsVoting.connect(accounts[2]);

            await expect(
                account2.addKeccak256HashedAnswersToArticleResponse(votingKey, articleKey, [bytes32({ input: 'hashed-answer'})])
            ).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[2].address, Roles.ADMINISTRATOR));
        })

        it('should revert when article not exists', async () => {
            await expect(admin.addKeccak256HashedAnswersToArticleResponse(votingKey, bytes32({ input: 'non-existing-article-key'}), [bytes32({ input: 'hashed-answer'})])).to.be.revertedWithCustomError(admin,
                "ArticleNotExists"
            );
        })

        it('should revert when no article response assigned ', async () => {
            await expect(admin.addKeccak256HashedAnswersToArticleResponse(votingKey, articleKey, [bytes32({ input: 'hashed-answer'})])).to.be.revertedWithCustomError(admin,
                "NoArticleResponseAssigned"
            );
        })

        it('should revert when article response has no assigned content check quiz yet', async () => {
            await politicalActor.publishProConArticleResponse(votingKey, articleKey, 'response-ipfs-hash')

            await expect(admin.addKeccak256HashedAnswersToArticleResponse(votingKey, articleKey, [bytes32({ input: 'hashed-answer'})])).to.be.revertedWithCustomError(admin,
                "NoArticleResponseContentCheckIpfsAssigned"
            );
        })

        it('should revert when voting already started', async () => {
            await politicalActor.publishProConArticleResponse(votingKey, articleKey, 'response-ipfs-hash')

            await admin.assignQuizIpfsHashToArticleOrResponse(votingKey, articleKey, 'article-content-quiz-ipfs-hash', false)

            time.increaseTo(newVotingStartDate + TimeQuantities.DAY);
            
            await expect(admin.addKeccak256HashedAnswersToArticleResponse(votingKey, articleKey, [bytes32({ input: 'hashed-answer'})])).to.be.revertedWithCustomError(admin,
                "VotingAlreadyStarted"
            );
        })

        it('should revert when no enough answers provided', async () => {
            await politicalActor.publishProConArticleResponse(votingKey, articleKey, 'response-ipfs-hash')

            await admin.assignQuizIpfsHashToArticleOrResponse(votingKey, articleKey, 'article-content-quiz-ipfs-hash', false)

            const answers = generatBytes32InputArray(MIN_TOTAL_CONTENT_READ_CHECK_ANSWER - 1);
            
            await expect(admin.addKeccak256HashedAnswersToArticleResponse(votingKey, articleKey, answers)).to.be.revertedWithCustomError(admin,
                "NoEnoughContentReadQuizAnswerAdded"
            );
        })

        it('should add new quiz question answer', async () => {
            await politicalActor.publishProConArticleResponse(votingKey, articleKey, 'response-ipfs-hash')

            await admin.assignQuizIpfsHashToArticleOrResponse(votingKey, articleKey, 'article-content-quiz-ipfs-hash', false)
             
            const answers = generatBytes32InputArray(MIN_TOTAL_CONTENT_READ_CHECK_ANSWER);

            await admin.addKeccak256HashedAnswersToArticleResponse(votingKey, articleKey, answers)

            assert.equal(await admin.articleContentResponseReadCheckAnswers(articleKey, 0), bytes32({ input: 'hashed-answer'}))
         })
    })

    describe("getAccountVotingQuizAnswerIndexes", async () => {
        let politicalActor: BVS_Voting
        let votingKey: string

        beforeEach(async () => {
            await admin.setFirstVotingCycleStartDate(FAR_FUTURE_DATE - (VOTING_DURATION - TimeQuantities.DAY));

            await electCandidates(bvsElections,[accounts[1],accounts[2], accounts[3], accounts[4], accounts[5]]);
            await admin.syncElectedPoliticalActors();

            politicalActor = await bvsVoting.connect(accounts[1]);


            await time.increaseTo(FAR_FUTURE_DATE - (VOTING_DURATION - 2 * TimeQuantities.DAY));

            await startNewVoting(politicalActor, FAR_FUTURE_DATE)

            votingKey = await politicalActor.votingKeys(0);
            await admin.assignQuizIpfsHashToVoting(votingKey, 'quiz-ipfs-hash')

            await assignAnswersToVoting(bvsVoting, votingKey, 10);
        })

        
        const mockAccountAddresses = [
            { address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', expected: [BigInt(2), BigInt(5), BigInt(9), BigInt(3), BigInt(4)] },
            { address: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8', expected: [BigInt(2), BigInt(9), BigInt(10), BigInt(8), BigInt(7)] },
            { address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', expected: [BigInt(4), BigInt(2), BigInt(5), BigInt(3), BigInt(6)] },
            { address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', expected: [BigInt(7), BigInt(8), BigInt(9), BigInt(10), BigInt(6)] },
            { address: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc', expected: [BigInt(4), BigInt(2), BigInt(6), BigInt(5), BigInt(7)] },
            { address: '0x976EA74026E726554dB657fA54763abd0C3a0aa9', expected: [BigInt(9), BigInt(8), BigInt(10), BigInt(4), BigInt(3)] },
            { address: '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955', expected: [BigInt(9), BigInt(4), BigInt(10), BigInt(7), BigInt(3)] },
            { address: '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f', expected: [BigInt(1), BigInt(2), BigInt(6), BigInt(9), BigInt(7)] },
        ];

        mockAccountAddresses.forEach((item) => {
            it("should return proper account related voting quiz answers", async () => {
                assert.deepEqual(await admin.getAccountVotingQuizAnswerIndexes(votingKey, item.address), item.expected);
            })
        })
    })

    describe("getAccountArticleQuizAnswerIndexes", async () => {
        let politicalActor: BVS_Voting
        let votingKey: string
        let articleKey: string

        beforeEach(async () => {
            await admin.setFirstVotingCycleStartDate(FAR_FUTURE_DATE - 13 * TimeQuantities.DAY);

            await electCandidates(bvsElections,[accounts[1],accounts[2], accounts[3], accounts[4], accounts[5]]);
            await admin.syncElectedPoliticalActors();

            politicalActor = await bvsVoting.connect(accounts[1]);


            await time.increaseTo(FAR_FUTURE_DATE - 12 * TimeQuantities.DAY);

            await startNewVoting(politicalActor, FAR_FUTURE_DATE)

            votingKey = await politicalActor.votingKeys(0);

            const politicalActor2 = await bvsVoting.connect(accounts[2]);

            await politicalActor2.publishProConArticle(votingKey, 'ipfs-hash', true)

            articleKey = await politicalActor.articleKeys(0);
            
            await admin.assignQuizIpfsHashToArticleOrResponse(votingKey, articleKey, 'quiz-ipfs-hash', true);

            await assignAnswersToArticle(bvsVoting, votingKey, articleKey);
        })

        
        const mockAccountAddresses = [
            { address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', expected: [BigInt(1), BigInt(7), BigInt(9), BigInt(2), BigInt(3)] },
            { address: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8', expected: [BigInt(9), BigInt(5), BigInt(10), BigInt(1), BigInt(3)] },
            { address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', expected: [BigInt(7), BigInt(4), BigInt(2), BigInt(6), BigInt(8)] },
            { address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', expected: [BigInt(6), BigInt(10), BigInt(7), BigInt(8), BigInt(9)] },
            { address: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc', expected: [BigInt(8), BigInt(5), BigInt(6), BigInt(7), BigInt(9)] },
            { address: '0x976EA74026E726554dB657fA54763abd0C3a0aa9', expected: [BigInt(2), BigInt(5), BigInt(3), BigInt(8), BigInt(1)] },
            { address: '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955', expected: [BigInt(9), BigInt(6), BigInt(2), BigInt(10), BigInt(4)] },
            { address: '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f', expected: [BigInt(4), BigInt(6), BigInt(3), BigInt(5), BigInt(7)] },
        ];

        mockAccountAddresses.forEach((item) => {
            it("should return proper account related article quiz answers", async () => {
                assert.deepEqual(await admin.getAccountArticleQuizAnswerIndexes(votingKey, articleKey, item.address), item.expected);
            })
        })
    })

    describe("getAccountArticleResponseQuizAnswerIndexes", async () => {
        let politicalActor: BVS_Voting
        let votingKey: string
        let articleKey: string

        beforeEach(async () => {
            await admin.setFirstVotingCycleStartDate(FAR_FUTURE_DATE - 13 * TimeQuantities.DAY);

            await electCandidates(bvsElections,[accounts[1],accounts[2], accounts[3], accounts[4], accounts[5]]);
            await admin.syncElectedPoliticalActors();

            politicalActor = await bvsVoting.connect(accounts[1]);


            await time.increaseTo(FAR_FUTURE_DATE - 12 * TimeQuantities.DAY);

            await startNewVoting(politicalActor, FAR_FUTURE_DATE)

            votingKey = await politicalActor.votingKeys(0);

            const politicalActor2 = await bvsVoting.connect(accounts[2]);

            await politicalActor2.publishProConArticle(votingKey, 'ipfs-hash', true)

            articleKey = await politicalActor.articleKeys(0);

            await politicalActor.publishProConArticleResponse(votingKey, articleKey, 'ipfs-response-hash')
            
            await admin.assignQuizIpfsHashToArticleOrResponse(votingKey, articleKey, 'quiz-ipfs-hash', false);

            await assignAnswersToArticleResponse(bvsVoting, votingKey, articleKey);
        })

        
        const mockAccountAddresses = [
            { address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', expected: [BigInt(9), BigInt(2), BigInt(4), BigInt(10), BigInt(5)] },
            { address: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8', expected: [BigInt(8), BigInt(9), BigInt(4), BigInt(5), BigInt(1)] },
            { address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', expected: [BigInt(10), BigInt(6), BigInt(7), BigInt(8), BigInt(9)] },
            { address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', expected: [BigInt(8), BigInt(6), BigInt(4), BigInt(5), BigInt(7)] },
            { address: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc', expected: [BigInt(3), BigInt(1), BigInt(4), BigInt(8), BigInt(5)] },
            { address: '0x976EA74026E726554dB657fA54763abd0C3a0aa9', expected: [BigInt(2), BigInt(3), BigInt(1), BigInt(10), BigInt(4)] },
            { address: '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955', expected: [BigInt(8), BigInt(2), BigInt(7), BigInt(10), BigInt(3)] },
            { address: '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f', expected: [BigInt(10), BigInt(1), BigInt(7), BigInt(5), BigInt(6)] },
        ];

        mockAccountAddresses.forEach((item) => {
            it("should return proper account related article response quiz answers", async () => {
                assert.deepEqual(await admin.getAccountArticleResponseQuizAnswerIndexes(votingKey, articleKey, item.address), item.expected);
            })
        })
    })

    describe("completeVotingContentReadQuiz", async () => {
        let politicalActor: BVS_Voting
        let votingKey: string

        beforeEach(async () => {
            await admin.setFirstVotingCycleStartDate(FAR_FUTURE_DATE - 13 * TimeQuantities.DAY);

            await electCandidates(bvsElections,[accounts[1],accounts[2], accounts[3], accounts[4], accounts[5]]);
            await admin.syncElectedPoliticalActors();

            politicalActor = await bvsVoting.connect(accounts[1]);


            await time.increaseTo(FAR_FUTURE_DATE - 12 * TimeQuantities.DAY);

            await startNewVoting(politicalActor, FAR_FUTURE_DATE)

            votingKey = await politicalActor.votingKeys(0);
            await admin.assignQuizIpfsHashToVoting(votingKey, 'quiz-ipfs-hash')
        })

        it('should revert when account has no CITIZEN role', async () => {
            const votingKey = await politicalActor.votingKeys(0);

            await assignAnswersToVoting(bvsVoting, votingKey, 10);

            const account2 = await bvsVoting.connect(accounts[27]);

            await expect(
                account2.completeVotingContentReadQuiz(votingKey, [])
            ).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[27].address, Roles.CITIZEN));
        })

        it('should revert when any of the provided answers are wrong', async () => {
            const votingKey = await politicalActor.votingKeys(0);

            await assignAnswersToVoting(bvsVoting, votingKey, 10);

            const account = await bvsVoting.connect(accounts[1]);

            await expect(account.completeVotingContentReadQuiz(votingKey, [
                "answer-1",
                "answer-2",
                "answer-3",
                "answer-4",
                "answer-5"
            ])).to.be.revertedWith(
                "Some of your provided answers are wrong"
            );
        })

        it('should complete voting when provided answers are correct', async () => {
            const votingKey = await politicalActor.votingKeys(0);

            await assignAnswersToVoting(bvsVoting, votingKey, 10);

            await completeVoting(admin, accounts[1])

            assert.equal((await admin.votes(accounts[1].address, votingKey)).isContentCompleted, true); 
        })
    })


    describe("completeArticleReadQuiz", async () => {
        let politicalActor: BVS_Voting
        let votingKey: string
        let articleKey: string

        beforeEach(async () => {
            await admin.setFirstVotingCycleStartDate(FAR_FUTURE_DATE - 13 * TimeQuantities.DAY);

            await electCandidates(bvsElections,[accounts[1],accounts[2], accounts[3], accounts[4], accounts[5]]);
            await admin.syncElectedPoliticalActors();

            politicalActor = await bvsVoting.connect(accounts[1]);


            await time.increaseTo(FAR_FUTURE_DATE - 12 * TimeQuantities.DAY);

            await startNewVoting(politicalActor, FAR_FUTURE_DATE)

            votingKey = await politicalActor.votingKeys(0);
            await admin.assignQuizIpfsHashToVoting(votingKey, 'quiz-ipfs-hash')

            const politicalActor2 = await bvsVoting.connect(accounts[2]);

            await politicalActor2.publishProConArticle(votingKey, 'ipfs-hash', true)

            articleKey = await politicalActor.articleKeys(0);
            
            await admin.assignQuizIpfsHashToArticleOrResponse(votingKey, articleKey, 'quiz-ipfs-hash', true);
        })

        it('should revert when account has no CITIZEN role', async () => {
            await assignAnswersToArticle(bvsVoting, votingKey, articleKey);

            const account2 = await bvsVoting.connect(accounts[23]);

            await expect(
                account2.completeArticleReadQuiz(votingKey, articleKey, [])
            ).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[23].address, Roles.CITIZEN));
        })

        it('should revert when article quiz already completed', async () => {
            await assignAnswersToArticle(bvsVoting, votingKey, articleKey);

            await completeArticle(admin, accounts[1])

            const account = await bvsVoting.connect(accounts[1]);

            await expect(account.completeArticleReadQuiz(votingKey, articleKey, [])).to.be.revertedWith(
                "You already completed this article quiz"
            );
        })

        it('should revert when any of the provided answers are wrong', async () => {
            await assignAnswersToArticle(bvsVoting, votingKey, articleKey);

            const account = await bvsVoting.connect(accounts[1]);

            await expect(account.completeArticleReadQuiz(votingKey, articleKey, [
                "answer-1",
                "answer-2",
                "answer-3",
                "answer-4",
                "answer-5"
            ])).to.be.revertedWith(
                "Some of your provided answers are wrong"
            );
        })

        it('should complete article quiz when provided answers are correct', async () => {
            await assignAnswersToArticle(bvsVoting, votingKey, articleKey);

            await completeArticle(admin, accounts[1])

            assert.equal(await admin.articlesCompleted(accounts[1].address, 0), articleKey); 
        })
    })


    describe("completeArticleResponseQuiz", async () => {
        let politicalActor: BVS_Voting
        let votingKey: string
        let articleKey: string

        beforeEach(async () => {
            await admin.setFirstVotingCycleStartDate(FAR_FUTURE_DATE - 13 * TimeQuantities.DAY);

            await electCandidates(bvsElections,[accounts[1],accounts[2], accounts[3], accounts[4], accounts[5]]);
            await admin.syncElectedPoliticalActors();

            politicalActor = await bvsVoting.connect(accounts[1]);


            await time.increaseTo(FAR_FUTURE_DATE - 12 * TimeQuantities.DAY);

            await startNewVoting(politicalActor, FAR_FUTURE_DATE);

            votingKey = await politicalActor.votingKeys(0);

            await addQuizAndContentCheckAnswersToVoting(admin);

            await addArticleToVotingWithQuizAndAnswers(admin, accounts[2], true)

            articleKey = await politicalActor.articleKeys(0);

            await politicalActor.publishProConArticleResponse(votingKey, articleKey, 'article-response-ipfs-hash')
            
            await admin.assignQuizIpfsHashToArticleOrResponse(votingKey, articleKey, 'quiz-ipfs-hash', false);
        })

        it('should revert when account has no CITIZEN role', async () => {
            await assignAnswersToArticleResponse(bvsVoting, votingKey, articleKey);

            const account2 = await bvsVoting.connect(accounts[24]);

            await expect(
                account2.completeArticleResponseQuiz(votingKey, articleKey, [])
            ).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[24].address, Roles.CITIZEN));
        })

        it('should revert when citizen already completed the quiz', async () => {
            await assignAnswersToArticleResponse(bvsVoting, votingKey, articleKey);

            await completeArticleResponse(admin, accounts[1])

            const account = await bvsVoting.connect(accounts[1]);

            await expect(account.completeArticleResponseQuiz(votingKey, articleKey, [])).to.be.revertedWith(
                "You already completed this article response quiz"
            );
        })

        it('should revert when any of the provided answers are wrong', async () => {
            await assignAnswersToArticleResponse(bvsVoting, votingKey, articleKey);

            const account = await bvsVoting.connect(accounts[1]);

            await expect(account.completeArticleResponseQuiz(votingKey, articleKey, [
                "answer-1",
                "answer-2",
                "answer-3",
                "answer-4",
                "answer-5"
            ])).to.be.revertedWith(
                "Some of your provided answers are wrong"
            );
        })

        it('should complete article response quiz when provided answers are correct', async () => {
            await assignAnswersToArticleResponse(bvsVoting, votingKey, articleKey);

            await completeArticleResponse(admin, accounts[1])

            assert.equal(await admin.articlesResponseCompleted(accounts[1].address, 0), articleKey); 
        })
    })

    describe("voteOnVoting", async () => {
        let politicalActor: BVS_Voting
        let votingKey: string
        let articleKey: string

        beforeEach(async () => {
            await admin.setFirstVotingCycleStartDate(FAR_FUTURE_DATE - 13 * TimeQuantities.DAY);

            await electCandidates(bvsElections,[accounts[1],accounts[2], accounts[3], accounts[4], accounts[5]]);
            await admin.syncElectedPoliticalActors();

            politicalActor = await bvsVoting.connect(accounts[1]);


            await time.increaseTo(FAR_FUTURE_DATE - 12 * TimeQuantities.DAY);

            await startNewVoting(politicalActor, FAR_FUTURE_DATE)

            await addQuizAndContentCheckAnswersToVoting(admin)


            votingKey = await politicalActor.votingKeys(0);
        })

        it('should revert when account has no CITIZEN role', async () => {
            const account = await bvsVoting.connect(accounts[25]);

            await expect(
                account.voteOnVoting(votingKey, true)
            ).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[25].address, Roles.CITIZEN));
        })

        it('should revert when voting already started', async () => {
            const account = await bvsVoting.connect(accounts[1]);

            await expect(account.voteOnVoting(votingKey, true)).to.be.revertedWith(
                "Voting is not yet started or it is already finished"
            );
        })

        it('should revert when voting already finished', async () => {
            const account = await bvsVoting.connect(accounts[1]);

            await time.increaseTo(FAR_FUTURE_DATE + VOTING_DURATION);

            await expect(account.voteOnVoting(votingKey, true)).to.be.revertedWith(
                "Voting is not yet started or it is already finished"
            );
        })

        it('should revert when voting not approved', async () => {
            const account = await bvsVoting.connect(accounts[1]);

            await time.increaseTo(FAR_FUTURE_DATE + VOTING_DURATION - TimeQuantities.DAY);

            await expect(account.voteOnVoting(votingKey, true)).to.be.revertedWith(
                "Voting is not approved for some reason"
            );
        })

        it('should revert when citizen did not completed voting content check quiz', async () => {
            const account = await bvsVoting.connect(accounts[1]);

            await time.increaseTo(FAR_FUTURE_DATE - APPROVE_VOTING_BEFORE_IT_STARTS_LIMIT);

            await admin.approveVoting(votingKey)

            await time.increaseTo(FAR_FUTURE_DATE + VOTING_DURATION - TimeQuantities.DAY);

            await expect(account.voteOnVoting(votingKey, true)).to.be.revertedWith(
                "Content check quiz not completed"
            );
        })

        it('should revert when citizen already voted', async () => {
            const account = await bvsVoting.connect(accounts[1]);

            await time.increaseTo(FAR_FUTURE_DATE - APPROVE_VOTING_BEFORE_IT_STARTS_LIMIT);

            await admin.approveVoting(votingKey)

            await time.increaseTo(FAR_FUTURE_DATE + VOTING_DURATION - TimeQuantities.DAY);

            await completeVoting(admin, accounts[1]);

            await account.voteOnVoting(votingKey, true);

            await expect(account.voteOnVoting(votingKey, true)).to.be.revertedWith(
                "You already voted on this voting"
            );
        })

        it('should count citizen voting score properly when there is no expected additional score', async () => {
            await addArticleToVotingWithQuizAndAnswers(admin, accounts[2], true);

            articleKey = await politicalActor.articleKeys(0);

            await addResponseToArticleWithQuizAndAnswers(admin, accounts[1]);

            const account = await bvsVoting.connect(accounts[1]);
            const account2 = await bvsVoting.connect(accounts[2]);
            const account3 = await bvsVoting.connect(accounts[3]);

            await time.increaseTo(FAR_FUTURE_DATE - APPROVE_VOTING_BEFORE_IT_STARTS_LIMIT);

            await admin.approveVoting(votingKey)

            await time.increaseTo(FAR_FUTURE_DATE + VOTING_DURATION - TimeQuantities.DAY);

            assert.equal((await admin.votings(votingKey)).voteOnAScore, BigInt(0));
            assert.equal((await admin.votings(votingKey)).voteOnBScore, BigInt(0));
            assert.equal((await admin.votings(votingKey)).voteCount, BigInt(0));
            
            await completeVoting(admin, accounts[1]);
            await completeVoting(admin, accounts[2]);
            await completeVoting(admin, accounts[3]);

            await account.voteOnVoting(votingKey, true);
            await account2.voteOnVoting(votingKey, false);
            await account3.voteOnVoting(votingKey, false);

            assert.equal((await admin.votings(votingKey)).voteOnAScore, BigInt(MIN_VOTE_SCORE));
            assert.equal((await admin.votings(votingKey)).voteOnBScore, BigInt(2 * MIN_VOTE_SCORE));
            assert.equal((await admin.votings(votingKey)).voteCount, BigInt(3));
        })

        it('should count citizen voting score properly when citizen completed related articles', async () => {
            const account = await bvsVoting.connect(accounts[1]);

            await time.increaseTo(FAR_FUTURE_DATE - APPROVE_VOTING_BEFORE_IT_STARTS_LIMIT);

            await admin.approveVoting(votingKey)

            await addArticleToVotingWithQuizAndAnswers(admin, accounts[2], true);

            await addResponseToArticleWithQuizAndAnswers(admin, accounts[1]);

            await addArticleToVotingWithQuizAndAnswers(admin, accounts[2], false); // publish and assign new article

            await addResponseToArticleWithQuizAndAnswers(admin, accounts[1]);

            await addArticleToVotingWithQuizAndAnswers(admin, accounts[3], false); // publish and assign new article

            await addResponseToArticleWithQuizAndAnswers(admin, accounts[1]);

            await time.increaseTo(FAR_FUTURE_DATE + VOTING_DURATION - TimeQuantities.DAY);

            await completeVoting(admin, accounts[1]);


            let articleKey1 = await politicalActor.articleKeys(0);
            let articleKey2 = await politicalActor.articleKeys(1);
            let articleKey3 = await politicalActor.articleKeys(2);


            await completeArticle(admin, accounts[1], articleKey1); // complete first article
            await completeArticleResponse(admin, accounts[1], articleKey1);

            await completeArticle(admin, accounts[1], articleKey2); // complete second article
            await completeArticleResponse(admin, accounts[1], articleKey2);

            await completeArticle(admin, accounts[1], articleKey3); // complete third article
            await completeArticleResponse(admin, accounts[1], articleKey3);

            await account.voteOnVoting(votingKey, true);

            assert.equal((await account.votings(votingKey)).voteOnAScore, BigInt(MIN_VOTE_SCORE + 42));
            assert.equal((await admin.votings(votingKey)).voteCount, BigInt(1));
        })
    })

    describe("helper functions", () => {
        describe("isBytes32ArrayContains", async () => {
            it("should return false when bytes32 value is not in the array", async () => {
                assert.equal(await bvsVoting.isBytes32ArrayContains([
                    bytes32({ input: 'test-1' }),
                ], bytes32({ input: 'test-2' })), false);
            });

            it("should return true when bytes32 value is in the array", async () => {
                assert.equal(await bvsVoting.isBytes32ArrayContains([
                    bytes32({ input: 'test-1' }),
                    bytes32({ input: 'test-2' })
                ], bytes32({ input: 'test-2' })), true);
            });
        })

       /* describe("calculateExtraVotingScore", async () => {
            it("should return proper result", async () => {
                assert.equal(await bvsVoting.calculateExtraVotingScore(0, 0, 0, 0), BigInt(0));
                assert.equal(await bvsVoting.calculateExtraVotingScore(0, 1, 0, 1), BigInt(7));
                assert.equal(await bvsVoting.calculateExtraVotingScore(1, 1, 1, 1), BigInt(35));
                assert.equal(await bvsVoting.calculateExtraVotingScore(2, 2, 2, 2), BigInt(70));
                assert.equal(await bvsVoting.calculateExtraVotingScore(2, 3, 1, 1), BigInt(65));
                assert.equal(await bvsVoting.calculateExtraVotingScore(8, 3, 4, 1), BigInt(116));
                assert.equal(await bvsVoting.calculateExtraVotingScore(22, 8, 0, 0), BigInt(270));
            });
        }) */
    })
})