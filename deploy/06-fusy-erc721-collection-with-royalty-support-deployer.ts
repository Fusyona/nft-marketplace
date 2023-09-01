import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { contractNames, deployArgs } from "../utils/constants";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { creator } = await getNamedAccounts();
    const uri: string =
        "https://bafybeih73edbchreochzo2gp3ixdu3d6k4eaafjkbb7fryghz475hv5zoi.ipfs.nftstorage.link/";
    const cap: number = 9;
    const name: string = "WarInMars";
    const symbol: string = "Weapons";
    await deploy(contractNames.FusyERC721CollectionWithRoyaltySupport, {
        from: creator,
        autoMine: true,
        log: true,
        args: [uri, cap, name, symbol, deployArgs.ROYALTY_FEE_NUMERATOR],
    });
};
export default func;
func.tags = [contractNames.FusyERC721CollectionWithRoyaltySupport];
