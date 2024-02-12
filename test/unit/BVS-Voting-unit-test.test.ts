import { deployments, ethers } from 'hardhat';

import { BVS_Voting } from '../../typechain-types';
import { assert, expect } from 'chai';
import { HardhatEthersSigner, SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

import { time } from "@nomicfoundation/hardhat-network-helpers";
import { NOW, Roles, TimeQuantities, citizensVoteOnElectionsCandidate, citizensVoteOnPreElectionsCandidate, getPermissionDenyReasonMessage, grantCitizenshipForAllAccount } from '../../utils/helpers';
import { deepEqual } from 'assert';


const _now = Math.round(Date.now() / 1000);

describe("BVS_Voting", () => {
    let bvsVoting: BVS_Voting;
    let deployer: SignerWithAddress;
    let accounts: SignerWithAddress[];
    beforeEach(async () => {
        accounts = await ethers.getSigners()

        const deploymentResults = await deployments.fixture(['bvs_voting']);

        const bvsAddress: string = deploymentResults['BVS_Voting']?.address;

        bvsVoting = await ethers.getContractAt('BVS_Voting', bvsAddress);
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
                0
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

    describe('approveVoting', async () => {
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

            await admin.approveArticle(votingKey, articleKey)

            await politicalActor.publishProConArticleResponse(votingKey, articleKey, 'ipfs-response-hash')

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
                ""
            ])

            assert.equal(await politicalActor.publishArticleToVotingsCount(accounts[1].address, votingKey), BigInt(1))
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

        it('should approve an article', async () => {    
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
    })

    describe('approveArticleResponse', async () => {})

})