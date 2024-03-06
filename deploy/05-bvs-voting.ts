import { network } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types"
import { developmentChains, networkConfig } from "../helper-hardhat-config";
import verify from "../utils/verify";

const bvsVoting = async function (hre: HardhatRuntimeEnvironment) {
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


    const bvsVoting = await deploy("BVS_Voting", {
      from: deployer,
        args: [
            ethUsdPriceFeedAddress,
        ],
        log: true,
        waitConfirmations: waitBlockConfirmations,
    })

    log(`BVS_Voting deployed at ${bvsVoting.address}`)
  if (
    !developmentChains.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY
  ) {
    await verify(bvsVoting.address, [ethUsdPriceFeedAddress])
  }

}

export default bvsVoting
bvsVoting.tags = ["all", "bvs_voting"]