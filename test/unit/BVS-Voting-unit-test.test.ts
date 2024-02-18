import { deployments, ethers } from 'hardhat';

import { BVS_Voting } from '../../typechain-types';
import { assert, expect } from 'chai';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

import { time } from "@nomicfoundation/hardhat-network-helpers";
import { NOW, Roles, TimeQuantities, assignAnwersToArticle, assignAnwersToArticleResponse, assignAnwersToVoting, citizensVoteOnElectionsCandidate, citizensVoteOnPreElectionsCandidate, getPermissionDenyReasonMessage, grantCitizenshipForAllAccount } from '../../utils/helpers';
import { deepEqual } from 'assert';

const bytes32 = require('bytes32');



const _now = Math.round(Date.now() / 1000);

describe("BVS_Voting", () => {
    let bvsVoting: BVS_Voting;
    let deployer: SignerWithAddress;
    let accounts: SignerWithAddress[];
    let MIN_TOTAL_CONTENT_READ_CHECK_ANSWER: number
    beforeEach(async () => {
        accounts = await ethers.getSigners()

        const deploymentResults = await deployments.fixture(['bvs_voting']);

        const bvsAddress: string = deploymentResults['BVS_Voting']?.address;

        bvsVoting = await ethers.getContractAt('BVS_Voting', bvsAddress);

        const admin = await bvsVoting.connect(accounts[0]);

        MIN_TOTAL_CONTENT_READ_CHECK_ANSWER = Number(await admin.MIN_TOTAL_CONTENT_READ_CHECK_ANSWER())
    })

    describe('setFirstVotingCycleStartDate', () => {
        const firstVotingCycleStartDate = NOW + TimeQuantities.HOUR

        it('should revert when non ADMINISTRATOR calls it', async () => {
            const bvsVotingAccount1 = await bvsVoting.connect(accounts[1]);

            await expect(
                bvsVotingAccount1.setFirstVotingCycleStartDate(NOW + TimeQuantities.MONTH)
            ).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[1].address, Roles.ADMINISTRATOR));
        })

        it('should revert when passed date is before now', async () => {
            const admin = await bvsVoting.connect(accounts[0]);

            await expect(admin.setFirstVotingCycleStartDate(NOW - TimeQuantities.HOUR)).to.be.revertedWith('Voting cycle start date has to be in the future');
        })

        it('should update firstVotingCycleStartDate with passed date', async () => {
            const admin = await bvsVoting.connect(accounts[0]);

            
            await admin.setFirstVotingCycleStartDate(firstVotingCycleStartDate);

            await assert.equal(await admin.firstVotingCycleStartDate(), BigInt(firstVotingCycleStartDate))
        })

        it('should update firstVotingCycleStartDate with passed date and has to clear previous voting cycle indexes', async () => {
            const admin = await bvsVoting.connect(accounts[0]);

            await admin.setFirstVotingCycleStartDate(firstVotingCycleStartDate);

            await admin.firstVotingCycleStartDate(), BigInt(firstVotingCycleStartDate)

            await admin.grantPoliticalActorRole(accounts[0].address, 2);


            await time.increaseTo(firstVotingCycleStartDate + 10 * TimeQuantities.DAY);

            await admin.scheduleNewVoting('ipfs-hash',firstVotingCycleStartDate + 22 * TimeQuantities.DAY);

            await assert.equal((await admin.votingCycleStartVoteCount(BigInt(0), accounts[0].address)), BigInt(1))
            await assert.equal(await admin.getVotinCycleIndexesSize(), BigInt(1))
            

            await admin.setFirstVotingCycleStartDate(firstVotingCycleStartDate + 30 * TimeQuantities.DAY);

            await assert.equal((await admin.votingCycleStartVoteCount(BigInt(0), accounts[0].address)), BigInt(0))
            await assert.equal(await admin.getVotinCycleIndexesSize(), BigInt(0))
            
        })
    })

    describe('scheduleNewVoting', () => {
        const mockFirstVotingCycleStartDate = NOW + TimeQuantities.HOUR

        beforeEach(async () => {
            const admin = await bvsVoting.connect(accounts[0]);

            await admin.setFirstVotingCycleStartDate(mockFirstVotingCycleStartDate);

            await admin.grantPoliticalActorRole(accounts[1].address, 2);
        })

        it('should revert when non POLITICAL_ACTOR calls it', async () => {
            const bvsVotingAccount2 = await bvsVoting.connect(accounts[2]);

            await expect(
                bvsVotingAccount2.scheduleNewVoting(
                    'ipfs-hash',
                    NOW
                )
            ).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[2].address, Roles.POLITICAL_ACTOR));
        })

        it('should revert when actual date is before first voting cycle start date', async () => {
            const politicalActor = await bvsVoting.connect(accounts[1]);

            await time.increaseTo(mockFirstVotingCycleStartDate - 1);

            await expect(politicalActor.scheduleNewVoting('ipfs-hash', mockFirstVotingCycleStartDate)).to.be.revertedWith('Start new voting period is not yet active');
        })
        
        it('should revert when new voting not scheduled 10 days ahead from now', async () => {
            const politicalActor = await bvsVoting.connect(accounts[1]);

            await time.increaseTo(mockFirstVotingCycleStartDate + TimeQuantities.HOUR);

            await expect(politicalActor.scheduleNewVoting('ipfs-hash', mockFirstVotingCycleStartDate + 10 * TimeQuantities.DAY)).to.be.revertedWith('New voting has to be scheduled 10 days later from now');
        })

        it('should revert when new voting scheduled later than one VOTING_CYCLE_INTERVAL', async () => {
            const politicalActor = await bvsVoting.connect(accounts[1]);

            await time.increaseTo(mockFirstVotingCycleStartDate + TimeQuantities.HOUR);

            await expect(politicalActor.scheduleNewVoting('ipfs-hash', mockFirstVotingCycleStartDate + 31 * TimeQuantities.DAY)).to.be.revertedWith('New voting start date can only be scheduled within 30 days ahead');
        })


        it('should revert when new voting scheduled before 10 days of the end of the actual ongoing voting cycle', async () => {
            const politicalActor = await bvsVoting.connect(accounts[1]);

            await time.increaseTo(mockFirstVotingCycleStartDate + 20 * TimeQuantities.DAY);

            await expect(politicalActor.scheduleNewVoting('ipfs-hash', mockFirstVotingCycleStartDate + 31 * TimeQuantities.DAY)).to.be.revertedWith(
                "You can't start new voting 10 days or less before the ongoing voting cycle ends"
            );
        })

        it('should revert when political actor runs out of start new voting credits', async () => {
            const politicalActor = await bvsVoting.connect(accounts[1]);

            await time.increaseTo(mockFirstVotingCycleStartDate + 10 * TimeQuantities.DAY);

            await assert.equal((await politicalActor.votingCycleStartVoteCount(BigInt(0), accounts[1].address)), BigInt(0))

            await politicalActor.scheduleNewVoting('ipfs-hash', mockFirstVotingCycleStartDate + 22 * TimeQuantities.DAY);

            await assert.equal((await politicalActor.votingCycleStartVoteCount(BigInt(0), accounts[1].address)), BigInt(1))

            await politicalActor.scheduleNewVoting('ipfs-hash', mockFirstVotingCycleStartDate + 22 * TimeQuantities.DAY);

            await assert.equal((await politicalActor.votingCycleStartVoteCount(BigInt(0), accounts[1].address)), BigInt(2))

            await expect(politicalActor.scheduleNewVoting('ipfs-hash', mockFirstVotingCycleStartDate + 22 * TimeQuantities.DAY)).to.be.revertedWith(
                "You ran out of start new voting credits in this voting cycle"
            );
        })

        it('should add new voting', async () => {
            const politicalActor = await bvsVoting.connect(accounts[1]);

            await time.increaseTo(mockFirstVotingCycleStartDate + 10 * TimeQuantities.DAY);

            const newVotingStartDate = mockFirstVotingCycleStartDate + 22 * TimeQuantities.DAY;
            await politicalActor.scheduleNewVoting('ipfs-hash', newVotingStartDate);

            await assert.equal((await politicalActor.votingCycleStartVoteCount(BigInt(0), accounts[1].address)), BigInt(1));


            const votingKey = await politicalActor.votingKeys(0);

            deepEqual((await politicalActor.votings(votingKey)),[
                false,
                false,
                votingKey,
                accounts[1].address,
                'ipfs-hash',
                newVotingStartDate,
                0,
                0,
                ''
            ])
        })

        it("should increase voting cycle count when we are in the following voting cycle", async () => {
            const politicalActor = await bvsVoting.connect(accounts[1]);

            await time.increaseTo(mockFirstVotingCycleStartDate + 10 * TimeQuantities.DAY);

            await assert.equal((await politicalActor.votingCycleStartVoteCount(BigInt(0), accounts[1].address)), BigInt(0))

            await politicalActor.scheduleNewVoting('ipfs-hash', mockFirstVotingCycleStartDate + 22 * TimeQuantities.DAY);

            await time.increaseTo(mockFirstVotingCycleStartDate + 31 * TimeQuantities.DAY);

            await politicalActor.scheduleNewVoting('ipfs-hash', mockFirstVotingCycleStartDate + 42 * TimeQuantities.DAY);


            await assert.equal(await politicalActor.getVotinCycleIndexesSize(), BigInt(2))
            await assert.equal(await politicalActor.votingCycleIndexes(0), BigInt(0))
            await assert.equal(await politicalActor.votingCycleIndexes(1), BigInt(1))
        })
    })

    describe('cancelMyVoting', async () => {
        const mockFirstVotingCycleStartDate = NOW + TimeQuantities.HOUR
        let politicalActor: BVS_Voting
        let admin: BVS_Voting

        beforeEach(async () => {
            admin = await bvsVoting.connect(accounts[0]);

            await admin.setFirstVotingCycleStartDate(mockFirstVotingCycleStartDate);

            await admin.grantPoliticalActorRole(accounts[1].address, 2);

            politicalActor = await bvsVoting.connect(accounts[1]);

            await time.increaseTo(mockFirstVotingCycleStartDate + TimeQuantities.DAY);

            const newVotingStartDate = mockFirstVotingCycleStartDate + 12 * TimeQuantities.DAY;
            await politicalActor.scheduleNewVoting('ipfs-hash', newVotingStartDate);
        })

        it('should revert when account has no POLITICAL_ACTOR role', async () => {

            const votingKey = await politicalActor.votingKeys(0);

            const account2 = await bvsVoting.connect(accounts[2]);

            await expect(
                account2.cancelMyVoting(votingKey)
            ).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[2].address, Roles.POLITICAL_ACTOR));
        })

        it('should revert when voting not belongs to the account', async () => {
            const admin = await bvsVoting.connect(accounts[0]);
            admin.grantPoliticalActorRole(accounts[2], 2);

            const votingKey = await politicalActor.votingKeys(0);

            const politicalActor2 = await bvsVoting.connect(accounts[2]);

            await expect(politicalActor2.cancelMyVoting(votingKey)).to.be.revertedWith(
                "Only the creator of the voting is allowed to cancel it"
            );
        })

        it('should revert when voting start date already passed', async () => {
            const votingKey = await politicalActor.votingKeys(0);

            await time.increaseTo(mockFirstVotingCycleStartDate + 13 * TimeQuantities.DAY);

            await expect(politicalActor.cancelMyVoting(votingKey)).to.be.revertedWith(
                "Your voting start date already passed"
            );
        })

        it('should cancel voting', async () => {
            const votingKey = await politicalActor.votingKeys(0);

            await time.increaseTo(mockFirstVotingCycleStartDate + 11 * TimeQuantities.DAY);

            await politicalActor.cancelMyVoting(votingKey)

            assert.equal((await politicalActor.votings(votingKey)).cancelled, true);
        })
    })

    describe('assignQuizIpfsHashToVoting', () => {
        const mockFirstVotingCycleStartDate = NOW + TimeQuantities.HOUR
        let politicalActor: BVS_Voting
        let admin: BVS_Voting
        let newVotingStartDate: number

        beforeEach(async () => {
            admin = await bvsVoting.connect(accounts[0]);

            await admin.setFirstVotingCycleStartDate(mockFirstVotingCycleStartDate);

            await admin.grantPoliticalActorRole(accounts[1].address, 2);

            politicalActor = await bvsVoting.connect(accounts[1]);


            await time.increaseTo(mockFirstVotingCycleStartDate + TimeQuantities.DAY);

            newVotingStartDate = mockFirstVotingCycleStartDate + 12 * TimeQuantities.DAY;
            await politicalActor.scheduleNewVoting('ipfs-hash', newVotingStartDate);
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
        const mockFirstVotingCycleStartDate = NOW + TimeQuantities.HOUR
        let politicalActor: BVS_Voting
        let admin: BVS_Voting
        let newVotingStartDate: number

        beforeEach(async () => {
            admin = await bvsVoting.connect(accounts[0]);

            await admin.setFirstVotingCycleStartDate(mockFirstVotingCycleStartDate);

            await admin.grantPoliticalActorRole(accounts[1].address, 2);

            politicalActor = await bvsVoting.connect(accounts[1]);


            await time.increaseTo(mockFirstVotingCycleStartDate + TimeQuantities.DAY);

            newVotingStartDate = mockFirstVotingCycleStartDate + 12 * TimeQuantities.DAY;
            await politicalActor.scheduleNewVoting('ipfs-hash', newVotingStartDate);
        })

        it('should revert when account has no ADMINISTRATOR role', async () => {
            const votingKey = await politicalActor.votingKeys(0);

            const account2 = await bvsVoting.connect(accounts[2]);

            await expect(
                account2.addKeccak256HashedAnswerToVotingContent(votingKey, bytes32('hashed-answer'))
            ).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[2].address, Roles.ADMINISTRATOR));
        })

        it('should revert when voting content check quiz ipfs not yet assigned', async () => {
            const votingKey = await politicalActor.votingKeys(0);

            await expect(admin.addKeccak256HashedAnswerToVotingContent(votingKey, bytes32('hashed-answer'))).to.be.revertedWith(
                "No voting content check quiz ipfs assigned yet"
            );
        })

        it('should assign answers to voting quiz', async () => {
            const votingKey = await politicalActor.votingKeys(0);

            await admin.assignQuizIpfsHashToVoting(votingKey, 'quiz-ipfs-hash')

            await admin.addKeccak256HashedAnswerToVotingContent(votingKey, bytes32('hashed-answer-1'))
            await admin.addKeccak256HashedAnswerToVotingContent(votingKey, bytes32('hashed-answer-2'))

            assert.equal((await politicalActor.votingContentReadCheckAnswers(votingKey, 0)), bytes32('hashed-answer-1'));
            assert.equal((await politicalActor.votingContentReadCheckAnswers(votingKey, 1)), bytes32('hashed-answer-1'));
        })
    })

    describe('approveVoting', async () => {
        const mockFirstVotingCycleStartDate = NOW + TimeQuantities.HOUR
        let politicalActor: BVS_Voting
        let admin: BVS_Voting
        let newVotingStartDate: number
        let votingKey: string

        beforeEach(async () => {
            admin = await bvsVoting.connect(accounts[0]);

            await admin.setFirstVotingCycleStartDate(mockFirstVotingCycleStartDate);

            await admin.grantPoliticalActorRole(accounts[1].address, 2);

            politicalActor = await bvsVoting.connect(accounts[1]);


            await time.increaseTo(mockFirstVotingCycleStartDate + TimeQuantities.DAY);

            newVotingStartDate = mockFirstVotingCycleStartDate + 12 * TimeQuantities.DAY;
            await politicalActor.scheduleNewVoting('ipfs-hash', newVotingStartDate);

            votingKey = await politicalActor.votingKeys(0);
            await admin.assignQuizIpfsHashToVoting(votingKey, 'quiz-ipfs-hash')

            await assignAnwersToVoting(bvsVoting, votingKey, 10);
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

            await expect(admin.approveVoting(votingKey)).to.be.revertedWith(
                "Voting can only be approved before it's start date"
            );
        })

        it('should revert when voting start date is not within 3 days', async () => {
            const votingKey = await admin.votingKeys(0);

            await time.increaseTo(newVotingStartDate - 3 * TimeQuantities.DAY  - TimeQuantities.HOUR);

            await expect(admin.approveVoting(votingKey)).to.be.revertedWith(
                "Voting can only be approved 3 days or less before it's start"
            );
        })

        it('should revert when creator not responded on all the critical articles', async () => {
            const votingKey = await politicalActor.votingKeys(0);

            await admin.grantPoliticalActorRole(accounts[2].address, 2);

            const politicalActor2 = await bvsVoting.connect(accounts[2]);

            await politicalActor2.publishProConArticle(votingKey, 'ipfs-hash', true)

            const articleKey = await politicalActor.articleKeys(0);

            await time.increaseTo(newVotingStartDate - 7 * TimeQuantities.DAY);

            await admin.assignQuizIpfsHashToArticleOrResponse(votingKey, articleKey, 'article-content-quiz-ipfs-hash', true)

            await assignAnwersToArticle(admin, votingKey, articleKey, MIN_TOTAL_CONTENT_READ_CHECK_ANSWER)

            await admin.approveArticle(votingKey, articleKey)

            await time.increaseTo(newVotingStartDate - 2 * TimeQuantities.DAY);

            await expect(admin.approveVoting(votingKey)).to.be.revertedWith(
                "Creator of the voting not yet responded on all the critics"
            );
        })

        it('should approve voting', async () => {
            const votingKey = await politicalActor.votingKeys(0);

            await admin.grantPoliticalActorRole(accounts[2].address, 2);

            const politicalActor2 = await bvsVoting.connect(accounts[2]);

            await politicalActor2.publishProConArticle(votingKey, 'ipfs-hash', true)

            const articleKey = await politicalActor.articleKeys(0);

            await time.increaseTo(newVotingStartDate - 7 * TimeQuantities.DAY);

            await admin.assignQuizIpfsHashToArticleOrResponse(votingKey, articleKey, 'article-content-quiz-ipfs-hash', true)

            await assignAnwersToArticle(admin, votingKey, articleKey, MIN_TOTAL_CONTENT_READ_CHECK_ANSWER)

            await admin.approveArticle(votingKey, articleKey)

            await politicalActor.publishProConArticleResponse(votingKey, articleKey, 'ipfs-response-hash')

            await admin.assignQuizIpfsHashToArticleOrResponse(votingKey, articleKey, 'ipfs-quiz-hash', false)

            await assignAnwersToArticleResponse(admin, votingKey, articleKey, MIN_TOTAL_CONTENT_READ_CHECK_ANSWER)

            await admin.approveArticleResponse(votingKey, articleKey)

            await time.increaseTo(newVotingStartDate - 2 * TimeQuantities.DAY);
            await admin.approveVoting(votingKey)


            assert.equal((await admin.votings(votingKey)).approved, true);
        })
    })

    describe('publishProConArticle', async () => {
        const mockFirstVotingCycleStartDate = NOW + TimeQuantities.HOUR
        let politicalActor: BVS_Voting
        let admin: BVS_Voting

        beforeEach(async () => {
            admin = await bvsVoting.connect(accounts[0]);

            await admin.setFirstVotingCycleStartDate(mockFirstVotingCycleStartDate);

            await admin.grantPoliticalActorRole(accounts[1].address, 2);

            politicalActor = await bvsVoting.connect(accounts[1]);

            await time.increaseTo(mockFirstVotingCycleStartDate + TimeQuantities.DAY);

            const newVotingStartDate = mockFirstVotingCycleStartDate + 12 * TimeQuantities.DAY;
            await politicalActor.scheduleNewVoting('ipfs-hash', newVotingStartDate);
        })

        it('should revert when account has no POLITICAL_ACTOR role', async () => {
            const votingKey = await politicalActor.votingKeys(0);

            const account2 = await bvsVoting.connect(accounts[2]);

            await expect(
                account2.publishProConArticle(votingKey, 'ipfs-hash', true)
            ).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[2].address, Roles.POLITICAL_ACTOR));
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
        const mockFirstVotingCycleStartDate = NOW + TimeQuantities.HOUR
        let politicalActor: BVS_Voting
        let admin: BVS_Voting
        let votingKey: string;
        let articleKey: string
        

        beforeEach(async () => {
            admin = await bvsVoting.connect(accounts[0]);

            await admin.setFirstVotingCycleStartDate(mockFirstVotingCycleStartDate);

            await admin.grantPoliticalActorRole(accounts[1].address, 2);

            politicalActor = await bvsVoting.connect(accounts[1]);

            await time.increaseTo(mockFirstVotingCycleStartDate + TimeQuantities.DAY);

            const newVotingStartDate = mockFirstVotingCycleStartDate + 12 * TimeQuantities.DAY;
            await politicalActor.scheduleNewVoting('ipfs-hash', newVotingStartDate);

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
            await expect(admin.assignQuizIpfsHashToArticleOrResponse(votingKey, votingKey, 'quiz-ipfs-hash', true)).to.be.revertedWith(
                "Article not exists"
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
        const mockFirstVotingCycleStartDate = NOW + TimeQuantities.HOUR
        let politicalActor: BVS_Voting
        let admin: BVS_Voting
        let votingKey: string;
        let articleKey: string
        

        beforeEach(async () => {
            admin = await bvsVoting.connect(accounts[0]);

            await admin.setFirstVotingCycleStartDate(mockFirstVotingCycleStartDate);

            await admin.grantPoliticalActorRole(accounts[1].address, 2);

            politicalActor = await bvsVoting.connect(accounts[1]);

            await time.increaseTo(mockFirstVotingCycleStartDate + TimeQuantities.DAY);

            const newVotingStartDate = mockFirstVotingCycleStartDate + 12 * TimeQuantities.DAY;
            await politicalActor.scheduleNewVoting('ipfs-hash', newVotingStartDate);

            votingKey = await politicalActor.votingKeys(0);

            await politicalActor.publishProConArticle(votingKey, 'ipfs-hash', true)

            articleKey = await politicalActor.articleKeys(0);
        })

        it('should revert when account has no ADMINISTRATOR role', async () => {
            const account2 = await bvsVoting.connect(accounts[2]);

            await expect(
                account2.addKeccak256HashedAnswerToArticle(votingKey, articleKey, bytes32('hashed-answer'))
            ).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[2].address, Roles.ADMINISTRATOR));
        })

        it('should revert when article has no assigned content check quiz yet', async () => {
            await expect(admin.addKeccak256HashedAnswerToArticle(votingKey, articleKey, bytes32('hashed-answer'))).to.be.revertedWith(
                "First article content check ipfs hash has to be assigned"
            );
        })

        it('should add new quiz question answer', async () => {
            await admin.assignQuizIpfsHashToArticleOrResponse(votingKey, articleKey, 'article-content-quiz-ipfs-hash', true)
             
            await admin.addKeccak256HashedAnswerToArticle(votingKey, articleKey, bytes32('hashed-answer'))

            assert.equal(await admin.articleContentReadCheckAnswers(articleKey, 0), bytes32('hashed-answer'))
         })
    })

    describe('approveArticle', async () => {
        const mockFirstVotingCycleStartDate = NOW + TimeQuantities.HOUR
        let politicalActor: BVS_Voting
        let admin: BVS_Voting
        let votingKey: string
        let articleKey: string
        let newVotingStartDate: number

        beforeEach(async () => {
            admin = await bvsVoting.connect(accounts[0]);

            await admin.setFirstVotingCycleStartDate(mockFirstVotingCycleStartDate);

            await admin.grantPoliticalActorRole(accounts[1].address, 2);

            politicalActor = await bvsVoting.connect(accounts[1]);

            await time.increaseTo(mockFirstVotingCycleStartDate + TimeQuantities.DAY);

            newVotingStartDate = mockFirstVotingCycleStartDate + 12 * TimeQuantities.DAY;
            await politicalActor.scheduleNewVoting('ipfs-hash', newVotingStartDate);

            votingKey = await politicalActor.votingKeys(0);

            await politicalActor.publishProConArticle(votingKey, 'ipfs-hash', true)

            articleKey = await politicalActor.articleKeys(0);

            await admin.assignQuizIpfsHashToArticleOrResponse(votingKey, articleKey, 'article-content-quiz-ipfs-hash', true)
        })

        it('should revert when account has no ADMINISTRATOR role', async () => {
            const account2 = await bvsVoting.connect(accounts[2]);

            await expect(
                account2.approveArticle(votingKey, articleKey)
            ).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[2].address, Roles.ADMINISTRATOR));
        })

        it('should revert when article not exists', async () => {
            const votingKey = await politicalActor.votingKeys(0);

            time.increaseTo(newVotingStartDate - 3 * TimeQuantities.DAY - TimeQuantities.HOUR)

            await expect(admin.approveArticle(votingKey, votingKey)).to.be.revertedWith(
                "Article not exists"
            );
        })

        it('should revert when there is no enough answers assigned to the specific article', async () => {
            const votingKey = await politicalActor.votingKeys(0);

            await assignAnwersToArticle(admin, votingKey, articleKey, MIN_TOTAL_CONTENT_READ_CHECK_ANSWER - 1)

            time.increaseTo(newVotingStartDate - 1 * TimeQuantities.DAY)

            await expect(admin.approveArticle(votingKey, articleKey)).to.be.revertedWith(
                "You have to add at least the minimum number of content read check answers to this article"
            );
        })

        it('should approve an article', async () => {
            await assignAnwersToArticle(admin, votingKey, articleKey, MIN_TOTAL_CONTENT_READ_CHECK_ANSWER)

            await admin.approveArticle(votingKey, articleKey)

            time.increaseTo(newVotingStartDate - 1 * TimeQuantities.DAY)

            assert.equal((await admin.proConArticles(votingKey, articleKey)).isArticleApproved, true)
        })
    })
    

    describe('publishProConArticleResponse', async () => {
        const mockFirstVotingCycleStartDate = NOW + TimeQuantities.HOUR
        let politicalActor: BVS_Voting
        let admin: BVS_Voting
        let votingKey: string
        let articleKey: string
        let newVotingStartDate: number

        beforeEach(async () => {
            admin = await bvsVoting.connect(accounts[0]);

            await admin.setFirstVotingCycleStartDate(mockFirstVotingCycleStartDate);

            await admin.grantPoliticalActorRole(accounts[1].address, 2);

            politicalActor = await bvsVoting.connect(accounts[1]);

            await time.increaseTo(mockFirstVotingCycleStartDate + TimeQuantities.DAY);

            newVotingStartDate = mockFirstVotingCycleStartDate + 12 * TimeQuantities.DAY;
            await politicalActor.scheduleNewVoting('ipfs-hash', newVotingStartDate);

            votingKey = await politicalActor.votingKeys(0);

            await politicalActor.publishProConArticle(votingKey, 'ipfs-hash', true)

            articleKey = await politicalActor.articleKeys(0);
        })

        it('should revert when account has no POLITICAL_ACTOR role', async () => {
            const votingKey = await politicalActor.votingKeys(0);

            const account2 = await bvsVoting.connect(accounts[2]);

            await expect(
                account2.publishProConArticleResponse(votingKey, articleKey, 'response-ipfs-hash')
            ).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[2].address, Roles.POLITICAL_ACTOR));
        })

        it('should revert when voting already started', async () => {
            time.increaseTo(newVotingStartDate)

            await expect(politicalActor.publishProConArticleResponse(votingKey, articleKey, 'response-ipfs-hash')).to.be.revertedWith(
                "Voting already started"
            );
        })

        it('should revert when criticized voting not belongs to the political actor', async () => {
            await admin.grantPoliticalActorRole(accounts[2].address, 2);

            const politicalActor2 = await bvsVoting.connect(accounts[2]);

            time.increaseTo(newVotingStartDate - TimeQuantities.DAY)

            await expect(politicalActor2.publishProConArticleResponse(votingKey, articleKey, 'response-ipfs-hash')).to.be.revertedWith(
                "You can respond only articles what are related to your own votings"
            );
        })

        it('should publish response', async () => {
            time.increaseTo(newVotingStartDate - TimeQuantities.DAY)

            await politicalActor.publishProConArticleResponse(votingKey, articleKey, 'response-ipfs-hash')

            assert.equal((await politicalActor.proConArticles(votingKey, articleKey)).responseStatementIpfsHash, 'response-ipfs-hash')
        })
    })

    // assign quiz (assignQuizIpfsHashToArticleOrResponse) - tested

    describe('addKeccak256HashedAnswerToArticleResponse', async () => {
        const mockFirstVotingCycleStartDate = NOW + TimeQuantities.HOUR
        let politicalActor: BVS_Voting
        let admin: BVS_Voting
        let votingKey: string;
        let articleKey: string
        

        beforeEach(async () => {
            admin = await bvsVoting.connect(accounts[0]);

            await admin.setFirstVotingCycleStartDate(mockFirstVotingCycleStartDate);

            await admin.grantPoliticalActorRole(accounts[1].address, 2);

            politicalActor = await bvsVoting.connect(accounts[1]);

            await time.increaseTo(mockFirstVotingCycleStartDate + TimeQuantities.DAY);

            const newVotingStartDate = mockFirstVotingCycleStartDate + 12 * TimeQuantities.DAY;
            await politicalActor.scheduleNewVoting('ipfs-hash', newVotingStartDate);

            votingKey = await politicalActor.votingKeys(0);

            await politicalActor.publishProConArticle(votingKey, 'ipfs-hash', true)

            articleKey = await politicalActor.articleKeys(0);
        })

        it('should revert when account has no ADMINISTRATOR role', async () => {
            const account2 = await bvsVoting.connect(accounts[2]);

            await expect(
                account2.addKeccak256HashedAnswerToArticleResponse(votingKey, articleKey, bytes32('hashed-answer'))
            ).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[2].address, Roles.ADMINISTRATOR));
        })

        it('should revert when article response has no assigned content check quiz yet', async () => {
            await expect(admin.addKeccak256HashedAnswerToArticleResponse(votingKey, articleKey, bytes32('hashed-answer'))).to.be.revertedWith(
                "First article response content check ipfs hash has to be assigned"
            );
        })

        it('should add new quiz question answer', async () => {
            await admin.assignQuizIpfsHashToArticleOrResponse(votingKey, articleKey, 'article-content-quiz-ipfs-hash', false)
             
            await admin.addKeccak256HashedAnswerToArticleResponse(votingKey, articleKey, bytes32('hashed-answer'))

            assert.equal(await admin.articleContentResponseReadCheckAnswers(articleKey, 0), bytes32('hashed-answer'))
         })
    })

    describe('approveArticleResponse', async () => {
        const mockFirstVotingCycleStartDate = NOW + TimeQuantities.HOUR
        let politicalActor: BVS_Voting
        let admin: BVS_Voting
        let votingKey: string
        let articleKey: string
        let newVotingStartDate: number

        beforeEach(async () => {
            admin = await bvsVoting.connect(accounts[0]);

            await admin.setFirstVotingCycleStartDate(mockFirstVotingCycleStartDate);

            await admin.grantPoliticalActorRole(accounts[1].address, 2);

            politicalActor = await bvsVoting.connect(accounts[1]);

            await time.increaseTo(mockFirstVotingCycleStartDate + TimeQuantities.DAY);

            newVotingStartDate = mockFirstVotingCycleStartDate + 12 * TimeQuantities.DAY;
            await politicalActor.scheduleNewVoting('ipfs-hash', newVotingStartDate);

            votingKey = await politicalActor.votingKeys(0);

            await politicalActor.publishProConArticle(votingKey, 'ipfs-hash', true)

            articleKey = await politicalActor.articleKeys(0);

            time.increaseTo(newVotingStartDate - TimeQuantities.DAY)
        })

        it('should revert when account has no ADMINISTRATOR role', async () => {
            const votingKey = await politicalActor.votingKeys(0);

            const account2 = await bvsVoting.connect(accounts[2]);

            await politicalActor.publishProConArticleResponse(votingKey, articleKey, 'response-ipfs-hash')

            await expect(
                account2.approveArticleResponse(votingKey, articleKey)
            ).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[2].address, Roles.ADMINISTRATOR));
        })

        it('should revert when voting already started', async () => {
            await politicalActor.publishProConArticleResponse(votingKey, articleKey, 'response-ipfs-hash')

            time.increaseTo(newVotingStartDate)

            await expect(admin.approveArticleResponse(votingKey, articleKey)).to.be.revertedWith(
                "Voting already started"
            );
        })

        it('should revert when article not exists', async () => {
            await politicalActor.publishProConArticleResponse(votingKey, articleKey, 'response-ipfs-hash')

            time.increaseTo(newVotingStartDate - TimeQuantities.DAY)

            await expect(admin.approveArticleResponse(votingKey, votingKey)).to.be.revertedWith(
                "Article not exists"
            );
        })

        it('should revert when there is no response sent yet', async () => {
            time.increaseTo(newVotingStartDate - TimeQuantities.DAY)

            await expect(admin.approveArticleResponse(votingKey, articleKey)).to.be.revertedWith(
                "No response belongs to this article"
            );
        })

        it('should approve article response', async () => {
            await politicalActor.publishProConArticleResponse(votingKey, articleKey, 'response-ipfs-hash')

            await admin.assignQuizIpfsHashToArticleOrResponse(votingKey, articleKey, 'quiz-ipfs-hash', false)

            await assignAnwersToArticleResponse(admin, votingKey, articleKey, MIN_TOTAL_CONTENT_READ_CHECK_ANSWER)

            time.increaseTo(newVotingStartDate - TimeQuantities.DAY)

            await admin.approveArticleResponse(votingKey, articleKey)

            assert.equal((await politicalActor.proConArticles(votingKey, articleKey)).isResponseApproved, true)
        })
    })


    describe("getAccountVotingQuizAnswerIndexes", async () => {
        const farFutureDate = 2524687964; // Sat Jan 01 2050 22:12:44
        let politicalActor: BVS_Voting
        let admin: BVS_Voting
        let newVotingStartDate: number
        let votingKey: string

        beforeEach(async () => {
            admin = await bvsVoting.connect(accounts[0]);

            await admin.setFirstVotingCycleStartDate(farFutureDate - 13 * TimeQuantities.DAY);

            await admin.grantPoliticalActorRole(accounts[1].address, 2);

            politicalActor = await bvsVoting.connect(accounts[1]);


            await time.increaseTo(farFutureDate - 12 * TimeQuantities.DAY);

            await politicalActor.scheduleNewVoting('content-ipfs-hash', farFutureDate);

            votingKey = await politicalActor.votingKeys(0);
            await admin.assignQuizIpfsHashToVoting(votingKey, 'quiz-ipfs-hash')

            await assignAnwersToVoting(bvsVoting, votingKey, 10);
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
            it("should return proper account related answers", async () => {
                assert.deepEqual(await admin.getAccountVotingQuizAnswerIndexes(votingKey, item.address), item.expected);
            })
        })

    })

})