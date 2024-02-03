import { deployments, ethers } from 'hardhat';

import { BVS_Elections } from '../../typechain-types';
import { assert, expect } from 'chai';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

import { time } from "@nomicfoundation/hardhat-network-helpers";
import { Roles, TimeQuantities, getPermissionDenyReasonMessage } from '../../utils/helpers';


const _now = Math.round(Date.now() / 1000);

describe("BVS_Elections", () => {
    let bvsElections: BVS_Elections;
    let deployer: SignerWithAddress;
    let accounts: SignerWithAddress[];
    let adminRole: string;

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
            })).to.be.reverted; //With('Next election start date has to be at least 30 days planned ahead from now');
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
        let bvsElectionsAccount0;
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
    });
})