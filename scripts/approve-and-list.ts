import { getFromNetworkConfig } from "../helper-hardhat-config";
import Erc20PaymentMarketplaceWrapper from "./erc20-payment-marketplace-wrapper";
import erc20Artifact from "../artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json";
import erc20Marketplace from "../artifacts/contracts/Erc20PaymentMarketplace.sol/Erc20PaymentMarketplace.json";
import { web3 } from "hardhat";
import { ExternalProvider, JsonRpcFetchFunc } from "@ethersproject/providers";
import { parseEther } from "ethers/lib/utils";

async function main() {
    const erc20MarketplaceAddress = getFromNetworkConfig(
        "erc20MarketplaceAddress"
    );
    const erc20Address = getFromNetworkConfig("paymentTokenAddress");
    const marketplaceWrapper = new Erc20PaymentMarketplaceWrapper(
        erc20MarketplaceAddress!,
        erc20Marketplace.abi,
        erc20Address!,
        erc20Artifact.abi,
        web3.currentProvider as JsonRpcFetchFunc | ExternalProvider
    );
    const priceOfNft: Record<number, string> = {
        11: "2",
        12: "2",
        13: "2.00001",
        14: "2",
        15: "2",
        16: "2",
        17: "2",
        18: "0.1343434",
        19: "2",
        20: "3",
    };
    for (const tokenId in priceOfNft) {
        console.log("=== Approving and listing token", tokenId);

        const tokenIdInt = parseInt(tokenId);
        console.log(
            await marketplaceWrapper.approveAndList(
                "0xc45859F134CF41ADa4379a64023DC940FF94081B",
                tokenIdInt,
                parseEther(priceOfNft[tokenIdInt])
            )
        );
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
