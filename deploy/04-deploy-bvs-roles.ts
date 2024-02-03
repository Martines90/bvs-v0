import { network } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types"
import { developmentChains } from "../helper-hardhat-config";
import verify from "../utils/verify";

const bvsRoles = async function (hre: HardhatRuntimeEnvironment) {
    const { getNamedAccounts, deployments} = hre;
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();

    log('deploy in progress...')

    const bvsRoles = await deploy("BVS_Roles", {
      from: deployer,
        args: [],
        log: true,
        waitConfirmations: 1,
    })

    log(`BVS_Roles deployed at ${bvsRoles.address}`)
  if (
    !developmentChains.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY
  ) {
    await verify(bvsRoles.address, [])
  }

}

export default bvsRoles
bvsRoles.tags = ["all", "bvs_roles"]