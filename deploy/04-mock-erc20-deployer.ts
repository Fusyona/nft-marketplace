import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { contractNames } from "../utils/constants";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer, buyer } = await getNamedAccounts();

    await deploy(contractNames.MockERC20, {
        from: deployer,
        args: [[deployer, buyer]],
        autoMine: true,
        log: true,
    });
};
export default func;
func.tags = [contractNames.MockERC20];
