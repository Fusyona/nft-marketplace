import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const ids = [1, 2, 3, 4, 5];
    const copies = [1, 1, 1, 1, 1];

    await deploy("MockERC1155Collection", {
        from: deployer,
        autoMine: true,
        log: true,
        args: [ids, copies],
    });
};
export default func;
func.tags = ["MockERC1155Collection"];
