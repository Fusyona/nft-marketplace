import { ethers, web3 } from "hardhat";
import { EasyToken, NftIdRetriever } from "../typechain-types";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import NftIdRetrieverArtifact from "../artifacts/contracts/NftIdRetriever.sol/NftIdRetriever.json";
import { ExternalProvider, JsonRpcFetchFunc } from "@ethersproject/providers";
import NftIdRetrieverWrapper from "../scripts/nftId-retriever-wrapper";

describe("Retrieving NFT identifiers for a specific account address", () => {
    const startId = 1;
    const endId = 6;
    const tokensToMintForUser = [2, 4, 6];

    let collection: EasyToken;
    let tokenRetriever: NftIdRetriever;

    const deployerIndex = 0;
    let deployer: SignerWithAddress;
    const userIndex = 3;
    let user: SignerWithAddress;
    let tokenIdRetrieverWrapper: NftIdRetrieverWrapper;

    beforeEach(async () => {

        const NftIdRetriever = await ethers.getContractFactory("NftIdRetriever");
        tokenRetriever = await NftIdRetriever.deploy() as NftIdRetriever;

        const tokenIdRetrieverAddress = tokenRetriever.address;

        const EasyToken = await ethers.getContractFactory("EasyToken");
        collection = await EasyToken.deploy() as EasyToken;

        const signers = await ethers.getSigners();

        deployer = signers[deployerIndex];

        user = signers[userIndex];

        tokenIdRetrieverWrapper = new NftIdRetrieverWrapper(
            tokenIdRetrieverAddress,
            NftIdRetrieverArtifact.abi,
            web3.currentProvider as JsonRpcFetchFunc | ExternalProvider
        );
    });

    describe("Retrieve tokenIds from user's account", () => {
        it("should return the right tokenIds for a given user's address", async () => {
            const collectionAddress = collection.address;

            await collection
                .connect(deployer)
                .safeMint(deployer.address, 1);
            await collection
                .connect(deployer)
                .safeMint(deployer.address, 3);
            await collection
                .connect(deployer)
                .safeMint(deployer.address, 5);

            await collection
                .connect(deployer)
                .safeMint(user.address, tokensToMintForUser[0]);
            await collection
                .connect(deployer)
                .safeMint(user.address, tokensToMintForUser[1]);
            await collection
                .connect(deployer)
                .safeMint(user.address, tokensToMintForUser[2]);

            const expectedOwnedids = await tokenIdRetrieverWrapper.tokensOfOwner(
                collectionAddress,
                user.address,
                startId,
                endId
            );

            for (let i = 0; i <= 2; ++i) {
                expect(tokensToMintForUser[i]).to.equal(expectedOwnedids[i]);
            }
        });
    });
});
