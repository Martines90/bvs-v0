import { deployments, ethers } from 'hardhat';

import { BVS_Elections } from '../../typechain-types';
import { assert, expect } from 'chai';
import { HardhatEthersSigner, SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

import { time } from "@nomicfoundation/hardhat-network-helpers";
import { Roles, TimeQuantities, getPermissionDenyReasonMessage } from '../../utils/helpers';


const _now = Math.round(Date.now() / 1000);

describe("BVS_Elections", () => {
    let bvsElections: BVS_Elections;
    let deployer: SignerWithAddress;
    let accounts: SignerWithAddress[];

    const mockNextElectionsConfig = {
        preElectionStartDate: _now + TimeQuantities.MONTH + TimeQuantities.DAY,
        preElectionsEndDate: _now + 2 * TimeQuantities.MONTH + TimeQuantities.DAY,
        electionsStartDate: _now + 3 * TimeQuantities.MONTH + TimeQuantities.DAY,
        electionsEndDate: _now + 4 * TimeQuantities.MONTH + TimeQuantities.DAY,
    }

    beforeEach(async () => {
        accounts = await ethers.getSigners()
        deployer = accounts[0]

        const deploymentResults = await deployments.fixture(['bvs_elections']);

        const bvsAddress: string = deploymentResults['BVS_Elections']?.address;

        bvsElections = await ethers.getContractAt('BVS_Elections', bvsAddress);
    })

    const callScheduleNextElections = (connectedAccount: BVS_Elections, mockInput?: any) => {
        return connectedAccount.scheduleNextElections(
            (mockInput || mockNextElectionsConfig).preElectionStartDate,
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

            assert.equal(await bvsElectionsAccount.preElectionsStartDate(), BigInt(mockNextElectionsConfig.preElectionStartDate));
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
                preElectionStartDate: _now + TimeQuantities.MONTH - TimeQuantities.DAY,
            })).to.be.revertedWith('Next election start date has to be at least 30 days planned ahead from now');
        })

        it("should allow schedule new election when last election get closed", async () => {
            const bvsElectionsAccount = await bvsElections.connect(accounts[0]);

            await callScheduleNextElections(bvsElectionsAccount);

            const timePassPhase1 = _now + 4 * TimeQuantities.MONTH + 2 * TimeQuantities.DAY + TimeQuantities.WEEK;
            await time.increaseTo(timePassPhase1);

            await bvsElectionsAccount.closePreElections();
            await bvsElectionsAccount.closeElections();

            await time.increaseTo(timePassPhase1 + TimeQuantities.MONTH);

            await expect(callScheduleNextElections(bvsElectionsAccount, {
                preElectionStartDate: timePassPhase1 + 3 * TimeQuantities.MONTH,
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

            await callScheduleNextElections(bvsElectionsAccount0);
        })

        it("should revert when account don't have ADMINISTRATOR role", async () => {
            const bvsElectionsAccount1 = await bvsElections.connect(accounts[1]);

            await expect(
                bvsElectionsAccount1.closePreElections()
            ).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[1].address, Roles.ADMINISTRATOR));
        });

        it("should revert when pre elections end date is not yet passed by 1 week", async () => {
            await time.increaseTo(_now + 2 * TimeQuantities.MONTH + TimeQuantities.DAY);

            await expect(bvsElectionsAccount0.closePreElections()).to.be.revertedWith('Pre elections can only close after 7 days of its end');
        });

        it("should close pre elections when pre elections end date passed by more than 1 week", async () => {
            await time.increaseTo(_now + 2 * TimeQuantities.MONTH + TimeQuantities.DAY + TimeQuantities.WEEK + TimeQuantities.DAY);

            await expect(bvsElectionsAccount0.closePreElections()).not.to.be.reverted;

            
            assert.equal((await bvsElectionsAccount0.preElectionCandidates).length, 0);
            assert.equal((await bvsElectionsAccount0.preElectionVoters).length, 0);

            assert.equal(await bvsElectionsAccount0.preElectionsStartDate(), BigInt(0));
            assert.equal(await bvsElectionsAccount0.preElectionsEndDate(), BigInt(0));
        });
    });

    describe("closeElections", () => {
        let bvsElectionsAccount0: BVS_Elections;

        beforeEach(async () => {
            bvsElectionsAccount0 = await bvsElections.connect(accounts[0]);

            await callScheduleNextElections(bvsElectionsAccount0);

            await time.increaseTo(_now + 2 * TimeQuantities.MONTH + TimeQuantities.DAY + TimeQuantities.WEEK + TimeQuantities.DAY);
        })

        it("should revert when account don't have ADMINISTRATOR role", async () => {
            await bvsElectionsAccount0.closePreElections();

            const bvsElectionsAccount1 = await bvsElections.connect(accounts[1]);

            await expect(
                bvsElectionsAccount1.closeElections()
            ).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[1].address, Roles.ADMINISTRATOR));
        });

        it("should revert when pre elections not yet closed", async () => {
            await time.increaseTo(_now + 4 * TimeQuantities.MONTH + TimeQuantities.DAY + TimeQuantities.MONTH);

            await expect(bvsElectionsAccount0.closeElections()).to.be.revertedWith('Pre elections has to be close first');
        });

        it("should revert when elections are already closed", async () => {
            await bvsElectionsAccount0.closePreElections();

            await time.increaseTo(_now + 4 * TimeQuantities.MONTH + TimeQuantities.DAY + TimeQuantities.MONTH);

            await bvsElectionsAccount0.closeElections();

            await expect(bvsElectionsAccount0.closeElections()).to.be.revertedWith('Elections already closed or not yet planned');
        });

        it("should revert when elections end date is not yet passed by 1 week", async () => {
            await bvsElectionsAccount0.closePreElections();

            await time.increaseTo(_now + 4 * TimeQuantities.MONTH + TimeQuantities.DAY);

            await expect(bvsElectionsAccount0.closeElections()).to.be.revertedWith('Elections can only close after 7 days of its end');
        });

        it("should close elections", async () => {
            await bvsElectionsAccount0.closePreElections();

            await time.increaseTo(_now + 4 * TimeQuantities.MONTH + TimeQuantities.DAY + TimeQuantities.WEEK + TimeQuantities.DAY);

            await expect(bvsElectionsAccount0.closeElections()).not.to.be.reverted;

            assert.equal((await bvsElectionsAccount0.electionCandidates).length, 0);
            assert.equal((await bvsElectionsAccount0.electionVotes).length, 0);

            assert.equal(await bvsElectionsAccount0.electionsStartDate(), BigInt(0));
        })
    });

    describe('Simulate elections', () => {
        let bvsElectionsAccount0: BVS_Elections;
        let citizenAccounts: HardhatEthersSigner[] = [];

        beforeEach(async () => {
            bvsElectionsAccount0 = await bvsElections.connect(accounts[0]);

            await callScheduleNextElections(bvsElectionsAccount0);

            // store citizens
            for(let i = 1; i < accounts.length;i++) {
                citizenAccounts.push(accounts[i]);
            }
            
            // register citizens
            citizenAccounts.forEach(async (account) => {
                await bvsElectionsAccount0.grantCitizenRole(account);
            })
        })
    })
})