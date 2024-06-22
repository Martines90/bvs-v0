import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { deployments, ethers } from "hardhat";
import { ChristianState, ChurchCommunity } from "../../typechain-types";
import { AddressLike } from "ethers";
import { expect } from "chai";

describe('ChurchCommunity - main', () => {
    let christianStateAdmin: ChristianState;
    let churchCommunityAdmin: ChurchCommunity;
    let christianStateContractAddress: AddressLike;
    let churchCommunityContractAddress: AddressLike;

    let accounts: SignerWithAddress[];

    let christianStateContract: ChristianState;
    let churchCommunityContract: ChurchCommunity;

    beforeEach(async () => {
        accounts = await ethers.getSigners()

        const deploymentResults = await deployments.fixture(['mocks', 'christian_state_and_curch_community']);

        christianStateContractAddress = deploymentResults['ChristianState']?.address;
        churchCommunityContractAddress = deploymentResults['ChurchCommunity']?.address;

        christianStateContract = await ethers.getContractAt('ChristianState', christianStateContractAddress);
        churchCommunityContract = await ethers.getContractAt('ChurchCommunity', churchCommunityContractAddress);

        christianStateAdmin = await christianStateContract.connect(accounts[0]);
        churchCommunityAdmin = await churchCommunityContract.connect(accounts[0]);
    });

    describe("registerCitizen", () => {
        it("should get reverted when Account is not an ADMINISTRATOR", async () => {
            const account1 = await churchCommunityContract.connect(accounts[1]);

            await expect(
                account1.registerCitizen(accounts[2])
            ).to.be.revertedWithCustomError(churchCommunityContract, 'AccountHasNoAdminRole');
        })

        it("should not get reverted when Account has ADMINISTRATOR role", async () => {
            await expect(
                churchCommunityAdmin.registerCitizen(accounts[2])
            ).not.to.be.reverted;
        })
    });
})