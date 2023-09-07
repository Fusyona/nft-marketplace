import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { contractNames } from "../utils/constants";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const ids = [1, 2, 3, 4, 5];

    await deploy(contractNames.MockERC721Collection, {
        from: deployer,
        autoMine: true,
        log: true,
        args: [ids],
    });
};
export default func;
func.tags = [contractNames.MockERC721Collection];
