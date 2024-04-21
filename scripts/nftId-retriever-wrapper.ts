import { ExternalProvider, JsonRpcFetchFunc } from "@ethersproject/providers";
import { BigNumber, Contract, providers, ethers } from "ethers";
import { Address } from "./types";
import NftIdRetrieverArtifact from "../artifacts/contracts/NftIdRetriever.sol/NftIdRetriever.json";
import ERC721Artifact from "../artifacts/@openzeppelin/contracts/token/ERC721/ERC721.sol/ERC721.json";
import { NftIdRetriever, ERC721 } from "../typechain-types";

export default class NftIdRetrieverWrapper {
    private nftIdRetriever: NftIdRetriever;
    private provider: ethers.providers.Web3Provider;
    private erc721Contract: ERC721;
    private collectionAddress: Address;

    constructor(
        tokenIdRetrieverAddress: Address,
        collectionAddress: Address,
        provider: ExternalProvider | JsonRpcFetchFunc
    ) {
        this.provider = this.provider = new providers.Web3Provider(provider);
        this.collectionAddress = collectionAddress;

        this.nftIdRetriever = new Contract(
            tokenIdRetrieverAddress,
            NftIdRetrieverArtifact.abi,
            this.provider
        ) as NftIdRetriever;

        this.erc721Contract = new Contract(
            collectionAddress,
            ERC721Artifact.abi,
            this.provider
        ) as ERC721;
    }

    async tokensOfOwner(
        owner: Address,
        startId: BigNumber | number,
        endId: BigNumber | number
    ) {
        const ownedIds = await this.nftIdRetriever.tokensOfOwner(
            this.collectionAddress,
            owner,
            startId,
            endId
        );
        const idsToNumber = ownedIds.map((id) => id.toNumber());
        return idsToNumber;
    }

    async getTokenNameAndSymbol() {
        let name = await this.erc721Contract.name();
        let symbol = await this.erc721Contract.symbol();

        return { name, symbol };
    }

    async getTokenURI(tokenId: BigNumber | number) {
        return await this.erc721Contract.tokenURI(tokenId);
    }

}
