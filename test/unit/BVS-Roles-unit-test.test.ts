import { deployments, ethers } from 'hardhat';

import { BVS_Roles } from '../../typechain-types';
import { assert, expect } from 'chai';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

import { Roles, getPermissionDenyReasonMessage } from '../../utils/helpers';

import * as helpers from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("BVS_Roles", () => {
    let bvsRoles: BVS_Roles;
    let deployer: SignerWithAddress;
    let accounts: SignerWithAddress[];

    before(async () => {
        await helpers.reset();
    })

    beforeEach(async () => {
        accounts = await ethers.getSigners()
        deployer = accounts[0]

        const deploymentResults = await deployments.fixture(['bvs_roles']);

        const bvsAddress: string = deploymentResults['BVS_Roles']?.address;

        bvsRoles = await ethers.getContractAt('BVS_Roles', bvsAddress);
    })


    describe('grantAdministratorRole', () => {
        let bvsRolesAccount0: BVS_Roles;

        beforeEach(async () => {
            bvsRolesAccount0 = await bvsRoles.connect(accounts[0]);
        })

        it("should revert when account don't have ADMINISTRATOR role", async () => {
            const bvsRolesAccount1 = await bvsRoles.connect(accounts[1]);

            await expect(
                bvsRolesAccount1.grantAdministratorRole(accounts[2])
            ).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[1].address, Roles.ADMINISTRATOR));
        });

        it("should not revert when account has ADMINISTRATOR role", async () => {
            const bvsRolesAccount1 = await bvsRoles.connect(accounts[0]);

            await expect(
                bvsRolesAccount1.grantAdministratorRole(accounts[2])
            ).not.to.be.reverted

            assert.equal((await bvsRolesAccount0.getAdminsSize()), BigInt(2));
        });

        it("should revert when account already registered", async () => {
            const bvsRolesAccount1 = await bvsRoles.connect(accounts[0]);

            await bvsRolesAccount1.grantAdministratorRole(accounts[2])

            await expect(bvsRolesAccount1.grantAdministratorRole(accounts[2])).to.be.revertedWith('Admin role already granted');
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
                bvsRolesAccount1.grantCitizenRole(accounts[2])
            ).to.be.revertedWith(getPermissionDenyReasonMessage(accounts[1].address, Roles.ADMINISTRATOR));
        });

        it("should not revert when account has ADMINISTRATOR role", async () => {
            const bvsRolesAccount1 = await bvsRoles.connect(accounts[0]);

            await expect(
                bvsRolesAccount1.grantCitizenRole(accounts[2])
            ).not.to.be.reverted

            assert.equal((await bvsRolesAccount0.getCitizensSize()), BigInt(2));
        });

        it("should revert when account already registered", async () => {
            const bvsRolesAccount1 = await bvsRoles.connect(accounts[0]);

            await bvsRolesAccount1.grantCitizenRole(accounts[2])

            await expect(bvsRolesAccount1.grantCitizenRole(accounts[2])).to.be.revertedWith('Citizen role already granted');
        });
    })
})