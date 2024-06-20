import { HardhatRuntimeEnvironment } from "hardhat/types"

const churchCommunity = async function (hre: HardhatRuntimeEnvironment) {
    const { getNamedAccounts, deployments} = hre;
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();

    const churchCommunity = await deploy("ChurchCommunity", {
      from: deployer,
        args: [],
        log: true,
        waitConfirmations: 1,
    })
}

export default churchCommunity
churchCommunity.tags = ["all", "church_community"]