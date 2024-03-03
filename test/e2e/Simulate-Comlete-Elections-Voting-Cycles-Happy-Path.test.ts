import { deployments, ethers } from 'hardhat';

import { BVS, BVS_Elections } from '../../typechain-types';
import { assert } from 'chai';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

import { time } from "@nomicfoundation/hardhat-network-helpers";
import { NOW, TimeQuantities, citizensVoteOnElectionsCandidate, citizensVoteOnPreElectionsCandidate } from '../../utils/helpers';

import * as helpers from "@nomicfoundation/hardhat-toolbox/network-helpers";



describe("BVS from elections to voting e2e test scenario", () => {
    before(async () => {
        await helpers.reset();
    })

    let bvsElections: BVS_Elections;
    let bvsElectionsAdmin: BVS_Elections;

    let bvs: BVS;
    let bvsAdmin: BVS;


    let accounts: SignerWithAddress[];

    

    const mockNextElectionsConfig = {
        preElectionsStartDate: NOW + TimeQuantities.MONTH + TimeQuantities.DAY,
        preElectionsEndDate: NOW + 2 * TimeQuantities.MONTH + TimeQuantities.DAY,
        electionsStartDate: NOW + 3 * TimeQuantities.MONTH + TimeQuantities.DAY,
        electionsEndDate: NOW + 4 * TimeQuantities.MONTH + TimeQuantities.DAY,
    }

    beforeEach(async () => {
        accounts = await ethers.getSigners()

        const deploymentResults = await deployments.fixture(['mocks','bvs']);

        const bvsAddress: string = deploymentResults['BVS']?.address;

        bvs = await ethers.getContractAt('BVS', bvsAddress);

        bvsAdmin = await bvs.connect(accounts[0]);

        bvsElections = await ethers.getContractAt('BVS_Elections', await bvs.bvsElections());

        bvsElectionsAdmin = await bvsElections.connect(accounts[0]);

        // grant citizen roles
        for (let i = 1; accounts.length > i; i++) {
            await bvsAdmin._grantCitizenRole(accounts[i]);
        }

        await callScheduleNextElections(bvsElectionsAdmin);
    })

    const callScheduleNextElections = (connectedAccount: BVS_Elections, mockInput?: any) => {
        return connectedAccount.scheduleNextElections(
            (mockInput || mockNextElectionsConfig).preElectionsStartDate,
            (mockInput || mockNextElectionsConfig).preElectionsEndDate,
            (mockInput || mockNextElectionsConfig).electionsStartDate,
            (mockInput || mockNextElectionsConfig).electionsEndDate
        )
    }

    // political actors accounts: winners: 2,3, losers: 4
    it("complete e2e scenario", async () => {
        // Elections
        
        const winnerCandidate1 = await bvsElections.connect(accounts[2]);
        await winnerCandidate1.registerAsPreElectionCandidate();

       const winnerCandidate2 = await bvsElections.connect(accounts[3]);
        await winnerCandidate2.registerAsPreElectionCandidate();

        const loserCandidate = await bvsElections.connect(accounts[4]);
        await loserCandidate.registerAsPreElectionCandidate();

        await time.increaseTo(mockNextElectionsConfig.preElectionsStartDate + TimeQuantities.DAY);

        // voting on pre elections
        await citizensVoteOnPreElectionsCandidate(accounts[2], [accounts[3], accounts[4], accounts[5], accounts[6], accounts[7], accounts[8], accounts[9]], bvsElections);

        await citizensVoteOnPreElectionsCandidate(accounts[3], [accounts[2], accounts[4], accounts[12], accounts[13], accounts[14], accounts[15], accounts[16], accounts[17], accounts[18], accounts[19]], bvsElections);

        await citizensVoteOnPreElectionsCandidate(accounts[4], [accounts[11]], bvsElections);

        await time.increaseTo(mockNextElectionsConfig.preElectionsEndDate + TimeQuantities.WEEK + TimeQuantities.DAY);

        await bvsElectionsAdmin.closePreElections();

        await time.increaseTo(mockNextElectionsConfig.electionsStartDate + TimeQuantities.DAY);

        // voting on elections

        await citizensVoteOnElectionsCandidate(accounts[2], [accounts[3], accounts[4], accounts[5], accounts[6], accounts[7], accounts[8], accounts[9]], bvsElections);

        await citizensVoteOnElectionsCandidate(accounts[3], [accounts[12], accounts[13], accounts[14], accounts[15], accounts[16], accounts[17], accounts[18], accounts[19]], bvsElections);

        await time.increaseTo(mockNextElectionsConfig.electionsEndDate + TimeQuantities.WEEK + TimeQuantities.DAY);

        await bvsElectionsAdmin.closeElections();

        assert.equal((await bvsElectionsAdmin.getPoliticalActorsSize()), BigInt(2));
        assert.equal((await bvsElectionsAdmin.politicalActors(0)), accounts[2].address);
        assert.equal((await bvsElectionsAdmin.politicalActors(1)), accounts[3].address);
        assert.equal((await bvsElectionsAdmin.politicalActorVotingCredits(accounts[2].address)), BigInt(3));
        assert.equal((await bvsElectionsAdmin.politicalActorVotingCredits(accounts[3].address)), BigInt(4));
        
        assert.equal((await bvsElectionsAdmin.getElectionCandidatesSize()), BigInt(0));
        assert.equal((await bvsElectionsAdmin.getElectionVotersSize()), BigInt(0));
        assert.equal((await bvsElectionsAdmin.electionsStartDate()), BigInt(0));
        
    });
})