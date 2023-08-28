import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const CONTRACT_NAME = "MsgValuePaymentMarketplace";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    await deploy(CONTRACT_NAME, {
        from: deployer,
        autoMine: true,
        log: true,
    });
};
export default func;
func.tags = [CONTRACT_NAME];
