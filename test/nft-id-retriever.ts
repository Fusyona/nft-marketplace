import { ethers, web3, deployments } from "hardhat";
import { EasyToken, NftIdRetriever } from "../typechain-types";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import NftIdRetrieverArtifact from "../artifacts/contracts/NftIdRetriever.sol/NftIdRetriever.json";
import { ExternalProvider, JsonRpcFetchFunc } from "@ethersproject/providers";
import NftIdRetrieverWrapper from "../scripts/nftId-retriever-wrapper";
import { contractNames } from "../utils/constants";

describe("Retrieving NFT identifiers for a specific account address", () => {
    const startId = 1;
    const endId = 6;
    const tokensToMintForUser = [2, 4, 6];

    let collection: EasyToken;
    let tokenRetriever: NftIdRetriever;

    let deployer: SignerWithAddress;
    let user: SignerWithAddress;

    let tokenIdRetrieverWrapper: NftIdRetrieverWrapper;

    before(async () => {
        [deployer, user] = await ethers.getSigners();
    });

    beforeEach(async () => {
        await deployments.fixture([ contractNames.EasyToken , contractNames.NftIdRetriever ])

        tokenRetriever = await ethers.getContract(contractNames.NftIdRetriever)
        collection = await ethers.getContract(contractNames.EasyToken)

        tokenIdRetrieverWrapper = new NftIdRetrieverWrapper(
            tokenRetriever.address,
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
                expect(tokensToMintForUser[i].toString()).to.equal(expectedOwnedids[i]);
            }
        });
    });
});
