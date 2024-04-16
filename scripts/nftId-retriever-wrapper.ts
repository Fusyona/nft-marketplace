import { ExternalProvider, JsonRpcFetchFunc } from "@ethersproject/providers";
import { BigNumber, Contract, providers, ethers } from "ethers";
import { Address, NotUndefined } from "./types";
import { NftIdRetriever } from "../typechain-types";

export default class NftIdRetrieverWrapper {
    private nftIdRetriever: NftIdRetriever;
    private provider: ethers.providers.Web3Provider;
    
    constructor(
        tokenIdRetrieverAddress: Address,
        tokenIdRetrieverAbi: NotUndefined,
        provider: ExternalProvider | JsonRpcFetchFunc
    ) {
        this.provider = this.provider = new providers.Web3Provider(provider);
        this.nftIdRetriever = new Contract(
            tokenIdRetrieverAddress,
            tokenIdRetrieverAbi,
            this.provider
        ) as NftIdRetriever;
    }

    async tokensOfOwner(
        collection: Address,
        owner: Address,
        startId: BigNumber | number,
        endId: BigNumber | number
    ) {
        return await this.nftIdRetriever.tokensOfOwner(
            collection,
            owner,
            startId,
            endId
        );
    }
}
