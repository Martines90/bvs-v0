import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { deployments, ethers } from "hardhat";
import { ChristianState, ChurchCommunity, Elections } from "../../typechain-types";
import { AddressLike } from "ethers";
import { expect } from "chai";
import assert from "assert";
import { FAR_FUTURE_DATE, TimeQuantities } from "../../utils/helpers2";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe('ChurchCommunity - main', () => {
    let S_MAIN_PRIO_REQUIRED_ADMIN_APPROVALS: bigint;


    let E_PRE_ELECTION_REGISTRATION_STARTS_BEFORE_START_DAYS: bigint;
    let E_PRE_ELECTIONS_VOTING_DAYS: bigint;
    let E_PRE_ELECTIONS_ELECTIONS_GAP_DAYS: bigint;

    let MAX_DAILY_ADMIN_ACTIVITY: bigint;
    let MAX_NUM_OF_CITIZENS: bigint;
    let MAX_NUM_OF_ADMINS: bigint;

    let NEW_ADMIN_FREEZE_ACTIVITY_DAY_COUNT: bigint;
    let CRITICAL_ADMIN_ACTIVITY_FREEZE_DAY_COUNT: bigint;

    let MIN_CHURCH_COMMUNITY_SIZE_TO_APPLY_ELECTIONS: bigint;

    let christianStateAdmin: ChristianState;
    let electionsAdmin: Elections;
    let contractCreationDate: bigint;
    let churchCommunityAdmin: ChurchCommunity;
    let christianStateContractAddress: AddressLike;
    let churchCommunityContractAddress: AddressLike;
    let electionsContractAddress: AddressLike;

    let accounts: SignerWithAddress[];

    let christianStateContract: ChristianState;
    let churchCommunityContract: ChurchCommunity;
    let electionsContract: Elections;

    beforeEach(async () => {
        time.increaseTo(FAR_FUTURE_DATE);

        accounts = await ethers.getSigners()

        const deploymentResults = await deployments.fixture(['mocks', 'christian_state_and_curch_community']);

        christianStateContractAddress = deploymentResults['ChristianState']?.address;
        churchCommunityContractAddress = deploymentResults['ChurchCommunity']?.address;

        christianStateContract = await ethers.getContractAt('ChristianState', christianStateContractAddress);
        churchCommunityContract = await ethers.getContractAt('ChurchCommunity', churchCommunityContractAddress);

        electionsContractAddress = await christianStateContract.electionsContractAddress();
        electionsContract = await ethers.getContractAt('Elections', electionsContractAddress);

        christianStateAdmin = await christianStateContract.connect(accounts[0]);
        churchCommunityAdmin = await churchCommunityContract.connect(accounts[0]);
        electionsAdmin = await electionsContract.connect(accounts[0]);

        // get constants value
        MAX_DAILY_ADMIN_ACTIVITY = await churchCommunityAdmin.MAX_DAILY_ADMIN_ACTIVITY();
        MAX_NUM_OF_CITIZENS = await churchCommunityAdmin.MAX_NUM_OF_CITIZENS();
        MAX_NUM_OF_ADMINS = await churchCommunityAdmin.MAX_NUM_OF_ADMINS();

        NEW_ADMIN_FREEZE_ACTIVITY_DAY_COUNT = await churchCommunityAdmin.NEW_ADMIN_FREEZE_ACTIVITY_DAY_COUNT();
        CRITICAL_ADMIN_ACTIVITY_FREEZE_DAY_COUNT = await churchCommunityAdmin.CRITICAL_ADMIN_ACTIVITY_FREEZE_DAY_COUNT();

        MIN_CHURCH_COMMUNITY_SIZE_TO_APPLY_ELECTIONS = await churchCommunityAdmin.MIN_CHURCH_COMMUNITY_SIZE_TO_APPLY_ELECTIONS();

        // state constants
        S_MAIN_PRIO_REQUIRED_ADMIN_APPROVALS = await christianStateAdmin.MAIN_PRIO_REQUIRED_ADMIN_APPROVALS();

        // elections constants

        E_PRE_ELECTION_REGISTRATION_STARTS_BEFORE_START_DAYS = await electionsAdmin.PRE_ELECTION_REGISTRATION_STARTS_BEFORE_START_DAYS();
        E_PRE_ELECTIONS_VOTING_DAYS = await electionsAdmin.PRE_ELECTIONS_VOTING_DAYS();
        E_PRE_ELECTIONS_ELECTIONS_GAP_DAYS = await electionsAdmin.PRE_ELECTIONS_ELECTIONS_GAP_DAYS();

        contractCreationDate = await churchCommunityAdmin.communityContractCreationDate();
    });

    const addAdmins = async (admin: ChristianState, accounts: SignerWithAddress[], from: number = 1, to: number) => {
        for (let i = from; i < to; i++) {
            await admin.addAdmin(accounts[i].address);
            await time.increase((BigInt(TimeQuantities.DAY) * CRITICAL_ADMIN_ACTIVITY_FREEZE_DAY_COUNT));
        }

        await time.increase((BigInt(TimeQuantities.DAY) * NEW_ADMIN_FREEZE_ACTIVITY_DAY_COUNT));
    }

    const addCitizens = async (from: number = 1, to: number = Number(MIN_CHURCH_COMMUNITY_SIZE_TO_APPLY_ELECTIONS)) => {
        let ct = 1;
        for (let i = from; i < to; i++) {
            if (ct % Number(MAX_DAILY_ADMIN_ACTIVITY) === 0) {
                await time.increase((BigInt(TimeQuantities.DAY)));
            }
            await churchCommunityAdmin.registerCitizen(accounts[i].address);
            ct++;
        }
        await time.increase((BigInt(TimeQuantities.DAY)));
    }
    
    const executeNAdminAttemptsOnStateSetElectionsStartDateMethod = async (date: bigint, admins: SignerWithAddress[]) => {
        for (let i = 0; i < admins.length; i++) {
            const admin = await christianStateContract.connect(admins[i]);

            await admin.setElectionStartDate(date);
        }
    }

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

            await time.increase((BigInt(TimeQuantities.DAY) * CRITICAL_ADMIN_ACTIVITY_FREEZE_DAY_COUNT));

            await expect(
                churchCommunityAdmin.addAdmin(accounts[1])
            ).to.be.revertedWithCustomError(churchCommunityContract, 'ProvidedAccountHasAdminRole');
        })

        it("should get reverted when account try add another admin within the admin activity freeze limit", async () => {
            await churchCommunityAdmin.addAdmin(accounts[1]);

            await time.increase((BigInt(TimeQuantities.DAY) * CRITICAL_ADMIN_ACTIVITY_FREEZE_DAY_COUNT) - BigInt(TimeQuantities.HOUR));


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

            await time.increase((BigInt(TimeQuantities.DAY) * CRITICAL_ADMIN_ACTIVITY_FREEZE_DAY_COUNT));

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

            await time.increase((BigInt(TimeQuantities.DAY) * CRITICAL_ADMIN_ACTIVITY_FREEZE_DAY_COUNT) - BigInt(TimeQuantities.HOUR));


            await expect(
                churchCommunityAdmin.removeAdmin(accounts[1])
            ).to.be.revertedWithCustomError(churchCommunityContract, 'AdminDailyActivityLimitReached');
        })

        it("should properly remove admin", async () => {
            await churchCommunityAdmin.addAdmin(accounts[1])
            assert.equal(await churchCommunityAdmin.getAdminsSize(), BigInt(2))

            await time.increase(BigInt(TimeQuantities.DAY) * CRITICAL_ADMIN_ACTIVITY_FREEZE_DAY_COUNT);

            await churchCommunityAdmin.removeAdmin(accounts[1])

            assert.equal(await churchCommunityAdmin.getAdminsSize(), BigInt(1))
            assert.equal(await churchCommunityAdmin.accountsWithAdminRole(accounts[1]), false)
        })
    });

    describe("setHeadOfTheCommunity", () => {
        it("should get reverted when account has no admin role", async () => {
            await expect(
                churchCommunityAdmin.setHeadOfTheCommunity(accounts[1])
            ).to.be.revertedWithCustomError(churchCommunityContract, 'ProvidedAccountHasNoAdminRole');
        })
        
        it("should get reverted when Account is not an ADMINISTRATOR", async () => {
            const account1 = await churchCommunityContract.connect(accounts[1]);

            await expect(
                account1.setHeadOfTheCommunity(accounts[2])
            ).to.be.revertedWithCustomError(churchCommunityContract, 'AccountHasNoAdminRole');
        })

        it("should get reverted when state election already scheduled", async () => {
            await christianStateAdmin.setElectionStartDate(FAR_FUTURE_DATE + TimeQuantities.YEAR);

            await churchCommunityAdmin.addAdmin(accounts[2])

            await time.increase((BigInt(TimeQuantities.DAY) * CRITICAL_ADMIN_ACTIVITY_FREEZE_DAY_COUNT));

            await expect(
                churchCommunityAdmin.setHeadOfTheCommunity(accounts[2])
            ).to.be.revertedWithCustomError(churchCommunityContract, 'NewStateElectionAlreadyScheduled');
        })

        it("should get reverted when admin try remove the admin within the admin activity freeze limit", async () => {
            await churchCommunityAdmin.addAdmin(accounts[1]);

            await time.increase((BigInt(TimeQuantities.DAY) * CRITICAL_ADMIN_ACTIVITY_FREEZE_DAY_COUNT) - BigInt(TimeQuantities.HOUR));

            await expect(
                churchCommunityAdmin.setHeadOfTheCommunity(accounts[1])
            ).to.be.revertedWithCustomError(churchCommunityContract, 'AdminDailyActivityLimitReached');
        })

        it("should properly set the head of the community", async () => {
            await churchCommunityAdmin.addAdmin(accounts[1])

            await time.increase((BigInt(TimeQuantities.DAY) * CRITICAL_ADMIN_ACTIVITY_FREEZE_DAY_COUNT));

            await churchCommunityAdmin.setHeadOfTheCommunity(accounts[1])

            assert.equal(await churchCommunityAdmin.headOfTheCommunity(), accounts[1].address);

            await time.increase((BigInt(TimeQuantities.DAY) * CRITICAL_ADMIN_ACTIVITY_FREEZE_DAY_COUNT));

            await churchCommunityAdmin.setHeadOfTheCommunity(accounts[0])

            assert.equal(await churchCommunityAdmin.headOfTheCommunity(), accounts[0].address);
        })
    })

    describe("setHeadOfTheCommunity", () => {
        const mockCommunityInfo: ChurchCommunity.CommunityInfoStruct = {
            websiteUrl: 'https://www.test-website.com',
            name: 'Christ First Church',
            country: 'United States',
            state: 'Oklahoma',
            county: '',
            zipcode: 'OK 73644',
            cityTownVillage: 'Elk City',
            district: '',
            _address: '1221 Pioneer Rd'
        };

        it("should get reverted when Account is not an ADMINISTRATOR", async () => {
            const account1 = await churchCommunityContract.connect(accounts[1]);

            await expect(
                account1.updateCommunityInfo(mockCommunityInfo)
            ).to.be.revertedWithCustomError(churchCommunityContract, 'AccountHasNoAdminRole');
        })

        it("should get reverted when admin try remove the admin within the admin activity freeze limit", async () => {
            await churchCommunityAdmin.addAdmin(accounts[1]);

            await time.increase((BigInt(TimeQuantities.DAY) * CRITICAL_ADMIN_ACTIVITY_FREEZE_DAY_COUNT) - BigInt(TimeQuantities.HOUR));


            await expect(
                churchCommunityAdmin.updateCommunityInfo(mockCommunityInfo)
            ).to.be.revertedWithCustomError(churchCommunityContract, 'AdminDailyActivityLimitReached');
        })

        it("should properly update community info", async () => {
            expect(
                await churchCommunityAdmin.communityInfo()
            ).to.deep.equal(Object.keys(mockCommunityInfo).map(
                (key: string) => ''
            ));

            await churchCommunityContract.updateCommunityInfo(mockCommunityInfo);

            expect(
                await churchCommunityAdmin.communityInfo()
            ).to.deep.equal(Object.keys(mockCommunityInfo).map(
                (key: string) => (mockCommunityInfo as any)[key]
            ));
        })
    })

    /*
    
    function applyForElections(
        string memory _programShortVersionIpfsHash,
        string memory _programLongVersionIpfsHash
    ) public onlyHeadOfTheCommunity {
        IElections(
            IChristianState(christianStateAddress).electionsContractAddress()
        ).applyForElection(
                msg.sender,
                _programShortVersionIpfsHash,
                _programLongVersionIpfsHash
            );
    }
    
    */

    describe.only("applyForElections", () => {
        beforeEach(async () => {
            await churchCommunityAdmin.addAdmin(accounts[1]);

            await time.increase((BigInt(TimeQuantities.DAY) * CRITICAL_ADMIN_ACTIVITY_FREEZE_DAY_COUNT));

            await churchCommunityAdmin.setHeadOfTheCommunity(accounts[1])

            await time.increase((CRITICAL_ADMIN_ACTIVITY_FREEZE_DAY_COUNT * BigInt(TimeQuantities.DAY)));

            await addCitizens();
        })
        it("should get reverted when Account is not the head of the community", async () => {
            await expect(
                churchCommunityAdmin.applyForElections(
                    'program-short-version-ipfs-hash',
                    'program-long-version-ipfs-hash'
                )
            ).to.be.revertedWithCustomError(churchCommunityContract, 'AccountIsNotTheHeadOfTheCommunity');
        })

        it("should revert when curch community size is below min limit", async () => {
            const headOfTheCommunity = await churchCommunityContract.connect(accounts[1]);

            await churchCommunityAdmin.removeCitizen(accounts[2]);

            await time.increase((BigInt(TimeQuantities.DAY) * NEW_ADMIN_FREEZE_ACTIVITY_DAY_COUNT));
            
            await expect(headOfTheCommunity.applyForElections(
                'program-short-version-ipfs-hash',
                'program-long-version-ipfs-hash'
            )).to.be.revertedWithCustomError(churchCommunityContract, 'YourChurchCommunityMembersSizeNotMakesYouEligibleToApplyElections')

        })

        it("should get reverted when Church community is not approved by the state", async () => {
            const headOfTheCommunity = await churchCommunityContract.connect(accounts[1]);

            await time.increase((BigInt(TimeQuantities.DAY) * NEW_ADMIN_FREEZE_ACTIVITY_DAY_COUNT));

            await expect(
                headOfTheCommunity.applyForElections(
                    'program-short-version-ipfs-hash',
                    'program-long-version-ipfs-hash'
                )
            ).to.be.revertedWithCustomError(electionsContract, 'ChurchCommunityNotApprovedByState');
        })


        it("should get reverted when elections not yet scheduled", async () => {
            const churchCommunityAddress = await churchCommunityAdmin.communityContractAddress();

            await christianStateAdmin.registerChurchCommunity(churchCommunityAddress);

            const headOfTheCommunity = await churchCommunityContract.connect(accounts[1]);

            await time.increase((BigInt(TimeQuantities.DAY) * NEW_ADMIN_FREEZE_ACTIVITY_DAY_COUNT));

            await expect(
                headOfTheCommunity.applyForElections(
                    'program-short-version-ipfs-hash',
                    'program-long-version-ipfs-hash'
                )
            ).to.be.revertedWithCustomError(electionsContract, 'ElectionNotYetScheduled');
        })


        it("should get reverted when pre election application period is not yet started or already finished", async () => {
            await addAdmins(christianStateAdmin, accounts, 1, 10);

            const electionsStartDate = BigInt(FAR_FUTURE_DATE + TimeQuantities.YEAR);

            await executeNAdminAttemptsOnStateSetElectionsStartDateMethod(electionsStartDate, accounts.slice(0, 10));


            await time.increase((BigInt(TimeQuantities.DAY) * CRITICAL_ADMIN_ACTIVITY_FREEZE_DAY_COUNT));

            const churchCommunityAddress = await churchCommunityAdmin.communityContractAddress();

            await christianStateAdmin.registerChurchCommunity(churchCommunityAddress);

            const headOfTheCommunity = await churchCommunityContract.connect(accounts[1]);

            await time.increaseTo(electionsStartDate - E_PRE_ELECTION_REGISTRATION_STARTS_BEFORE_START_DAYS - BigInt(TimeQuantities.DAY));

            await expect(
                headOfTheCommunity.applyForElections(
                    'program-short-version-ipfs-hash',
                    'program-long-version-ipfs-hash'
                )
            ).to.be.revertedWithCustomError(electionsContract, 'PreElectionApplicationPeriodIsNotYetStarted');

            await time.increaseTo(electionsStartDate - E_PRE_ELECTIONS_VOTING_DAYS - E_PRE_ELECTIONS_ELECTIONS_GAP_DAYS + BigInt(TimeQuantities.DAY));

            await expect(
                headOfTheCommunity.applyForElections(
                    'program-short-version-ipfs-hash',
                    'program-long-version-ipfs-hash'
                )
            ).to.be.revertedWithCustomError(electionsContract, 'PreElectionApplicationPeriodIsAlreadyFinished');

        })

        it("should get reverted when applicant already applied for pre elections", async () => {
            await addAdmins(christianStateAdmin, accounts, 1, 10);

            const electionsStartDate = BigInt(FAR_FUTURE_DATE + TimeQuantities.YEAR);

            await executeNAdminAttemptsOnStateSetElectionsStartDateMethod(electionsStartDate, accounts.slice(0, 10));


            await time.increase((BigInt(TimeQuantities.DAY) * CRITICAL_ADMIN_ACTIVITY_FREEZE_DAY_COUNT));

            const churchCommunityAddress = await churchCommunityAdmin.communityContractAddress();

            await christianStateAdmin.registerChurchCommunity(churchCommunityAddress);

            const headOfTheCommunity = await churchCommunityContract.connect(accounts[1]);

            await time.increaseTo(electionsStartDate - E_PRE_ELECTION_REGISTRATION_STARTS_BEFORE_START_DAYS + BigInt(TimeQuantities.DAY));

            await headOfTheCommunity.applyForElections(
                'program-short-version-ipfs-hash',
                'program-long-version-ipfs-hash'
            )

            await time.increase((BigInt(TimeQuantities.DAY) * CRITICAL_ADMIN_ACTIVITY_FREEZE_DAY_COUNT));

            await expect(
                headOfTheCommunity.applyForElections(
                    'program-short-version-ipfs-hash',
                    'program-long-version-ipfs-hash'
                )
            ).to.be.revertedWithCustomError(electionsContract, 'AccountAlreadyAppliedForPreElection');
        })

        it("should succeed", async () => {
            await addAdmins(christianStateAdmin, accounts, 1, 10);

            const electionsStartDate = BigInt(FAR_FUTURE_DATE + TimeQuantities.YEAR);

            await executeNAdminAttemptsOnStateSetElectionsStartDateMethod(electionsStartDate, accounts.slice(0, 10));


            await time.increase((BigInt(TimeQuantities.DAY) * CRITICAL_ADMIN_ACTIVITY_FREEZE_DAY_COUNT));

            const churchCommunityAddress = await churchCommunityAdmin.communityContractAddress();

            await christianStateAdmin.registerChurchCommunity(churchCommunityAddress);

            const headOfTheCommunity = await churchCommunityContract.connect(accounts[1]);

            await time.increaseTo(electionsStartDate - E_PRE_ELECTION_REGISTRATION_STARTS_BEFORE_START_DAYS + BigInt(TimeQuantities.DAY));

            assert.equal(await electionsAdmin.getPreElectionCanidateSize(), 0);

            await headOfTheCommunity.applyForElections(
                'program-short-version-ipfs-hash',
                'program-long-version-ipfs-hash'
            )

            assert.equal(await electionsAdmin.getPreElectionCanidateSize(), 1);
            assert.equal(await electionsAdmin.preElectionCandidateVoteScores(accounts[1]), 1)
        })
    })
})