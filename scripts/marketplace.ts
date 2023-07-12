import { ethers } from "hardhat";
import { Address, Receipt } from "hardhat-deploy/types";
import { Contract, Signer, BigNumber, ContractTransaction } from "ethers";
import {
    IMarketplace,
    Marketplace as MarketplaceContract,
} from "../typechain-types";

export default class Marketplace {
    contractAddress: Address;
    signer: Signer;
    private contractSingleton: IMarketplace | undefined = undefined;

    constructor(
        contractAddress: Address,
        signer: Signer,
        private confirmations: number | undefined = undefined
    ) {
        this.contractAddress = contractAddress;
        this.signer = signer;
    }

    async list(
        collectionAddress: Address,
        nftId: number | BigNumber,
        price: BigNumber | number
    ) {
        return await this.waitAndReturn((c) =>
            c.list(collectionAddress, nftId, price)
        );
    }

    private async waitAndReturn(
        contractTransactionFunction: (
            contract: IMarketplace
        ) => Promise<ContractTransaction>
    ) {
        const transaction = await this.onContract(contractTransactionFunction);
        await transaction.wait(this.confirmations);
        return transaction;
    }

    private async onContract<TResult>(
        contractFunction: (contract: IMarketplace) => Promise<TResult>
    ) {
        const contract = await this.getContract();
        return await contractFunction(contract);
    }

    async getContract() {
        if (typeof this.contractSingleton === "undefined") {
            this.contractSingleton = await this.newContractInstance();
        }
        return this.contractSingleton;
    }

    async newContractInstance() {
        return (await ethers.getContractAt(
            "Marketplace",
            this.contractAddress,
            this.signer
        )) as MarketplaceContract;
    }

    async isListed(collectionAddress: string, nftId: BigNumber | number) {
        return await this.onContract((c) =>
            c.isListed(collectionAddress, nftId)
        );
    }

    async totalOfNFTListed() {
        const allNFTListedEventEmitted = await this.getEvents("NFTListed");
        const allNFTSoldEventEmitted = await this.getEvents("NFTSold");
        const nftsListed = allNFTListedEventEmitted.length;
        const nftsSold = allNFTSoldEventEmitted.length;
        if (nftsListed < nftsSold) {
            throw new Error("NFTSold is greater than NFTListed.");
        }
        return nftsListed - nftsSold;
    }

    private async getEvents(eventName: string) {
        return await this.onContract((c: Contract) => c.queryFilter(eventName));
    }

    async getNftInfo(collectionAddress: Address, nftId: BigNumber | number) {
        return await this.onContract((c) =>
            c.getNftInfo(collectionAddress, nftId)
        );
    }

    async changePriceOf(
        collectionAddress: Address,
        nftId: BigNumber | number,
        newPrice: BigNumber | number
    ) {
        return await this.onContract((c) =>
            c.changePriceOf(collectionAddress, nftId, newPrice)
        );
    }

    async buy(collectionAddress: Address, nftId: number | BigNumber) {
        const nft = await this.getNftInfo(collectionAddress, nftId);
        return await this.waitAndReturn((c) =>
            c.buy(collectionAddress, nftId, { value: nft.price })
        );
    }

    async makeOffer(
        collectionAddress: Address,
        nftId: number | BigNumber,
        offerPrice: number | BigNumber,
        durationInDays: number
    ) {
        return await this.waitAndReturn((c) =>
            c.makeOffer(collectionAddress, nftId, durationInDays, {
                value: offerPrice,
            })
        );
    }

    async makeOfferAndGetId(
        collectionAddress: Address,
        nftId: number | BigNumber,
        offerPrice: number | BigNumber,
        durationInDays: number
    ) {
        const offerTx = await this.onContract((c) =>
            c.makeOffer(collectionAddress, nftId, durationInDays, {
                value: offerPrice,
            })
        );
        const id = await this.getOfferIdFromTransaction(offerTx);
        return { offerId: id, transaction: offerTx };
    }

    private async getOfferIdFromTransaction(
        makeOfferTransaction: ContractTransaction
    ) {
        const contract = await this.getContract();
        const offerId: BigNumber = await new Promise(async (resolve) => {
            contract.on("OfferMade", (_, __, ___, offerId: BigNumber) => {
                resolve(offerId);
            });
            await makeOfferTransaction.wait(this.confirmations);
        });
        return offerId;
    }

    async getOffer(
        collectionAddress: Address,
        nftId: BigNumber | number,
        indexOfOfferMapping: BigNumber | number
    ) {
        return await this.onContract((c) =>
            c.getOffer(collectionAddress, nftId, indexOfOfferMapping)
        );
    }

    async offersOf(collectionAddress: Address, nftId: number | BigNumber) {
        const nft = await this.getNftInfo(collectionAddress, nftId);
        return nft.totalOffers;
    }

    async cancelOffer(
        collectionAddress: Address,
        nftId: number | BigNumber,
        indexOfOfferMapping: BigNumber | number
    ) {
        return await this.waitAndReturn((c) =>
            c.cancelOffer(collectionAddress, nftId, indexOfOfferMapping)
        );
    }

    async takeOffer(
        collectionAddress: Address,
        nftId: number | BigNumber,
        indexOfOfferMapping: number | BigNumber
    ) {
        return await this.waitAndReturn((c) =>
            c.takeOffer(collectionAddress, nftId, indexOfOfferMapping)
        );
    }

    async makeCounteroffer(
        collectionAddress: Address,
        nftId: BigNumber | number = 1,
        offerId: BigNumber | number = 1,
        newPrice: BigNumber | number = 1,
        durationInDays: number = 3
    ) {
        return await this.waitAndReturn((c) =>
            c.makeCounteroffer(
                collectionAddress,
                nftId,
                offerId,
                newPrice,
                durationInDays
            )
        );
    }

    async makeCounterofferAndGetId(
        collectionAddress: Address,
        nftId: BigNumber | number = 1,
        offerId: BigNumber | number = 1,
        newPrice: BigNumber | number = 1,
        durationInDays: number = 3
    ) {
        const counterofferTx = await this.onContract((c) =>
            c.makeCounteroffer(
                collectionAddress,
                nftId,
                offerId,
                newPrice,
                durationInDays
            )
        );
        const id = await this.getCounterofferIdFromTransaction(counterofferTx);
        return { counterofferId: id, transaction: counterofferTx };
    }

    async getCounterofferIdFromTransaction(
        makeCountreofferTransaction: ContractTransaction
    ) {
        const contract = await this.getContract();
        const counterofferId: BigNumber = await new Promise(async (resolve) => {
            contract.on(
                "CounterofferMade",
                (_, __, ___, counterofferId: BigNumber) => {
                    resolve(counterofferId);
                }
            );
            await makeCountreofferTransaction.wait(this.confirmations);
        });
        return counterofferId;
    }

    async getCounteroffer(
        collectionAddress: string,
        nftId: BigNumber | number,
        offerId: BigNumber | number
    ) {
        return await this.onContract((c) =>
            c.getCounteroffer(collectionAddress, nftId, offerId)
        );
    }

    async takeCounteroffer(
        id: BigNumber | number,
        valueToSent: BigNumber | number = 0
    ) {
        return await this.waitAndReturn((c) =>
            c.takeCounteroffer(id, { value: valueToSent })
        );
    }

    async getFusyonaFeeFor(ethersValue: BigNumber | number) {
        return await this.onContract((c) => c.getFusyonaFeeFor(ethersValue));
    }

    async setFeeRatioFromPercentage(percentage: number) {
        return await this.waitAndReturn((c) =>
            c.setFeeRatioFromPercentage(percentage)
        );
    }

    async feeRatio() {
        return await this.onContract((c) => c.feeRatio());
    }

    async withdraw() {
        return await this.waitAndReturn((c) => c.withdraw());
    }

    async setFloorRatioFromPercentage(percentage: number) {
        return await this.waitAndReturn((c) =>
            c.setFloorRatioFromPercentage(percentage)
        );
    }

    async floorRatio() {
        return await this.onContract((c) => c.floorRatio());
    }

    async fusyBenefitsAccumulated() {
        return await this.onContract((c) => c.fusyBenefitsAccumulated());
    }

    plotUri(receipt: Receipt) {
        return this.uriScanner(receipt.transactionHash);
    }

    uriScanner(txHash: string) {
        return `https://mumbai.polygonscan.com/tx/${txHash}`;
    }
}
