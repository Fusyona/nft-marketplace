import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction, DeploymentsExtension } from "hardhat-deploy/types";
import { contractNames } from "../utils/constants";
import { getFromNetworkConfig } from "../helper-hardhat-config";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const paymentTokenAddress = await getPaymentToken(deployments);

    await deploy(contractNames.Erc20PaymentMarketplace, {
        from: deployer,
        args: [paymentTokenAddress],
        autoMine: true,
        log: true,
    });
};

async function getPaymentToken(deployments: DeploymentsExtension) {
    const tokenDeployment = await deployments.getOrNull(
        contractNames.MockERC20
    );
    return (
        tokenDeployment?.address ?? getFromNetworkConfig("paymentTokenAddress")
    );
}

export default func;
func.tags = [contractNames.Erc20PaymentMarketplace];
