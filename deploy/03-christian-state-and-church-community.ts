import { HardhatRuntimeEnvironment } from "hardhat/types"

const christianState = async function (hre: HardhatRuntimeEnvironment) {
    const { getNamedAccounts, deployments} = hre;
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();


    const christianState = await deploy("ChristianState", {
      from: deployer,
      args: [1],
      log: true,
      waitConfirmations: 1,
    })

    const churchCommunity_1 = await deploy("ChurchCommunity_1", {
      from: deployer,
      contract: 'ChurchCommunity',
      args: [christianState.address],
      log: true,
      waitConfirmations: 1,
    })

    const churchCommunity_2 = await deploy("ChurchCommunity_2", {
      from: deployer,
      contract: 'ChurchCommunity',
      args: [christianState.address],
      log: true,
      waitConfirmations: 1,
    })
}

export default christianState
christianState.tags = ["all", "christian_state_and_curch_community"]