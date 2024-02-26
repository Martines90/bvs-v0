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
    LARGE = 2
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
    small: usdToEther(1000),
    medium: usdToEther(10000),
    large: usdToEther(100000),
}

export const valuesInUsd = {
    small: usdWithDecimals(1000),
    medium: usdWithDecimals(10000),
    large: usdWithDecimals(100000)
}

export const mockHashedAnwers = [
    '0x68fb62764fff24bdb9519d2ed88a4193e88eaf76546c4c21d495dd08c4166fac', // hashed-answer-1
    '0xf873437ae0f8d9f6a52028c67f9b70f8376851df9b346812a7cdda09d04fcde0', // hashed-answer-2
    '0xc7f1671dd501054bac61b2ff2a7bbae597f7a31ac57e64d1e0c71337a00a70be', // hashed-answer-3
    '0x1eda30202f11e71a923f2dd6e5e9ac2201bf45250cffdc1c5b144c71d74dc75e', // hashed-answer-4
    '0x2f74f22fc803f2a34deeccafedd1d902ed659af4ef76fe58d7330d9ce965b2d8', // hashed-answer-5
    '0x813809630f4513e5d68803b7d20b4cff55847f14d3f83fd69bb1b334096b0267', // hashed-answer-6
    '0x126b6e8c5f52d5170fdebeed2044f1f995a8be17bd54fa95ae4d0c28f1ee8a3c', // hashed-answer-7
    '0xe88ee86cb32a1f68262583e468dd88f00b79a923c282f538f5ae067ba3287976', // hashed-answer-8
    '0x8d0ac92ff1c3280302e6e351923a19232e8d6ac2da089ea1dd416844575b15c0', // hashed-answer-9
    '0xc565b155b2c0a0fb27c01b2de9ce206063e4a29fa3326e35c9afa47c9d7366a4'  // hashed-answer-10
]

export const getPermissionDenyReasonMessage = (accountAddress: string, roleKeccak256: string): string => {
    const account = `0x${BigInt(accountAddress).toString(16)}`;
    return `Permissions: account ${account} is missing role ${roleKeccak256}`;
}


// Elections

export const grantCitizenshipForAllAccount = async (accounts: SignerWithAddress[], admin: any) => {
    for (let i = 1; accounts.length > i; i++) {
        await admin.grantCitizenRole(accounts[i]);
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

// voting

export const assignAnwersToVoting = async (contract: BVS_Voting, votingKey: string, cycleCount = 1, hashedAnswers = mockHashedAnwers) => {
    for (let i = 0; i < cycleCount; i++) {
        await contract.addKeccak256HashedAnswerToVotingContent(votingKey, hashedAnswers[i])
    }
}

export const assignAnswersToArticle = async (contract: BVS_Voting, votingKey: string, articleKey: string, cycleCount = 1, hashedAnswers = mockHashedAnwers) => {
    for (let i = 0; i < cycleCount; i++) {
        await contract.addKeccak256HashedAnswerToArticle(votingKey, articleKey, hashedAnswers[i])
    }
}

export const assignAnswersToArticleResponse = async (contract: BVS_Voting, votingKey: string, articleKey: string, cycleCount = 1, hashedAnswers = mockHashedAnwers) => {
    for (let i = 0; i < cycleCount; i++) {
        await contract.addKeccak256HashedAnswerToArticleResponse(votingKey, articleKey, hashedAnswers[i])
    }
}

// startNewVotingWithQuizAndContentCheckAnswers

export const startNewVoting = async (politicalActor: BVS_Voting, startDate: number, budget = BigInt(0)) => {
    await politicalActor.scheduleNewVoting('content-ipfs-hash', startDate, budget);
}

export const addQuizAndContentCheckAnswersToVoting = async (admin: BVS_Voting) => {
    const votingKey = await admin.votingKeys((await admin.getVotingKeysLength()) - BigInt(1));

    await admin.assignQuizIpfsHashToVoting(votingKey, 'quiz-ipfs-hash')

    await assignAnwersToVoting(admin, votingKey, 10)
}

export const addArticleToVotingWithQuizAndAnswers = async (admin: BVS_Voting, criticalPoliticalActorAccount: SignerWithAddress, isVoteOnA: boolean) => {
    const votingKey = await admin.votingKeys((await admin.getVotingKeysLength()) - BigInt(1));

    if (!(await admin.checkIfAccounthasRole(criticalPoliticalActorAccount.address, Roles.POLITICAL_ACTOR))) {
        await admin.grantPoliticalActorRole(criticalPoliticalActorAccount.address, 2);
    }
    
    const criticalPoliticalActor = await admin.connect(criticalPoliticalActorAccount);

    const articleCount = await admin.getArticleKeysLength();
  
    await criticalPoliticalActor.publishProConArticle(votingKey, `ipfs-hash-${articleCount}`, isVoteOnA)

    const articleKey = await admin.articleKeys((await admin.getArticleKeysLength()) - BigInt(1));

    await admin.assignQuizIpfsHashToArticleOrResponse(votingKey, articleKey, 'quiz-ipfs-hash', true)

    await assignAnswersToArticle(admin, votingKey, articleKey, 10)
}

export const addResponseToArticleWithQuizAndAnswers = async (admin: BVS_Voting, politicalActorAccountWhoStartedTheVoting: SignerWithAddress) => {
    const articlesCount = await admin.getArticleKeysLength();
    const votingKey = await admin.votingKeys((await admin.getVotingKeysLength()) - BigInt(1));
    const articleKey = await admin.articleKeys((articlesCount) - BigInt(1));

    const politicalActorWhoStartedTheVoting = await admin.connect(politicalActorAccountWhoStartedTheVoting);

    await politicalActorWhoStartedTheVoting.publishProConArticleResponse(votingKey, articleKey, `ipfs-response-hash-${articlesCount}`)

    await admin.assignQuizIpfsHashToArticleOrResponse(votingKey, articleKey, 'quiz-ipfs-hash', false)

    await assignAnswersToArticleResponse(admin, votingKey, articleKey, 10)
}

// completeVoting

export const completeVoting = async (admin: BVS_Voting, voterAccount: SignerWithAddress) => {
    const votingKey = await admin.votingKeys((await admin.getVotingKeysLength()) - BigInt(1));

    const voter = await admin.connect(voterAccount);

    const indexes = await admin.getAccountVotingQuizAnswerIndexes(votingKey, voterAccount.address)

    const answers = indexes.map((item) => `hashed-answer-${item}`);

    if (!(await admin.checkIfAccounthasRole(voterAccount.address, Roles.CITIZEN))) {
        await admin.grantCitizenRole(voterAccount)
    }

    await voter.completeVotingContentReadQuiz(votingKey, answers);
}

// completeArticle

export const completeArticle = async (admin: BVS_Voting, voterAccount: SignerWithAddress, _articleKey = '') => {
    const votingKey = await admin.votingKeys((await admin.getVotingKeysLength()) - BigInt(1));
    const articleKey = _articleKey ? _articleKey : await admin.articleKeys((await admin.getArticleKeysLength()) - BigInt(1));

    const voter = await admin.connect(voterAccount);

    const indexes = await admin.getAccountArticleQuizAnswerIndexes(votingKey, articleKey, voterAccount.address)

    const answers = indexes.map((item) => `hashed-answer-${item}`);

    if (!(await admin.checkIfAccounthasRole(voterAccount.address, Roles.CITIZEN))) {
        await admin.grantCitizenRole(voterAccount)
    }

    await voter.completeArticleReadQuiz(votingKey, articleKey, answers);
}


// completeResponse

export const completeArticleResponse = async (admin: BVS_Voting, voterAccount: SignerWithAddress, _articleKey = '') => {
    const votingKey = await admin.votingKeys((await admin.getVotingKeysLength()) - BigInt(1));
    const articleKey = _articleKey ? _articleKey : await admin.articleKeys((await admin.getArticleKeysLength()) - BigInt(1));

    const voter = await admin.connect(voterAccount);

    const indexes = await admin.getAccountArticleResponseQuizAnswerIndexes(votingKey, articleKey, voterAccount.address)

    const answers = indexes.map((item) => `hashed-answer-${item}`);

    if (!(await admin.checkIfAccounthasRole(voterAccount.address, Roles.CITIZEN))) {
        await admin.grantCitizenRole(voterAccount)
    }

    await voter.completeArticleResponseQuiz(votingKey, articleKey, answers);
}
