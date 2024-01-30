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