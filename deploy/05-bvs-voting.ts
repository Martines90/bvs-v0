import { network } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types"
import { developmentChains } from "../helper-hardhat-config";
import verify from "../utils/verify";

const bvsVoting = async function (hre: HardhatRuntimeEnvironment) {
    const { getNamedAccounts, deployments} = hre;
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();

    log('deploy in progress...')

    const bvsVoting = await deploy("BVS_Voting", {
      from: deployer,
        args: [],
        log: true,
        waitConfirmations: 1,
    })

    log(`BVS_Voting deployed at ${bvsVoting.address}`)
  if (
    !developmentChains.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY
  ) {
    await verify(bvsVoting.address, [])
  }

}

export default bvsVoting
bvsVoting.tags = ["all", "bvs_voting"]