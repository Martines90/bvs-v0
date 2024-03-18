import { deployments, ethers } from 'hardhat';

import { BVS, BVS_Elections } from '../../typechain-types';
import { assert } from 'chai';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

import { time } from "@nomicfoundation/hardhat-network-helpers";
import { NOW, TimeQuantities, citizensVoteOnElectionsCandidate, citizensVoteOnPreElectionsCandidate } from '../../utils/helpers';

import * as helpers from "@nomicfoundation/hardhat-toolbox/network-helpers";

type Voter = {
    isVotedOnPreElections: boolean,
    isVotedOnElections: boolean,
    account: SignerWithAddress
}


describe("BVS from elections to voting e2e test scenario", () => {
    before(async () => {
        await helpers.reset();
    })

    let bvsElections: BVS_Elections;
    let bvsElectionsAdmin: BVS_Elections;

    let bvs: BVS;
    let bvsAdmin: BVS;


    let accounts: SignerWithAddress[];
    let voters: Voter[] = [];

    

    const mockNextElectionsConfig = {
        preElectionsStartDate: NOW + TimeQuantities.MONTH + TimeQuantities.DAY,
        preElectionsEndDate: NOW + 2 * TimeQuantities.MONTH + TimeQuantities.DAY,
        electionsStartDate: NOW + 3 * TimeQuantities.MONTH + TimeQuantities.DAY,
        electionsEndDate: NOW + 4 * TimeQuantities.MONTH + TimeQuantities.DAY,
    }

    const voteOnCandidateOnPreElectionsByPercentageOfAccounts = async (candidate: SignerWithAddress, percentage: number) => {
        let votedCount = 0;
        for (let i = 0; voters.length > i && votedCount < Number(voters.length)*percentage; i++) {
            if (!voters[i].isVotedOnPreElections && voters[i].account.address != candidate.address) {
                const voter = await bvsElections.connect(voters[i].account);
                await voter.voteOnPreElections(candidate.address);
                voters[i].isVotedOnPreElections = true
                votedCount++;
            }
        }
    }

    const voteOnCandidateOnElectionsByPercentageOfAccounts = async (candidate: SignerWithAddress, percentage: number) => {
        let votedCount = 0;
        for (let i = 0; voters.length > i && votedCount < Number(voters.length)*percentage; i++) {
            if (!voters[i].isVotedOnElections && voters[i].account.address != candidate.address) {
                const voter = await bvsElections.connect(voters[i].account);
                await voter.voteOnElections(candidate.address);
                voters[i].isVotedOnElections = true
                votedCount++;
            }
        }
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

        voters = accounts.map((account: SignerWithAddress) => ({
            isVotedOnPreElections: false,
            isVotedOnElections: false,
            account
        })
    )

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
        
        await bvsElectionsAdmin.registerPreElectionCandidate(accounts[2]);
        await bvsElectionsAdmin.registerPreElectionCandidate(accounts[3]);
        await bvsElectionsAdmin.registerPreElectionCandidate(accounts[4]);

        await time.increaseTo(mockNextElectionsConfig.preElectionsStartDate + TimeQuantities.DAY);

        // voting on pre elections
        await voteOnCandidateOnPreElectionsByPercentageOfAccounts(accounts[2], 0.15);
        await voteOnCandidateOnPreElectionsByPercentageOfAccounts(accounts[3], 0.15);
        await voteOnCandidateOnPreElectionsByPercentageOfAccounts(accounts[4], 0.15);

        await time.increaseTo(mockNextElectionsConfig.preElectionsEndDate + TimeQuantities.WEEK + TimeQuantities.DAY);

        await bvsElectionsAdmin.closePreElections();

        await time.increaseTo(mockNextElectionsConfig.electionsStartDate + TimeQuantities.DAY);

        // voting on elections

        await voteOnCandidateOnElectionsByPercentageOfAccounts(accounts[2], 0.39);
        await voteOnCandidateOnElectionsByPercentageOfAccounts(accounts[3], 0.49);
        await voteOnCandidateOnElectionsByPercentageOfAccounts(accounts[4], 0.12);

        await time.increaseTo(mockNextElectionsConfig.electionsEndDate + TimeQuantities.WEEK + TimeQuantities.DAY);

        await bvsElectionsAdmin.closeElections();

        assert.equal((await bvsElectionsAdmin.getElectionCandidatesSize()), BigInt(0));
        assert.equal((await bvsElectionsAdmin.getElectionVotersSize()), BigInt(0));
        assert.equal((await bvsElectionsAdmin.electionsStartDate()), BigInt(0));

        assert.equal((await bvsElectionsAdmin.getWinnersSize()), BigInt(3));

       // grant political actor roles to winners

        assert.equal((await bvsAdmin.getPoliticalActorsSize()), BigInt(3));

        assert.equal((await bvsAdmin.politicalActors(0)), accounts[2].address);
        assert.equal((await bvsAdmin.politicalActors(1)), accounts[3].address);
        assert.equal((await bvsAdmin.politicalActors(2)), accounts[4].address);
        assert.equal((await bvsAdmin.politicalActorVotingCredits(accounts[2].address)), BigInt(3));
        assert.equal((await bvsAdmin.politicalActorVotingCredits(accounts[3].address)), BigInt(4));
        assert.equal((await bvsAdmin.politicalActorVotingCredits(accounts[4].address)), BigInt(1));
        
    });
})