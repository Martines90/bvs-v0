import { ethers } from "hardhat"
import { DECIMALS, INITIAL_PRICE } from "../helper-hardhat-config"
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"
import { BVS_Voting } from "../typechain-types"

const bytes32 = require('bytes32');

export const usdToEther = (amountInUsd: number): bigint => {
    return ethers.parseEther(((amountInUsd * Math.pow(10, DECIMALS)) / INITIAL_PRICE).toString())
}

export const usdWithDecimals = (amountInUsd: number): bigint => {
    return BigInt(BigInt(amountInUsd) * BigInt(Math.pow(10, 18)))
}

export enum FundingSizeLevels {
    SMALL = 0,
    MEDIUM = 1,
    LARGE = 2,
    XLARGE = 3,
    XXLARGE = 4,
    XXXLARGE = 5
}

const VOTING_CHECK_ASKED_NUM_OF_QUESTIONS = 5;

const hourInMiliSec = 60 * 60;

export const NOW = Math.round(Date.now() / 1000);

export enum Roles {
    SUPER_ADMINISTRATOR = '0xd9d79e7f33c5bfc4f44a41571391ba287235a250c1b3651d666e8b35b4d8ad9a',
    ADMINISTRATOR = '0xb346b2ddc13f08bd9685b83a95304a79a2caac0aa7aa64129e1ae9f4361b4661',
    POLITICAL_ACTOR = '0x9f70d138cbbd87297896478196b4493d9dceaca01f5883ecbd7bee66d300348d',
    CITIZEN = '0x313691be6e710b5e9c97c695d02c9e24926f986402f826152f3b2970694f72c9',
}

export enum TimeQuantities {
    YEAR = hourInMiliSec * 24 * 356,
    MONTH = hourInMiliSec * 24 * 30,
    WEEK = hourInMiliSec * 24 * 7,
    DAY = hourInMiliSec * 24,
    HOUR = hourInMiliSec
}

export const sendValuesInEth = {
    small: usdToEther(100),
    medium: usdToEther(1000),
    large: usdToEther(10000),
}

export const valuesInUsd = {
    small: usdWithDecimals(100),
    medium: usdWithDecimals(1000),
    large: usdWithDecimals(10000),
    xlarge: usdWithDecimals(100000),
    xxlarge: usdWithDecimals(500000),
    xxxlarge: usdWithDecimals(1000000),
}

export const getPermissionDenyReasonMessage = (accountAddress: string, roleKeccak256: string): string => {
    const account = `0x${BigInt(accountAddress).toString(16)}`;
    return `Permissions: account ${account} is missing role ${roleKeccak256}`;
}


// Elections

export const grantCitizenshipForAllAccount = async (accounts: SignerWithAddress[], contract: any) => {
    const deployer = await contract.connect(accounts[0]);
    for (let i = 1; accounts.length > i; i++) {
        await deployer.grantCitizenRole(accounts[i]);
    }
}

export const citizensVoteOnPreElectionsCandidate = async (candidate: SignerWithAddress, accounts: SignerWithAddress[], contract: any) => {
    for (let i = 0; accounts.length > i; i++) {
        const voter = await contract.connect(accounts[i]);
        await voter.voteOnPreElections(candidate.address);
    }
}

export const citizensVoteOnElectionsCandidate = async (candidate: SignerWithAddress, accounts: SignerWithAddress[], contract: any) => {
    for (let i = 0; accounts.length > i; i++) {
        const voter = await contract.connect(accounts[i]);
        await voter.voteOnElections(candidate.address);
    }
}

export const assignAnwersToVoting = async (contract: BVS_Voting, votingKey: string, cycleCount = 1, hashedAnswer = 'hashed-answer') => {
    for (let i = 0; i < cycleCount; i++) {
        await contract.addKeccak256HashedAnswerToVotingContent(votingKey, bytes32(hashedAnswer))
    }
}

export const assignAnwersToArticle = async (contract: BVS_Voting, votingKey: string, articleKey: string, cycleCount = 1, hashedAnswer = 'hashed-answer') => {
    for (let i = 0; i < cycleCount; i++) {
        await contract.addKeccak256HashedAnswerToArticle(votingKey, articleKey, bytes32(hashedAnswer))
    }
}

export const assignAnwersToArticleResponse = async (contract: BVS_Voting, votingKey: string, articleKey: string, cycleCount = 1, hashedAnswer = 'hashed-answer') => {
    for (let i = 0; i < cycleCount; i++) {
        await contract.addKeccak256HashedAnswerToArticleResponse(votingKey, articleKey, bytes32(hashedAnswer))
    }
}

