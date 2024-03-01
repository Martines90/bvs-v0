import { network } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types"
import { developmentChains, networkConfig } from "../helper-hardhat-config";
import verify from "../utils/verify";

const bvs = async function (hre: HardhatRuntimeEnvironment) {
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

    const bvsElections = await deploy("BVS_Elections", {
      from: deployer,
        args: [],
        log: true,
        waitConfirmations: waitBlockConfirmations,
    })

    const bvs = await deploy("BVS", {
      from: deployer,
        args: [
            ethUsdPriceFeedAddress,
            bvsElections.address
        ],
        log: true,
        waitConfirmations: waitBlockConfirmations,
    })

    log(`BVS deployed at ${bvs.address}`)
  if (
    !developmentChains.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY
  ) {
    await verify(bvs.address, [ethUsdPriceFeedAddress])
  }

}

export default bvs
bvs.tags = ["all", "bvs"]