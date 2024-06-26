import { ethers } from "hardhat"
import { DECIMALS, INITIAL_PRICE } from "../helper-hardhat-config"
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { BVS_Roles, BVS_Voting } from "../typechain-types";

import { keccak256 } from 'js-sha3';
import { solidityPacked, solidityPackedKeccak256, toUtf8Bytes, zeroPadValue } from "ethers";

const bytes32 = require('bytes32');

const hourInMilSec = 60 * 60;

export const NOW = Math.round(Date.now() / 1000);


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

export enum Roles {
    ADMINISTRATOR = '0xb346b2ddc13f08bd9685b83a95304a79a2caac0aa7aa64129e1ae9f4361b4661',
    POLITICAL_ACTOR = '0x9f70d138cbbd87297896478196b4493d9dceaca01f5883ecbd7bee66d300348d',
    CITIZEN = '0x313691be6e710b5e9c97c695d02c9e24926f986402f826152f3b2970694f72c9',
    VOTER = '0x15283fd96aa656c9df35ac2fcb112678a5f24f1ca97e591a97d1d16003dbfc9c'
}

export enum TimeQuantities {
    YEAR = hourInMilSec * 24 * 356,
    MONTH = hourInMilSec * 24 * 30,
    WEEK = hourInMilSec * 24 * 7,
    DAY = hourInMilSec * 24,
    HOUR = hourInMilSec
}

export const FAR_FUTURE_DATE = 2524687964; // GMT: 2050. January 1., Saturday 22:12:44

const CONTENT_CHECK_ASKED_NUM_OF_QUESTIONS = 5;

export const startTime = FAR_FUTURE_DATE - TimeQuantities.YEAR;


export const mockNextElectionsConfig = {
    electionsStartDate: startTime + 3 * TimeQuantities.MONTH + TimeQuantities.DAY,
    electionsEndDate: startTime + 4 * TimeQuantities.MONTH + TimeQuantities.DAY,
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
    // const account = `0x${BigInt(accountAddress).toString(16)}`;
    // return `Permissions: account ${account} is missing role ${roleKeccak256}`;
    return `PermissionsUnauthorizedAccount`;
}


export const grantCitizenshipForAllAccount2 = async (accounts: SignerWithAddress[], admin: BVS_Voting, limit = accounts.length) => {
    for (let i = 1; limit >= i; i++) {
        await grantCitizenRoleHelper(admin, accounts[i]);
    }
}

export const citizensVoteOnElectionsCandidate = async (candidate: SignerWithAddress, accounts: SignerWithAddress[], contract: BVS_Voting) => {
    for (let i = 0; accounts.length > i; i++) {
        const voter = await contract.connect(accounts[i]);
        await voter.voteOnElections(candidate.address);
    }
}

// voting

export const assignAnswersToVoting = async (contract: BVS_Voting, votingKey: string, hashedAnswers = mockHashedAnwers) => {
    await contract.addKeccak256HashedAnswersToVotingContent(votingKey, hashedAnswers)
}

export const assignAnswersToArticle = async (contract: BVS_Voting, votingKey: string, articleKey: string, hashedAnswers = mockHashedAnwers) => {
    await contract.addKeccak256HashedAnswersToArticle(votingKey, articleKey, hashedAnswers)
}

export const assignAnswersToArticleResponse = async (contract: BVS_Voting, votingKey: string, articleKey: string, hashedAnswers = mockHashedAnwers) => {
    await contract.addKeccak256HashedAnswersToArticleResponse(votingKey, articleKey, hashedAnswers)
}

// generate required answer hashes

export const generatBytes32InputArray = (arrayLength = 0) => {
    const items = []
    for (let i = 0; i < arrayLength;i++) {
        items.push(bytes32({ input: 'hashed-answer'}));
    }
    return items;
}

// startNewVotingWithQuizAndContentCheckAnswers

export const startNewVoting = async (politicalActor: BVS_Voting, startDate: number, budget = BigInt(0)) => {
    await politicalActor.scheduleNewVoting('content-ipfs-hash', startDate, budget);
}

export const addQuizAndContentCheckAnswersToVoting = async (admin: BVS_Voting) => {
    const votingKey = await admin.votingKeys((await admin.getVotingKeysLength()) - BigInt(1));

    await admin.assignQuizIpfsHashToVoting(votingKey, 'quiz-ipfs-hash')

    await assignAnswersToVoting(admin, votingKey)
}

export const addArticleToVotingWithQuizAndAnswers = async (admin: BVS_Voting, criticalPoliticalActorAccount: SignerWithAddress, isVoteOnA: boolean) => {
    const votingKey = await admin.votingKeys((await admin.getVotingKeysLength()) - BigInt(1));
    
    const criticalPoliticalActor = await admin.connect(criticalPoliticalActorAccount);

    const articleCount = await admin.getArticleKeysLength();
  
    await criticalPoliticalActor.publishProConArticle(votingKey, `ipfs-hash-${articleCount}`, isVoteOnA)

    const articleKey = await admin.articleKeys((await admin.getArticleKeysLength()) - BigInt(1));

    await admin.assignQuizIpfsHashToArticleOrResponse(votingKey, articleKey, 'quiz-ipfs-hash', true)

    await assignAnswersToArticle(admin, votingKey, articleKey)
}

export const addResponseToArticleWithQuizAndAnswers = async (admin: BVS_Voting, politicalActorAccountWhoStartedTheVoting: SignerWithAddress) => {
    const articlesCount = await admin.getArticleKeysLength();
    const votingKey = await admin.votingKeys((await admin.getVotingKeysLength()) - BigInt(1));
    const articleKey = await admin.articleKeys((articlesCount) - BigInt(1));

    const politicalActorWhoStartedTheVoting = await admin.connect(politicalActorAccountWhoStartedTheVoting);

    await politicalActorWhoStartedTheVoting.publishProConArticleResponse(votingKey, articleKey, `ipfs-response-hash-${articlesCount}`)

    await admin.assignQuizIpfsHashToArticleOrResponse(votingKey, articleKey, 'quiz-ipfs-hash', false)

    await assignAnswersToArticleResponse(admin, votingKey, articleKey)
}

// completeVoting

export const completeVoting = async (admin: BVS_Voting, voterAccount: SignerWithAddress) => {
    const votingKey = await admin.votingKeys((await admin.getVotingKeysLength()) - BigInt(1));

    const voter = await admin.connect(voterAccount);

    const indexes = await admin.getAccountVotingQuizAnswerIndexes(votingKey, voterAccount.address)

    const answers = indexes.map((item: any) => `hashed-answer-${item}`);

    if (!(await admin.checkIfAccountHasRole(voterAccount.address, Roles.CITIZEN))) {
        await grantCitizenRoleHelper(admin, voterAccount);
    }

    await voter.completeContentReadQuiz(1, votingKey, bytes32(""), answers);
}

// completeArticle

export const completeArticle = async (admin: BVS_Voting, voterAccount: SignerWithAddress, _articleKey = '') => {
    const votingKey = await admin.votingKeys((await admin.getVotingKeysLength()) - BigInt(1));
    const articleKey = _articleKey ? _articleKey : await admin.articleKeys((await admin.getArticleKeysLength()) - BigInt(1));

    const voter = await admin.connect(voterAccount);

    const indexes = await admin.getAccountArticleQuizAnswerIndexes(votingKey, articleKey, voterAccount.address)

    const answers = indexes.map((item: any) => `hashed-answer-${item}`);

    if (!(await admin.checkIfAccountHasRole(voterAccount.address, Roles.CITIZEN))) {
        grantCitizenRoleHelper(admin, voterAccount);
    }

    await voter.completeContentReadQuiz(2, votingKey, articleKey, answers);
}


// completeResponse

export const completeArticleResponse = async (admin: BVS_Voting, voterAccount: SignerWithAddress, _articleKey = '') => {
    const votingKey = await admin.votingKeys((await admin.getVotingKeysLength()) - BigInt(1));
    const articleKey = _articleKey ? _articleKey : await admin.articleKeys((await admin.getArticleKeysLength()) - BigInt(1));

    const voter = await admin.connect(voterAccount);

    const indexes = await admin.getAccountArticleResponseQuizAnswerIndexes(votingKey, articleKey, voterAccount.address)

    const answers = indexes.map((item: any) => `hashed-answer-${item}`);

    if (!(await admin.checkIfAccountHasRole(voterAccount.address, Roles.CITIZEN))) {
        grantCitizenRoleHelper(admin, voterAccount);
    }

    await voter.completeContentReadQuiz(3, votingKey, articleKey, answers);
}


export const callScheduleNextElections = (connectedAccount: BVS_Voting, mockInput?: any) => {
    return connectedAccount.scheduleNextElections(
        (mockInput || mockNextElectionsConfig).electionsStartDate,
        (mockInput || mockNextElectionsConfig).electionsEndDate
    )
}

// electCandidates

export const applyCandidatesForElections = async (admin: BVS_Voting, candidates: SignerWithAddress[]) => {

    const electionsApplicationFee = BigInt(await admin.electionsCandidateApplicationFee());

    for (let i = 0;i < candidates.length;i++) {
        const candidate = await admin.connect(candidates[i]);
        await candidate.applyForElections({ value: (electionsApplicationFee * BigInt(110)) / BigInt(100)});
    }
}

export const electCandidates = async (admin: BVS_Voting, candidates: SignerWithAddress[]) => {
    const electionsDateConfig = {
        electionsStartDate: startTime + TimeQuantities.MONTH + TimeQuantities.DAY,
        electionsEndDate: startTime + 2 * TimeQuantities.MONTH + TimeQuantities.DAY,
    }

    await callScheduleNextElections(admin, electionsDateConfig)

    await applyCandidatesForElections(admin, candidates);
    
    const accounts = await ethers.getSigners()
   

    await time.increaseTo(electionsDateConfig.electionsStartDate + TimeQuantities.DAY);

    for (let i = 0;i < candidates.length;i++) {
        await citizensVoteOnElectionsCandidate(candidates[i], [accounts[19-i]], admin);
    }

    await time.increaseTo(electionsDateConfig.electionsEndDate + TimeQuantities.WEEK + TimeQuantities.DAY);

    await admin.closeElections()
}
1716279526
1716242400
export const grantCitizenRoleHelper = async (admin: BVS_Voting | BVS_Roles, account: SignerWithAddress) => {
    const bvsVotingAccount1 = await admin.connect(account);
    const emailWalletAddressHash = getAccountCitizenshipApplicationHash(account);
    await bvsVotingAccount1.applyForCitizenshipRole(emailWalletAddressHash,  { value: sendValuesInEth.small});
    // move to next day
    await time.increase(TimeQuantities.DAY)

    await admin.grantCitizenRole(account, emailWalletAddressHash, false);
}

export const applyForCitizenRoleHelper = async (admin: BVS_Voting | BVS_Roles, accounts: SignerWithAddress[]) => {
    for (let i = 0;i < accounts.length;i++) {
        const bvsVotingAccount1 = await admin.connect(accounts[i]);
        const emailWalletAddressHash = getAccountCitizenshipApplicationHash(accounts[i]);
        await bvsVotingAccount1.applyForCitizenshipRole(emailWalletAddressHash,  { value: sendValuesInEth.small});
    }
}


export const getPayableContractInteractionReport = async (admin: BVS_Voting, account: SignerWithAddress, actionFN: any) => {
    const bvsAddress = await admin.getAddress();
    const provider = admin.runner?.provider;

    const startContractBalance = (await provider?.getBalance(bvsAddress)) || BigInt(0);


    const startAccountBalance = (await provider?.getBalance(account)) || BigInt(0);

    const transactionResponse = await actionFN();

    const transactionReceipt = (await transactionResponse.wait(1)) || {
        gasUsed: BigInt(0),
        gasPrice: BigInt(0),
    };

    const { gasUsed, gasPrice } = transactionReceipt;
    const gasCost = gasUsed * gasPrice;

    const endContractBalance = ((await provider?.getBalance(bvsAddress))  || BigInt(0));
    const endAccountBalance = (await provider?.getBalance(account)) || BigInt(0);

    return {
        startContractBalance,
        startAccountBalance,
        endContractBalance,
        endAccountBalance,
        gasCost
    }
}

export const getAccountCitizenshipApplicationHash = (account: SignerWithAddress) => bytes32({input: keccak256("test@email.com" + account.address).slice(0,31)});