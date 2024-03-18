import { deployments, ethers } from 'hardhat';

import { BVS_Roles } from '../../typechain-types';
import { assert, expect } from 'chai';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

import { FAR_FUTURE_DATE, NOW, Roles, TimeQuantities, getPermissionDenyReasonMessage } from '../../utils/helpers';

import { time } from "@nomicfoundation/hardhat-network-helpers";

import * as helpers from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { applyForCitizenRoleHelper, grantCitizenRoleHelper, sendValuesInEth } from '../../utils/helpers2';

describe("BVS_Roles", () => {
    let bvsRoles: BVS_Roles;
    let deployer: SignerWithAddress;
    let accounts: SignerWithAddress[];

    let MIN_PERCENTAGE_GRANT_ADMIN_APPROVALS_REQUIRED: bigint;

    let admin: BVS_Roles;

    before(async () => {
        await helpers.reset();
    })

    beforeEach(async () => {
        accounts = await ethers.getSigners()
        deployer = accounts[0]

        const deploymentResults = await deployments.fixture(['bvs_roles']);

        const bvsAddress: string = deploymentResults['BVS_Roles']?.address;

        bvsRoles = await ethers.getContractAt('BVS_Roles', bvsAddress);

        admin = await bvsRoles.connect(accounts[0])

        MIN_PERCENTAGE_GRANT_ADMIN_APPROVALS_REQUIRED = await bvsRoles.MIN_PERCENTAGE_GRANT_ADMIN_APPROVALS_REQUIRED();
    })


    describe('sendGrantAdministratorRoleApproval', () => {
        let bvsRolesAccount0: BVS_Roles;

        beforeEach(async () => {
            time.increaseTo(FAR_FUTURE_DATE)
            bvsRolesAccount0 = await bvsRoles.connect(accounts[0]);
        })

        it("should revert when account don't have ADMINISTRATOR role", async () => {
            const bvsRolesAccount1 = await bvsRoles.connect(accounts[1]);

            await expect(
                bvsRolesAccount1.sendGrantAdministratorRoleApproval(accounts[2])
            ).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[1].address, Roles.ADMINISTRATOR));
        });

        it("should not revert when account has ADMINISTRATOR role", async () => {
            const bvsRolesAccount1 = await bvsRoles.connect(accounts[0]);

            await expect(
                bvsRolesAccount1.sendGrantAdministratorRoleApproval(accounts[2])
            ).not.to.be.reverted

            assert.equal((await bvsRolesAccount0.getAdminsSize()), BigInt(2));
        });

        it("should revert when admin already sent his grant approval", async () => {
            const bvsRolesAccount1 = await bvsRoles.connect(accounts[0]);

            await bvsRolesAccount1.sendGrantAdministratorRoleApproval(accounts[2])

            await bvsRolesAccount1.sendGrantAdministratorRoleApproval(accounts[3])

            await bvsRolesAccount1.sendGrantAdministratorRoleApproval(accounts[4])

            await expect(bvsRolesAccount1.sendGrantAdministratorRoleApproval(accounts[4])).to.be.revertedWithCustomError(bvsRoles,
                'AdminRoleGrantApprovalAlreadySent'
            );
        });

        it("should not grant admin role when no enough admin role grant approval arrived", async () => {
            await admin.sendGrantAdministratorRoleApproval(accounts[1])

            const admin1 = await bvsRoles.connect(accounts[1]);

            await admin1.sendGrantAdministratorRoleApproval(accounts[2])
            await admin.sendGrantAdministratorRoleApproval(accounts[2])

            await admin.sendGrantAdministratorRoleApproval(accounts[3])

            assert.equal(await admin.hasRole(Roles.ADMINISTRATOR, accounts[3]), false)
            assert.equal(await admin.getAdminsSize(), BigInt(3))

            // gets one more approval (to have 50% support)

            const admin2 = await bvsRoles.connect(accounts[1]);

            await admin2.sendGrantAdministratorRoleApproval(accounts[3])

            assert.equal(await admin1.hasRole(Roles.ADMINISTRATOR, accounts[3]), true)
            assert.equal(await admin1.getAdminsSize(), BigInt(4))
        });
    })

    describe("revokeAdminRoleApproval", async () => {

        let bvsRolesAccount0: BVS_Roles;

        beforeEach(async () => {
            time.increaseTo(FAR_FUTURE_DATE)
            bvsRolesAccount0 = await bvsRoles.connect(accounts[0]);
        })

        it("should revert when account don't have ADMINISTRATOR role", async () => {
            const bvsRolesAccount1 = await bvsRoles.connect(accounts[1]);

            await expect(
                bvsRolesAccount1.revokeAdminRoleApproval(accounts[2])
            ).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[1].address, Roles.ADMINISTRATOR));
        });

        it("should revoke admin role", async () => {
            await admin.sendGrantAdministratorRoleApproval(accounts[1])

            const admin1 = await bvsRoles.connect(accounts[1]);
            await admin1.sendGrantAdministratorRoleApproval(accounts[2])
            await admin.sendGrantAdministratorRoleApproval(accounts[2])

            assert.equal(await admin.getAdminsSize(), BigInt(3))

            await admin.revokeAdminRoleApproval(accounts[2]);
            await admin1.revokeAdminRoleApproval(accounts[2]);

            assert.equal(await admin.getAdminsSize(), BigInt(2))
        });

    })


    describe('grantCitizenRole', () => {
        let bvsRolesAccount0: BVS_Roles;

        beforeEach(async () => {
            bvsRolesAccount0 = await bvsRoles.connect(accounts[0]);
        })

        it("should revert when account don't have ADMINISTRATOR role", async () => {
            const bvsRolesAccount1 = await bvsRoles.connect(accounts[1]);

            await expect(
                bvsRolesAccount1.grantCitizenRole(accounts[2], false)
            ).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[1].address, Roles.ADMINISTRATOR));
        });

        it("should revert when citizen not applied for citizen role", async () => {
            const bvsRolesAccount1 = await bvsRoles.connect(accounts[0]);

            await expect(bvsRolesAccount1.grantCitizenRole(accounts[2], false)).to.be.revertedWithCustomError(bvsRoles, 'NotAppliedForCitizenRole');
        });

        it("should revert when citizen role already granted", async () => {
            const bvsRolesAccount1 = await bvsRoles.connect(accounts[0]);

            const citizen2 = await bvsRoles.connect(accounts[2]);

            await citizen2.applyForCitizenshipRole('test@email.com',  { value: sendValuesInEth.small});

            await bvsRolesAccount1.grantCitizenRole(accounts[2], false)

            await expect(bvsRolesAccount1.grantCitizenRole(accounts[2], false)).to.be.revertedWithCustomError(bvsRoles, 'CitizenRoleAlreadyGranted');
        });

        it("should revert when account ran out of grant citizen role credits for the day", async () => {
            const bvsRolesAccount1 = await bvsRoles.connect(accounts[0]);
            
            await applyForCitizenRoleHelper(bvsRoles, [accounts[2], accounts[3]]);

            await bvsRolesAccount1.grantCitizenRole(accounts[2], false)

            await expect(bvsRolesAccount1.grantCitizenRole(accounts[3], false)).to.be.revertedWithCustomError(bvsRoles, 'RunOutOfDailyCitizenRoleGrantCredit');
        });

        it("should grant citizen role", async () => {
            const bvsRolesAccount1 = await bvsRoles.connect(accounts[0]);

            await applyForCitizenRoleHelper(bvsRoles, [accounts[2]]);

            await expect(
                bvsRolesAccount1.grantCitizenRole(accounts[2], false)
            ).not.to.be.reverted

            assert.equal((await bvsRolesAccount0.getCitizensSize()), BigInt(2));
        });

        it("should grant citizen role again when one day passes", async () => {
            const bvsRolesAccount1 = await bvsRoles.connect(accounts[0]);

            await applyForCitizenRoleHelper(bvsRoles, [accounts[2], accounts[3]]);

            await bvsRolesAccount1.grantCitizenRole(accounts[2], false)

            await time.increaseTo(NOW + TimeQuantities.DAY)

            await expect(
                bvsRolesAccount1.grantCitizenRole(accounts[3], false)
            ).not.to.be.reverted

            assert.equal((await bvsRolesAccount0.getCitizensSize()), BigInt(3));
        });

        it("should revert when citizen role already revoked", async () => {
            const bvsRolesAccount1 = await bvsRoles.connect(accounts[0]);

            await applyForCitizenRoleHelper(bvsRoles, [accounts[2]]);

            await expect(bvsRolesAccount1.grantCitizenRole(accounts[2], true)).to.be.revertedWithCustomError(bvsRoles, 'CitizenRoleAlreadyRevokedOrNotGranted');
        });

        it("should revoke citizen role", async () => {
            const bvsRolesAccount1 = await bvsRoles.connect(accounts[0]);

            await applyForCitizenRoleHelper(bvsRoles, [accounts[2]]);

            await bvsRolesAccount1.grantCitizenRole(accounts[2], false)

            assert.equal((await bvsRolesAccount1.hasRole(Roles.CITIZEN, accounts[2])), true);

            await time.increaseTo(NOW + TimeQuantities.DAY)

            await expect(
                bvsRolesAccount1.grantCitizenRole(accounts[2], true)
            ).not.to.be.reverted

            assert.equal((await bvsRolesAccount1.hasRole(Roles.CITIZEN, accounts[2])), false);
            assert.equal((await bvsRolesAccount0.getCitizensSize()), BigInt(2));
        });
    })
})