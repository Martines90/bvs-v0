import { network } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types"
import { developmentChains, networkConfig } from "../helper-hardhat-config";
import verify from "../utils/verify";

const bvsFunding = async function (hre: HardhatRuntimeEnvironment) {
    const { getNamedAccounts, deployments} = hre;
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId: number = network.config.chainId || 0;


    let ethUsdPriceFeedAddress;
    let waitBlockConfirmations = 6;
    
    if (developmentChains.includes(networkConfig[chainId].name)) {
        log("Use MockV3Aggregator")
        waitBlockConfirmations = 1;

        const ethUsdAggregator = deployments.get("MockV3Aggregator");
        ethUsdPriceFeedAddress = (await ethUsdAggregator).address;
    } else {
        ethUsdPriceFeedAddress = networkConfig[chainId].ethUsdPriceFeed;
    }

    log('deploy in progress...')
    log('price feed address:', ethUsdPriceFeedAddress)

    const bvsFunding = await deploy("BVS_Funding", {
      from: deployer,
        args: [
            ethUsdPriceFeedAddress
        ],
        log: true,
        waitConfirmations: waitBlockConfirmations,
    })

    log(`BVS_Funding deployed at ${bvsFunding.address}`)
  if (
    !developmentChains.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY
  ) {
    await verify(bvsFunding.address, [ethUsdPriceFeedAddress])
  }

}

export default bvsFunding
bvsFunding.tags = ["all", "bvsFunding"]