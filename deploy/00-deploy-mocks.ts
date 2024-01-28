import { network } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DECIMALS, INITIAL_PRICE, developmentChains, networkConfig } from "../helper-hardhat-config";
import { DeployFunction } from "hardhat-deploy/dist/types";

const deployMocks: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
    const { getNamedAccounts, deployments} = hre;
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId: number = network.config.chainId || 0;

    if (developmentChains.includes(networkConfig[chainId].name)) {
        console.log("Deploy mocks")
        
        await deploy("MockV3Aggregator", {
            contract: "MockV3Aggregator",
            from: deployer,
            log: true,
            args: [DECIMALS, INITIAL_PRICE]
        });
    }
}

export default deployMocks
deployMocks.tags = ["all", "mocks"]