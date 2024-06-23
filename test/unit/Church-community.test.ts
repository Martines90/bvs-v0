import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { deployments, ethers } from "hardhat";
import { ChristianState, ChurchCommunity } from "../../typechain-types";
import { AddressLike } from "ethers";
import { expect } from "chai";
import assert from "assert";
import { TimeQuantities } from "../../utils/helpers2";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const registerCitizens = async (admin: SignerWithAddress, accounts: SignerWithAddress[]) => {

}

describe('ChurchCommunity - main', () => {
    let MAX_DAILY_ADMIN_ACTIVITY: bigint;
    let MAX_NUM_OF_CITIZENS: bigint;
    let MAX_NUM_OF_ADMINS: bigint;

    let NEW_ADMIN_FREEZE_ACTIVITY_DAY_COUNT: bigint;
    let CRITICAL_ADMIN_ACTIVITY_FREEZE_DAY_COUNT: bigint;

    let christianStateAdmin: ChristianState;
    let contractCreationDate: bigint;
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

        // get constants value
        MAX_DAILY_ADMIN_ACTIVITY = await churchCommunityAdmin.MAX_DAILY_ADMIN_ACTIVITY();
        MAX_NUM_OF_CITIZENS = await churchCommunityAdmin.MAX_NUM_OF_CITIZENS();
        MAX_NUM_OF_ADMINS = await churchCommunityAdmin.MAX_NUM_OF_ADMINS();

        NEW_ADMIN_FREEZE_ACTIVITY_DAY_COUNT = await churchCommunityAdmin.NEW_ADMIN_FREEZE_ACTIVITY_DAY_COUNT();
        CRITICAL_ADMIN_ACTIVITY_FREEZE_DAY_COUNT = await churchCommunityAdmin.CRITICAL_ADMIN_ACTIVITY_FREEZE_DAY_COUNT();

        contractCreationDate = await churchCommunityAdmin.communityContractCreationDate();
    });

    describe("registerCitizen", () => {
        it("should get reverted when Account is not an ADMINISTRATOR", async () => {
            const account1 = await churchCommunityContract.connect(accounts[1]);

            await expect(
                account1.registerCitizen(accounts[2])
            ).to.be.revertedWithCustomError(churchCommunityContract, 'AccountHasNoAdminRole');
        })

        it("should get reverted when account already has citizenship", async () => {
            await churchCommunityAdmin.registerCitizen(accounts[1]);

            await expect(
                churchCommunityAdmin.registerCitizen(accounts[1])
            ).to.be.revertedWithCustomError(churchCommunityContract, 'ProvidedAccountAlreadyHasCitizenship');
        })

        it("should properly add new citizen", async () => {
            assert.equal(await churchCommunityAdmin.getCitizensSize(), BigInt(1))
            assert.equal(await churchCommunityAdmin.accountsWithCitizenRole(accounts[2]), false)

            await churchCommunityAdmin.registerCitizen(accounts[2])

            assert.equal(await churchCommunityAdmin.getCitizensSize(), BigInt(2))
            assert.equal(await churchCommunityAdmin.accountsWithCitizenRole(accounts[2]), true)
        })
    });

    describe("removeCitizen", () => {
        it("should get reverted when Account is not an ADMINISTRATOR", async () => {
            const account1 = await churchCommunityContract.connect(accounts[1]);

            await expect(
                account1.removeCitizen(accounts[2])
            ).to.be.revertedWithCustomError(churchCommunityContract, 'AccountHasNoAdminRole');
        })

        it("should get reverted when provided account has no citizenship", async () => {
            await expect(
                churchCommunityAdmin.removeCitizen(accounts[2])
            ).to.be.revertedWithCustomError(churchCommunityContract, 'ProvidedAccountHasNoCitizenship');
        })

        it("should properly remove citizen", async () => {
            await churchCommunityAdmin.registerCitizen(accounts[1])

            assert.equal(await churchCommunityAdmin.getCitizensSize(), BigInt(2))
            assert.equal(await churchCommunityAdmin.accountsWithCitizenRole(accounts[1]), true)

            await churchCommunityAdmin.removeCitizen(accounts[1])
     
            assert.equal(await churchCommunityAdmin.accountsWithCitizenRole(accounts[1]), false)
            assert.equal(await churchCommunityAdmin.getCitizensSize(), BigInt(1))
        })
    });


    describe("addAdmin", () => {
        it("should get reverted when Account is not an ADMINISTRATOR", async () => {
            const account1 = await churchCommunityContract.connect(accounts[1]);

            await expect(
                account1.addAdmin(accounts[2])
            ).to.be.revertedWithCustomError(churchCommunityContract, 'AccountHasNoAdminRole');
        })

        it("should get reverted when account already has admin role", async () => {
            await churchCommunityAdmin.addAdmin(accounts[1]);

            await time.increaseTo(contractCreationDate + (BigInt(TimeQuantities.DAY) * CRITICAL_ADMIN_ACTIVITY_FREEZE_DAY_COUNT));

            await expect(
                churchCommunityAdmin.addAdmin(accounts[1])
            ).to.be.revertedWithCustomError(churchCommunityContract, 'ProvidedAccountHasAdminRole');
        })

        it("should get reverted when account try add another admin within the admin activity freeze limit", async () => {
            await churchCommunityAdmin.addAdmin(accounts[1]);

            await time.increaseTo(contractCreationDate + (BigInt(TimeQuantities.DAY) * CRITICAL_ADMIN_ACTIVITY_FREEZE_DAY_COUNT) - BigInt(TimeQuantities.HOUR));


            await expect(
                churchCommunityAdmin.addAdmin(accounts[2])
            ).to.be.revertedWithCustomError(churchCommunityContract, 'AdminDailyActivityLimitReached');
        })

        it("should properly add new admins", async () => {
            assert.equal(await churchCommunityAdmin.getAdminsSize(), BigInt(1))
            assert.equal(await churchCommunityAdmin.accountsWithAdminRole(accounts[2]), false)

            await churchCommunityAdmin.addAdmin(accounts[2])

            assert.equal(await churchCommunityAdmin.getAdminsSize(), BigInt(2))
            assert.equal(await churchCommunityAdmin.accountsWithAdminRole(accounts[2]), true)

            await time.increaseTo(contractCreationDate + (BigInt(TimeQuantities.DAY) * CRITICAL_ADMIN_ACTIVITY_FREEZE_DAY_COUNT));

            await churchCommunityAdmin.addAdmin(accounts[3])

            assert.equal(await churchCommunityAdmin.getAdminsSize(), BigInt(3))
            assert.equal(await churchCommunityAdmin.accountsWithAdminRole(accounts[3]), true)
        })
    });

    describe("removeAdmin", () => {
        it("should get reverted when Account is not an ADMINISTRATOR", async () => {
            const account1 = await churchCommunityContract.connect(accounts[1]);

            await expect(
                account1.removeAdmin(accounts[2])
            ).to.be.revertedWithCustomError(churchCommunityContract, 'AccountHasNoAdminRole');
        })

        it("should get reverted when provided account has no admin role", async () => {
            await expect(
                churchCommunityAdmin.removeAdmin(accounts[1])
            ).to.be.revertedWithCustomError(churchCommunityContract, 'ProvidedAccountHasNoAdminRole');
        })

        it("should get reverted when admin try remove the admin within the admin activity freeze limit", async () => {
            await churchCommunityAdmin.addAdmin(accounts[1]);

            await time.increaseTo(contractCreationDate + (BigInt(TimeQuantities.DAY) * CRITICAL_ADMIN_ACTIVITY_FREEZE_DAY_COUNT) - BigInt(TimeQuantities.HOUR));


            await expect(
                churchCommunityAdmin.removeAdmin(accounts[1])
            ).to.be.revertedWithCustomError(churchCommunityContract, 'AdminDailyActivityLimitReached');
        })

        it("should properly remove admin", async () => {
            await churchCommunityAdmin.addAdmin(accounts[1])
            assert.equal(await churchCommunityAdmin.getAdminsSize(), BigInt(2))

            await time.increaseTo(contractCreationDate + (BigInt(TimeQuantities.DAY) * CRITICAL_ADMIN_ACTIVITY_FREEZE_DAY_COUNT));

            await churchCommunityAdmin.removeAdmin(accounts[1])

            assert.equal(await churchCommunityAdmin.getAdminsSize(), BigInt(1))
            assert.equal(await churchCommunityAdmin.accountsWithAdminRole(accounts[1]), false)
        })
    });

    /*
    function setHeadOfTheCommunity(
        address _newHeadOfCommunityAccount
    )
        public
        onlyAdminOnce
        newStateElectionNotScheduled
        accountHasAdminRole(_newHeadOfCommunityAccount)
    {
        headOfTheCommunity = _newHeadOfCommunityAccount;
    }
    */

    describe("setHeadOfTheCommunity", () => {
        it("should get reverted when Account is not an ADMINISTRATOR", async () => {
            const account1 = await churchCommunityContract.connect(accounts[1]);

            await expect(
                account1.setHeadOfTheCommunity(accounts[2])
            ).to.be.revertedWithCustomError(churchCommunityContract, 'AccountHasNoAdminRole');
        })

        it("should get reverted when state election already scheduled", async () => {
           /* FIXME: complete this test when Elections contract electionStartDate can be set
            await churchCommunityAdmin.addAdmin(accounts[2])

            await expect(
                churchCommunityAdmin.setHeadOfTheCommunity(accounts[2])
            ).to.be.revertedWithCustomError(churchCommunityContract, 'NewStateElectionAlreadyScheduled');
            */
        })

        it("should get reverted when admin try remove the admin within the admin activity freeze limit", async () => {
            await churchCommunityAdmin.addAdmin(accounts[1]);

            await time.increaseTo(contractCreationDate + (BigInt(TimeQuantities.DAY) * CRITICAL_ADMIN_ACTIVITY_FREEZE_DAY_COUNT) - BigInt(TimeQuantities.HOUR));


            await expect(
                churchCommunityAdmin.setHeadOfTheCommunity(accounts[1])
            ).to.be.revertedWithCustomError(churchCommunityContract, 'AdminDailyActivityLimitReached');
        })

        it("should get reverted when account has no admin role", async () => {
            await expect(
                churchCommunityAdmin.setHeadOfTheCommunity(accounts[1])
            ).to.be.revertedWithCustomError(churchCommunityContract, 'ProvidedAccountHasNoAdminRole');
        })

        it("should properly set the head of the community", async () => {
            await churchCommunityAdmin.addAdmin(accounts[1])

            await time.increaseTo(contractCreationDate + (BigInt(TimeQuantities.DAY) * CRITICAL_ADMIN_ACTIVITY_FREEZE_DAY_COUNT));

            await churchCommunityAdmin.setHeadOfTheCommunity(accounts[1])

            assert.equal(await churchCommunityAdmin.headOfTheCommunity(), accounts[1].address);

            await time.increase((BigInt(TimeQuantities.DAY) * CRITICAL_ADMIN_ACTIVITY_FREEZE_DAY_COUNT));

            await churchCommunityAdmin.setHeadOfTheCommunity(accounts[0])

            assert.equal(await churchCommunityAdmin.headOfTheCommunity(), accounts[0].address);
        })
    })
})