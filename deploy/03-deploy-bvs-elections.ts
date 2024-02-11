import { network } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types"
import { developmentChains, networkConfig } from "../helper-hardhat-config";
import verify from "../utils/verify";

const bvsElections = async function (hre: HardhatRuntimeEnvironment) {
    const { getNamedAccounts, deployments} = hre;
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();

    log('deploy in progress...')

    const bvsElections = await deploy("BVS_Elections", {
      from: deployer,
        args: [],
        log: true,
        waitConfirmations: 1,
    })

    log(`BVS_Elections deployed at ${bvsElections.address}`)
  if (
    !developmentChains.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY
  ) {
    await verify(bvsElections.address, [])
  }

}

export default bvsElections
bvsElections.tags = ["all", "bvs_elections"]