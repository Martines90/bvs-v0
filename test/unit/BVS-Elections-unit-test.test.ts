import { deployments, ethers } from 'hardhat';

import { BVS_Elections } from '../../typechain-types';
import { assert, expect } from 'chai';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

import { time } from "@nomicfoundation/hardhat-network-helpers";
import { NOW, Roles, TimeQuantities, citizensVoteOnElectionsCandidate, citizensVoteOnPreElectionsCandidate, getPermissionDenyReasonMessage, grantCitizenshipForAllAccount } from '../../utils/helpers';

import { deepEqual } from 'assert';

import * as helpers from "@nomicfoundation/hardhat-toolbox/network-helpers";



describe("BVS_Elections", () => {
    before(async () => {
        await helpers.reset();
    })

    let bvsElections: BVS_Elections;
    let accounts: SignerWithAddress[];

    const mockNextElectionsConfig = {
        preElectionsStartDate: NOW + TimeQuantities.MONTH + TimeQuantities.DAY,
        preElectionsEndDate: NOW + 2 * TimeQuantities.MONTH + TimeQuantities.DAY,
        electionsStartDate: NOW + 3 * TimeQuantities.MONTH + TimeQuantities.DAY,
        electionsEndDate: NOW + 4 * TimeQuantities.MONTH + TimeQuantities.DAY,
    }

    beforeEach(async () => {
        accounts = await ethers.getSigners()

        const deploymentResults = await deployments.fixture(['bvs_elections']);

        const bvsAddress: string = deploymentResults['BVS_Elections']?.address;

        bvsElections = await ethers.getContractAt('BVS_Elections', bvsAddress);
    })

    const callScheduleNextElections = (connectedAccount: BVS_Elections, mockInput?: any) => {
        return connectedAccount.scheduleNextElections(
            (mockInput || mockNextElectionsConfig).preElectionsStartDate,
            (mockInput || mockNextElectionsConfig).preElectionsEndDate,
            (mockInput || mockNextElectionsConfig).electionsStartDate,
            (mockInput || mockNextElectionsConfig).electionsEndDate
        )
    }

    describe("scheduleNextElections", () => {
        it("should get reverted when Account is not an ADMINISTRATOR", async () => {
            const bvsElectionsAccount1 = await bvsElections.connect(accounts[1]);

            await expect(
                callScheduleNextElections(bvsElectionsAccount1)
            ).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[1].address, Roles.ADMINISTRATOR));
        })

        it("should schedule new elections when Account has ADMINISTRATOR role and there is no ongoing elections and input params are correct", async () => {
            const bvsElectionsAccount = await bvsElections.connect(accounts[0]);

            await callScheduleNextElections(bvsElectionsAccount);

            assert.equal(await bvsElectionsAccount.preElectionsStartDate(), BigInt(mockNextElectionsConfig.preElectionsStartDate));
            assert.equal(await bvsElectionsAccount.preElectionsEndDate(), BigInt(mockNextElectionsConfig.preElectionsEndDate));
            assert.equal(await bvsElectionsAccount.electionsStartDate(), BigInt(mockNextElectionsConfig.electionsStartDate));
            assert.equal(await bvsElectionsAccount.electionsEndDate(), BigInt(mockNextElectionsConfig.electionsEndDate));
        })

        it("should revert scheduling new election attempt when there is an already ongoing election", async () => {
            const bvsElectionsAccount = await bvsElections.connect(accounts[0]);

            await callScheduleNextElections(bvsElectionsAccount);

            await expect(callScheduleNextElections(bvsElectionsAccount)).to.be.revertedWith('Previous elections has to be closed');
        })

        it("should revert scheduling new election attempt when pre election start date is not more than 1 month ahead", async () => {
            const bvsElectionsAccount = await bvsElections.connect(accounts[0]);

            await expect(callScheduleNextElections(bvsElectionsAccount, {
                ...mockNextElectionsConfig,
                preElectionsStartDate: NOW + TimeQuantities.MONTH - TimeQuantities.DAY,
            })).to.be.revertedWith('Next election start date has to be at least 30 days planned ahead from now');
        })

        it("should allow schedule new election when last election get closed", async () => {
            const bvsElectionsAccount = await bvsElections.connect(accounts[0]);

            await callScheduleNextElections(bvsElectionsAccount);

            const timePassPhase1 = NOW + 4 * TimeQuantities.MONTH + 2 * TimeQuantities.DAY + TimeQuantities.WEEK;
            await time.increaseTo(timePassPhase1);

            await bvsElectionsAccount.closePreElections();
            await bvsElectionsAccount.closeElections();

            await time.increaseTo(timePassPhase1 + TimeQuantities.MONTH);

            await expect(callScheduleNextElections(bvsElectionsAccount, {
                preElectionsStartDate: timePassPhase1 + 3 * TimeQuantities.MONTH,
                preElectionsEndDate: timePassPhase1 + 3 * TimeQuantities.MONTH,
                electionsStartDate: timePassPhase1 + 3 * TimeQuantities.MONTH,
                electionsEndDate: timePassPhase1 + 3 * TimeQuantities.MONTH,
            })).not.to.be.reverted;
        })
    })

    describe("closePreElections", () => {
        let bvsElectionsAccount0: BVS_Elections;

        beforeEach(async () => {
            bvsElectionsAccount0 = await bvsElections.connect(accounts[0]);

            await grantCitizenshipForAllAccount(accounts, bvsElectionsAccount0);

            await callScheduleNextElections(bvsElectionsAccount0);
        })

        it("should revert when account don't have ADMINISTRATOR role", async () => {
            const bvsElectionsAccount1 = await bvsElections.connect(accounts[1]);

            await expect(
                bvsElectionsAccount1.closePreElections()
            ).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[1].address, Roles.ADMINISTRATOR));
        });

        it("should revert when pre elections end date is not yet passed by 1 week", async () => {
            await time.increaseTo(NOW + 2 * TimeQuantities.MONTH + TimeQuantities.DAY);

            await expect(bvsElectionsAccount0.closePreElections()).to.be.revertedWith('Pre elections can only close after 7 days of its end');
        });

        it("should close pre elections when pre elections end date passed by more than 1 week", async () => {
            await time.increaseTo(NOW + 2 * TimeQuantities.MONTH + TimeQuantities.DAY + TimeQuantities.WEEK + TimeQuantities.DAY);

            await expect(bvsElectionsAccount0.closePreElections()).not.to.be.reverted;

            
            assert.equal((await bvsElectionsAccount0.getPreElectionCandidatesSize()), BigInt(0));
            assert.equal((await bvsElectionsAccount0.getPreElectionVotersSize()), BigInt(0));

            assert.equal(await bvsElectionsAccount0.preElectionsStartDate(), BigInt(0));
            assert.equal(await bvsElectionsAccount0.preElectionsEndDate(), BigInt(0));
        });

        it("should filter the candidates who got more than 20% voter support", async () => {
            const winnerCandidate1 = await bvsElections.connect(accounts[1]);
            await winnerCandidate1.registerAsPreElectionCandidate();

            const winnerCandidate2 = await bvsElections.connect(accounts[2]);
            await winnerCandidate2.registerAsPreElectionCandidate();

            const loserCandidate = await bvsElections.connect(accounts[10]);
            await loserCandidate.registerAsPreElectionCandidate();

            await time.increaseTo(mockNextElectionsConfig.preElectionsStartDate + TimeQuantities.DAY);

            // voting
            await citizensVoteOnPreElectionsCandidate(accounts[1], [accounts[3], accounts[4], accounts[5], accounts[6], accounts[7], accounts[8], accounts[9]], bvsElections);

            await citizensVoteOnPreElectionsCandidate(accounts[2], [accounts[3], accounts[4], accounts[12], accounts[13], accounts[14], accounts[15], accounts[16], accounts[17], accounts[18], accounts[19]], bvsElections);

            await citizensVoteOnPreElectionsCandidate(accounts[10], [accounts[11]], bvsElections);

            assert.equal((await bvsElectionsAccount0.preElectionCandidateScores(accounts[1])), BigInt(8));
            assert.equal((await bvsElectionsAccount0.preElectionCandidateScores(accounts[2])), BigInt(11));
            assert.equal((await bvsElectionsAccount0.preElectionCandidateScores(accounts[10])), BigInt(2));

            // close pre elections

            await time.increaseTo(mockNextElectionsConfig.preElectionsEndDate + TimeQuantities.WEEK + TimeQuantities.DAY);

            await bvsElectionsAccount0.closePreElections();

            
            assert.equal((await bvsElectionsAccount0.electionCandidates(0)), accounts[1].address);
            assert.equal((await bvsElectionsAccount0.electionCandidates(1)), accounts[2].address);

            assert.equal((await bvsElectionsAccount0.getPreElectionCandidatesSize()), BigInt(0));
            assert.equal((await bvsElectionsAccount0.getElectionCandidatesSize()), BigInt(2));

            assert.equal((await bvsElectionsAccount0.preElectionCandidateScores(accounts[1])), BigInt(0));
            assert.equal((await bvsElectionsAccount0.preElectionCandidateScores(accounts[2])), BigInt(0));
            assert.equal((await bvsElectionsAccount0.preElectionCandidateScores(accounts[10])), BigInt(0));

            
            deepEqual((await bvsElectionsAccount0.preElectionVotes(accounts[3])),[
                '0x0000000000000000000000000000000000000000',
                '0x0000000000000000000000000000000000000000',
                '0x0000000000000000000000000000000000000000',
                '0x0000000000000000000000000000000000000000',
                BigInt(0),
            ]);
        });
    });

    describe("closeElections", () => {
        let bvsElectionsAccount0: BVS_Elections;

        beforeEach(async () => {
            bvsElectionsAccount0 = await bvsElections.connect(accounts[0]);

            await callScheduleNextElections(bvsElectionsAccount0);

            await time.increaseTo(NOW + 2 * TimeQuantities.MONTH + TimeQuantities.DAY + TimeQuantities.WEEK + TimeQuantities.DAY);
        })

        it("should revert when account don't have ADMINISTRATOR role", async () => {
            await bvsElectionsAccount0.closePreElections();

            const bvsElectionsAccount1 = await bvsElections.connect(accounts[1]);

            await expect(
                bvsElectionsAccount1.closeElections()
            ).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[1].address, Roles.ADMINISTRATOR));
        });

        it("should revert when pre elections not yet closed", async () => {
            await time.increaseTo(NOW + 4 * TimeQuantities.MONTH + TimeQuantities.DAY + TimeQuantities.MONTH);

            await expect(bvsElectionsAccount0.closeElections()).to.be.revertedWith('Pre elections has to be close first');
        });

        it("should revert when elections are already closed", async () => {
            await bvsElectionsAccount0.closePreElections();

            await time.increaseTo(NOW + 4 * TimeQuantities.MONTH + TimeQuantities.DAY + TimeQuantities.MONTH);

            await bvsElectionsAccount0.closeElections();

            await expect(bvsElectionsAccount0.closeElections()).to.be.revertedWith('Elections already closed or not yet planned');
        });

        it("should revert when elections end date is not yet passed by 1 week", async () => {
            await bvsElectionsAccount0.closePreElections();

            await time.increaseTo(NOW + 4 * TimeQuantities.MONTH + TimeQuantities.DAY);

            await expect(bvsElectionsAccount0.closeElections()).to.be.revertedWith('Elections can only close after 7 days of its end');
        });

        it("should close elections", async () => {
            await bvsElectionsAccount0.closePreElections();

            await time.increaseTo(NOW + 4 * TimeQuantities.MONTH + TimeQuantities.DAY + TimeQuantities.WEEK + TimeQuantities.DAY);

            await expect(bvsElectionsAccount0.closeElections()).not.to.be.reverted;

            assert.equal((await bvsElectionsAccount0.getElectionCandidatesSize()), BigInt(0));
            assert.equal((await bvsElectionsAccount0.electionVoters).length, 0);

            assert.equal(await bvsElectionsAccount0.electionsStartDate(), BigInt(0));
        })
    });

    describe('registerAsPreElectionCandidate', () => {
        let bvsElectionsAccount0: BVS_Elections;

        beforeEach(async () => {
            bvsElectionsAccount0 = await bvsElections.connect(accounts[0]);
        })

        it('should revert when non citizen calls', async () => {
            const bvsElectionsAccount1 = await bvsElections.connect(accounts[1]);

            await expect(
                bvsElectionsAccount1.registerAsPreElectionCandidate()
            ).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[1].address, Roles.CITIZEN));
        })

        it('should revert when there is no ongoing pre elections', async () => {
            await expect(
                bvsElectionsAccount0.registerAsPreElectionCandidate()
            ).to.be.revertedWith('Pre elections not scheduled or already closed');
        })

        it('should revert when pre elections is already in progress', async () => {
            await callScheduleNextElections(bvsElectionsAccount0);

            await time.increaseTo(mockNextElectionsConfig.preElectionsStartDate);

            await expect(
                bvsElectionsAccount0.registerAsPreElectionCandidate()
            ).to.be.revertedWith('Pre elections is already in progress');
        })

        it('should revert when candidate already registered', async () => {
            await callScheduleNextElections(bvsElectionsAccount0);

            await bvsElectionsAccount0.registerAsPreElectionCandidate()

            await expect(
                bvsElectionsAccount0.registerAsPreElectionCandidate()
            ).to.be.revertedWith('You are already registered as a candidate');
        })

        it('should register citizen as a pre election candidate', async () => {
            await callScheduleNextElections(bvsElectionsAccount0);

            await expect(
                bvsElectionsAccount0.registerAsPreElectionCandidate()
            ).not.to.be.reverted

            assert.equal((await bvsElectionsAccount0.getPreElectionCandidatesSize()), BigInt(1));
            assert.equal(await bvsElectionsAccount0.preElectionCandidateScores(accounts[0]), BigInt(1));
        })
    });

    describe('voteOnPreElections', () => {
        let bvsElectionsAccount0: BVS_Elections;

        beforeEach(async () => {
            bvsElectionsAccount0 = await bvsElections.connect(accounts[0]);

            await callScheduleNextElections(bvsElectionsAccount0);
        })

        it('should revert when non citizen calls', async () => {
            const bvsElectionsAccount1 = await bvsElections.connect(accounts[1]);

            await expect(
                bvsElectionsAccount1.voteOnPreElections(accounts[2].address)
            ).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[1].address, Roles.CITIZEN));
        })

        it('should revert when pre elections already closed', async () => {
            await bvsElectionsAccount0.grantCitizenRole(accounts[1]);

            const bvsElectionsAccount1 = await bvsElections.connect(accounts[1]);

            await time.increaseTo(mockNextElectionsConfig.preElectionsEndDate);

            await expect(
            bvsElectionsAccount1.voteOnPreElections(accounts[2].address)
            ).to.be.revertedWith('Pre elections already closed')
        })

        it('should revert when citizen voted 3 times', async () => {
            await bvsElectionsAccount0.grantCitizenRole(accounts[1]);
            await bvsElectionsAccount0.grantCitizenRole(accounts[2]);
            await bvsElectionsAccount0.grantCitizenRole(accounts[3]);
            await bvsElectionsAccount0.grantCitizenRole(accounts[4]);

            await bvsElectionsAccount0.registerAsPreElectionCandidate();

            const bvsElectionsAccount1 = await bvsElections.connect(accounts[1]);
            await bvsElectionsAccount1.registerAsPreElectionCandidate();

            const bvsElectionsAccount2 = await bvsElections.connect(accounts[2]);
            await bvsElectionsAccount2.registerAsPreElectionCandidate();

            const bvsElectionsAccount3 = await bvsElections.connect(accounts[3]);
            await bvsElectionsAccount3.registerAsPreElectionCandidate();

            await time.increaseTo(mockNextElectionsConfig.preElectionsStartDate + TimeQuantities.DAY);

            const bvsElectionsAccount4 = await bvsElections.connect(accounts[4]);

            await bvsElectionsAccount4.voteOnPreElections(accounts[0].address);
            await bvsElectionsAccount4.voteOnPreElections(accounts[1].address);
            await bvsElectionsAccount4.voteOnPreElections(accounts[2].address);

            await expect(
                bvsElectionsAccount4.voteOnPreElections(accounts[3].address)
            ).to.be.revertedWith('You already used your 3 vote credit on the pre elections')
        })

        it('should revert when the passed account address is not a registered candidate', async () => {

            await time.increaseTo(mockNextElectionsConfig.preElectionsStartDate + TimeQuantities.DAY);

            await expect(
                bvsElectionsAccount0.voteOnPreElections(accounts[1].address)
            ).to.be.revertedWith('Under the provided address there is no registered pre election candidate')
        })

        it('should revert when the passed account address is the same as yours', async () => {
            await bvsElectionsAccount0.registerAsPreElectionCandidate();

            await time.increaseTo(mockNextElectionsConfig.preElectionsStartDate + TimeQuantities.DAY);

            await expect(
                bvsElectionsAccount0.voteOnPreElections(accounts[0].address)
            ).to.be.revertedWith("You can't vote on yourself")
        })

        it('should revert when try vote on same candidate', async () => {
            await bvsElectionsAccount0.grantCitizenRole(accounts[1]);

            const bvsElectionsAccount1 = await bvsElections.connect(accounts[1]);
            await bvsElectionsAccount1.registerAsPreElectionCandidate();

            await time.increaseTo(mockNextElectionsConfig.preElectionsStartDate + TimeQuantities.DAY);

            
            bvsElectionsAccount0.voteOnPreElections(accounts[1].address)

            await expect(
                bvsElectionsAccount0.voteOnPreElections(accounts[1].address)
            ).to.be.revertedWith("You can't vote on the same candidate more than once")
        })

        it('should create/store PreElectionVote object when citizen votes first time', async () => {
            await bvsElectionsAccount0.grantCitizenRole(accounts[1]);

            const bvsElectionsAccount1 = await bvsElections.connect(accounts[1]);
            await bvsElectionsAccount1.registerAsPreElectionCandidate();

            await time.increaseTo(mockNextElectionsConfig.preElectionsStartDate + TimeQuantities.DAY);

            await bvsElectionsAccount0.voteOnPreElections(accounts[1].address)

            assert.equal(await bvsElectionsAccount0.preElectionCandidateScores(accounts[1]), BigInt(2));
            assert.equal((await bvsElectionsAccount0.getPreElectionVotersSize()), BigInt(1));
            assert.equal((await bvsElectionsAccount0.preElectionVotes(accounts[0])).voteCount, BigInt(1));
        })

        it('should add the pre election votes sent by citizens', async () => {
            await bvsElectionsAccount0.grantCitizenRole(accounts[1]);
            await bvsElectionsAccount0.grantCitizenRole(accounts[2]);
            await bvsElectionsAccount0.grantCitizenRole(accounts[3]);
            await bvsElectionsAccount0.grantCitizenRole(accounts[4]);

            const bvsElectionsAccount1 = await bvsElections.connect(accounts[1]);
            await bvsElectionsAccount1.registerAsPreElectionCandidate();

            const bvsElectionsAccount3 = await bvsElections.connect(accounts[3]);
            await bvsElectionsAccount3.registerAsPreElectionCandidate();

            const bvsElectionsAccount4 = await bvsElections.connect(accounts[4]);
            await bvsElectionsAccount4.registerAsPreElectionCandidate();

            await time.increaseTo(mockNextElectionsConfig.preElectionsStartDate + TimeQuantities.DAY);

            await bvsElectionsAccount0.voteOnPreElections(accounts[1].address)

            const bvsElectionsAccount2 = await bvsElections.connect(accounts[2]);
            await bvsElectionsAccount2.voteOnPreElections(accounts[1].address)
            await bvsElectionsAccount2.voteOnPreElections(accounts[3].address)
            await bvsElectionsAccount2.voteOnPreElections(accounts[4].address)

            assert.equal(await bvsElectionsAccount0.preElectionCandidateScores(accounts[1]), BigInt(3));
            assert.equal((await bvsElectionsAccount0.getPreElectionVotersSize()), BigInt(2));
            assert.equal((await bvsElectionsAccount0.preElectionVotes(accounts[2])).voteCount, BigInt(3));
            assert.equal((await bvsElectionsAccount0.preElectionVotes(accounts[0])).voteCount, BigInt(1));

            assert.equal(((await bvsElectionsAccount0.preElectionVotes(accounts[0])).candidate1), accounts[1].address);

            assert.equal(((await bvsElectionsAccount0.preElectionVotes(accounts[2])).candidate1), accounts[1].address);
            assert.equal(((await bvsElectionsAccount0.preElectionVotes(accounts[2])).candidate2), accounts[3].address);
            assert.equal(((await bvsElectionsAccount0.preElectionVotes(accounts[2])).candidate3), accounts[4].address);
        })
    })

    describe('voteOnElections', () => {
        let bvsElectionsAccount0: BVS_Elections;

        beforeEach(async () => {
            bvsElectionsAccount0 = await bvsElections.connect(accounts[0]);

            await grantCitizenshipForAllAccount(accounts, bvsElectionsAccount0);

            await callScheduleNextElections(bvsElectionsAccount0);
        })

        it('should revert when pre elections not yet closed', async () => {
            await expect(
                bvsElectionsAccount0.voteOnElections(accounts[1].address)
            ).to.be.revertedWith("Pre elections not yet closed or scheduled")
        })

        it('should revert when elections not yet started', async () => {
            await time.increaseTo(mockNextElectionsConfig.preElectionsEndDate + TimeQuantities.WEEK + TimeQuantities.DAY);
            await bvsElectionsAccount0.closePreElections();

            await expect(
                bvsElectionsAccount0.voteOnElections(accounts[1].address)
            ).to.be.revertedWith("Elections not yet started")
        })

        it('should revert when elections already closed', async () => {
            await time.increaseTo(mockNextElectionsConfig.electionsEndDate);
            await bvsElectionsAccount0.closePreElections();

            await expect(
                bvsElectionsAccount0.voteOnElections(accounts[1].address)
            ).to.be.revertedWith("Elections already closed")
        })

        it('should revert when elections already closed', async () => {
            await time.increaseTo(mockNextElectionsConfig.preElectionsEndDate + TimeQuantities.WEEK + TimeQuantities.DAY);
            await bvsElectionsAccount0.closePreElections();

            await time.increaseTo(mockNextElectionsConfig.electionsStartDate + TimeQuantities.DAY);

            await expect(
                bvsElectionsAccount0.voteOnElections(accounts[0].address)
            ).to.be.revertedWith("You can't vote on yourself")
        })

        it('should revert when elections already closed', async () => {
            await time.increaseTo(mockNextElectionsConfig.preElectionsEndDate + TimeQuantities.WEEK + TimeQuantities.DAY);
            await bvsElectionsAccount0.closePreElections();

            await time.increaseTo(mockNextElectionsConfig.electionsStartDate + TimeQuantities.DAY);

            await expect(
                bvsElectionsAccount0.voteOnElections(accounts[1].address)
            ).to.be.revertedWith("The provided account address not belong to any candidate")
        })

        it('should revert when elections already closed', async () => {
            await bvsElectionsAccount0.registerAsPreElectionCandidate();

            await time.increaseTo(mockNextElectionsConfig.preElectionsStartDate + TimeQuantities.DAY);

            await citizensVoteOnPreElectionsCandidate(accounts[0], [accounts[3], accounts[4], accounts[5], accounts[6], accounts[7], accounts[8], accounts[9]], bvsElections);

            // close pre elections
            await time.increaseTo(mockNextElectionsConfig.preElectionsEndDate + TimeQuantities.WEEK + TimeQuantities.DAY);
            await bvsElectionsAccount0.closePreElections();

            // start elections
            await time.increaseTo(mockNextElectionsConfig.electionsStartDate + TimeQuantities.DAY);

            const bvsElectionsAccount1 = await bvsElections.connect(accounts[1]);
            await bvsElectionsAccount1.voteOnElections(accounts[0].address)

            await expect(
                bvsElectionsAccount1.voteOnElections(accounts[0].address)
            ).to.be.revertedWith("You already voted")
        })

        it('should add new vote to the candidate', async () => {
            await bvsElectionsAccount0.registerAsPreElectionCandidate();
            
            await time.increaseTo(mockNextElectionsConfig.preElectionsStartDate + TimeQuantities.DAY);

            await citizensVoteOnPreElectionsCandidate(accounts[0], [accounts[3], accounts[4], accounts[5], accounts[6], accounts[7], accounts[8], accounts[9]], bvsElections);

            // close pre elections
            await time.increaseTo(mockNextElectionsConfig.preElectionsEndDate + TimeQuantities.WEEK + TimeQuantities.DAY);
            await bvsElectionsAccount0.closePreElections();

            // start elections
            await time.increaseTo(mockNextElectionsConfig.electionsStartDate + TimeQuantities.DAY);

            const bvsElectionsAccount1 = await bvsElections.connect(accounts[1]);
            await bvsElectionsAccount1.voteOnElections(accounts[0].address)

            assert.equal((await bvsElectionsAccount0.electionCandidateScores(accounts[0].address)), BigInt(2));
            assert.equal((await bvsElectionsAccount0.electionVotes(accounts[1].address)), accounts[0].address);
        })
    });

    describe("closeElections succeed", () => {
        let bvsElectionsAccount0: BVS_Elections;

        beforeEach(async () => {
            bvsElectionsAccount0 = await bvsElections.connect(accounts[0]);

            await callScheduleNextElections(bvsElectionsAccount0);
        })

        it("should provide new political actors", async () => {
            await grantCitizenshipForAllAccount(accounts, bvsElectionsAccount0);

            const winnerCandidate1 = await bvsElections.connect(accounts[1]);
            await winnerCandidate1.registerAsPreElectionCandidate();

            const winnerCandidate2 = await bvsElections.connect(accounts[2]);
            await winnerCandidate2.registerAsPreElectionCandidate();

            const loserCandidate = await bvsElections.connect(accounts[10]);
            await loserCandidate.registerAsPreElectionCandidate();

            await time.increaseTo(mockNextElectionsConfig.preElectionsStartDate + TimeQuantities.DAY);

            // voting on pre elections
            await citizensVoteOnPreElectionsCandidate(accounts[1], [accounts[3], accounts[4], accounts[5], accounts[6], accounts[7], accounts[8], accounts[9]], bvsElections);

            await citizensVoteOnPreElectionsCandidate(accounts[2], [accounts[3], accounts[4], accounts[12], accounts[13], accounts[14], accounts[15], accounts[16], accounts[17], accounts[18], accounts[19]], bvsElections);

            await citizensVoteOnPreElectionsCandidate(accounts[10], [accounts[11]], bvsElections);

            await time.increaseTo(mockNextElectionsConfig.preElectionsEndDate + TimeQuantities.WEEK + TimeQuantities.DAY);

            await bvsElectionsAccount0.closePreElections();

            await time.increaseTo(mockNextElectionsConfig.electionsStartDate + TimeQuantities.DAY);

            // voting on elections

            await citizensVoteOnElectionsCandidate(accounts[1], [accounts[3], accounts[4], accounts[5], accounts[6], accounts[7], accounts[8], accounts[9]], bvsElections);

            await citizensVoteOnElectionsCandidate(accounts[2], [accounts[12], accounts[13], accounts[14], accounts[15], accounts[16], accounts[17], accounts[18], accounts[19]], bvsElections);

            await time.increaseTo(mockNextElectionsConfig.electionsEndDate + TimeQuantities.WEEK + TimeQuantities.DAY);

            await bvsElectionsAccount0.closeElections();

            assert.equal((await bvsElectionsAccount0.getPoliticalActorsSize()), BigInt(2));
            assert.equal((await bvsElectionsAccount0.politicalActors(0)), accounts[1].address);
            assert.equal((await bvsElectionsAccount0.politicalActors(1)), accounts[2].address);
            assert.equal((await bvsElectionsAccount0.politicalActorVotingCredits(accounts[1].address)), BigInt(3));
            assert.equal((await bvsElectionsAccount0.politicalActorVotingCredits(accounts[2].address)), BigInt(4));
            
            assert.equal((await bvsElectionsAccount0.getElectionCandidatesSize()), BigInt(0));
            assert.equal((await bvsElectionsAccount0.getElectionVotersSize()), BigInt(0));
            assert.equal((await bvsElectionsAccount0.electionsStartDate()), BigInt(0));
        });
    })
})