import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { contractNames } from "../utils/constants";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    await deploy(contractNames.NebulaFaucet, {
        from: deployer,
        autoMine: true,
        log: true,
    });
};
export default func;
func.tags = [contractNames.NebulaFaucet];
