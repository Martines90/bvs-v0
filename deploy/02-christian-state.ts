import { HardhatRuntimeEnvironment } from "hardhat/types"

const christianState = async function (hre: HardhatRuntimeEnvironment) {
    const { getNamedAccounts, deployments} = hre;
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();

    const christianState = await deploy("ChristianState", {
      from: deployer,
        args: [],
        log: true,
        waitConfirmations: 1,
    })
}

export default christianState
christianState.tags = ["all", "christian_state"]