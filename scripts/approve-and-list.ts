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
        11: "3",
        12: "3",
        13: "3",
        14: "3",
        15: "30",
        16: "3",
        17: "3.5",
        18: "4",
        19: "1",
        20: "5",
    };
    for (const tokenId in priceOfNft) {
        console.log("=== Approving and listing token", tokenId);

        const tokenIdInt = parseInt(tokenId);
        console.log(
            await marketplaceWrapper.approveAndList(
                "0x9777C1cf48d8FaB1929c9776619b9F1599187FF0",
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
