import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const { address: erc20Address } = await deployments.get("MockERC20");

    await deploy("Erc20PaymentMarketplace", {
        from: deployer,
        args: [erc20Address],
        autoMine: true,
        log: true,
    });
};

export default func;
func.tags = ["Erc20PaymentMarketplace"];
