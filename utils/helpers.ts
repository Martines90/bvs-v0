import { ethers } from "hardhat"
import { DECIMALS, INITIAL_PRICE } from "../helper-hardhat-config"

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

const hourInMiliSec = 60 * 60;

export enum Roles {
    ADMINISTRATOR = '0xb346b2ddc13f08bd9685b83a95304a79a2caac0aa7aa64129e1ae9f4361b4661',
    POLITICAL_ACTOR = '0x9f70d138cbbd87297896478196b4493d9dceaca01f5883ecbd7bee66d300348d'
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