import { ethers } from "hardhat";
import { Address, Receipt } from "hardhat-deploy/types";
import {
    Event,
    Contract,
    Signer,
    BigNumber,
    ContractTransaction,
} from "ethers";
import {
    IMarketplace,
    Marketplace as MarketplaceContract,
} from "../typechain-types";

class Marketplace {
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

    async fusyBenefitsAccumulated(): Promise<BigNumber> {
        try {
            return await (await this.getContract()).fusyBenefitsAccumulated();
        } catch (error) {
            throw error;
        }
    }

    async totalOfNFTListed(): Promise<number> {
        try {
            const allNFTListedEventEmitted = await this.getEvents("NFTListed");
            const allNFTSoldEventEmitted = await this.getEvents("NFTSold");
            const nftsListed = allNFTListedEventEmitted.length;
            const nftsSold = allNFTSoldEventEmitted.length;
            if (nftsListed < nftsSold) {
                throw new Error("NFTSold is greater than NFTListed.");
            }
            return nftsListed - nftsSold;
        } catch (error: any) {
            console.error(error.message);
            throw error;
        }
    }

    async withdraw() {
        const tx = await (await this.getContract()).withdraw();
        await tx.wait(this.confirmations);
        return tx;
    }

    async list(
        collectionAddress: Address,
        nftId: number | BigNumber,
        price: BigNumber
    ) {
        const tx = await (
            await this.getContract()
        ).list(collectionAddress, nftId, price);
        await tx.wait(this.confirmations);
        return tx;
    }

    async buy(collectionAddress: Address, nftId: number | BigNumber) {
        const dataNFT = await this.getNftInfo(collectionAddress, nftId);
        const tx = await (
            await this.getContract()
        ).buy(collectionAddress, nftId, { value: dataNFT.price });
        await tx.wait(this.confirmations);
        return tx;
    }

    async makeOffer(
        collectionAddress: Address,
        nftId: number | BigNumber,
        priceOffer: BigNumber | number,
        durationInDays: number
    ) {
        const contract = await this.getContract();
        const tx = await contract.makeOffer(
            collectionAddress,
            nftId,
            durationInDays,
            {
                value: priceOffer,
            }
        );
        await tx.wait(this.confirmations);
        return tx;
    }

    async cancelOffer(
        collectionAddress: Address,
        nftId: number | BigNumber,
        indexOfOfferMapping: BigNumber | number
    ) {
        const contract = await this.getContract();
        const tx = await contract.cancelOffer(
            collectionAddress,
            nftId,
            indexOfOfferMapping
        );
        await tx.wait(this.confirmations);
        return tx;
    }

    async getOffer(
        collectionAddress: Address,
        nftId: BigNumber | number,
        indexOfOfferMapping: BigNumber | number
    ) {
        const contract = await this.getContract();
        return await contract.getOffer(
            collectionAddress,
            nftId,
            indexOfOfferMapping
        );
    }

    async getOfferIdFromTransaction(makeOfferTransaction: ContractTransaction) {
        const contract = await this.getContract();
        const offerId: BigNumber = await new Promise(async (resolve) => {
            contract.on("OfferMade", (_, __, ___, offerId: BigNumber) => {
                resolve(offerId);
            });
            await makeOfferTransaction.wait(this.confirmations);
        });
        return offerId;
    }

    async makeOfferAndGetId(
        collectionAddress: Address,
        nftId: number | BigNumber,
        offerPrice: number | BigNumber,
        durationInDays: number
    ) {
        const offerTx = await this.makeOffer(
            collectionAddress,
            nftId,
            offerPrice,
            durationInDays
        );
        return await this.getOfferIdFromTransaction(offerTx);
    }

    async makeCounterofferAndGetId(
        collectionAddress: Address,
        nftId: number | BigNumber,
        offerId: number | BigNumber,
        newPrice: number | BigNumber
    ) {
        const counterofferTx = await this.makeCounteroffer(
            collectionAddress,
            nftId,
            offerId,
            newPrice
        );
        return await this.getCounterofferIdFromTransaction(counterofferTx);
    }

    async takeOffer(
        collectionAddress: Address,
        nftId: number | BigNumber,
        indexOfOfferMapping: number | BigNumber
    ) {
        const tx = await (
            await this.getContract()
        ).takeOffer(collectionAddress, nftId, indexOfOfferMapping);
        await tx.wait(this.confirmations);
        return tx;
    }

    async offersOf(collectionAddress: Address, nftId: number | BigNumber) {
        try {
            const dataNFT = await this.getNftInfo(collectionAddress, nftId);
            return dataNFT.totalOffers;
        } catch (error: any) {
            throw error;
        }
    }

    plotUri(receipt: Receipt) {
        return this.uriScanner(receipt.transactionHash);
    }

    uriScanner(txHash: string) {
        return `https://mumbai.polygonscan.com/tx/${txHash}`;
    }

    private async getEvents(eventName: string): Promise<Event[]> {
        const marketplaceInstance: Contract = await this.getContract();
        const events = await marketplaceInstance.queryFilter(eventName);
        return events;
    }

    async getContract(): Promise<IMarketplace> {
        if (typeof this.contractSingleton === "undefined") {
            this.contractSingleton = await this.tryGetContract();
        }
        return this.contractSingleton;
    }

    async tryGetContract(): Promise<MarketplaceContract> {
        try {
            return (await ethers.getContractAt(
                "Marketplace",
                this.contractAddress,
                this.signer
            )) as MarketplaceContract;
        } catch (error: any) {
            throw error;
        }
    }
    async makeCounteroffer(
        collectionAddress: Address,
        nftId: BigNumber | number = 1,
        offerId: BigNumber | number = 1,
        newPrice: BigNumber | number = 1,
        durationInDays: number = 3
    ) {
        const contract = await this.getContract();
        return await contract.makeCounteroffer(
            collectionAddress,
            nftId,
            offerId,
            newPrice,
            durationInDays
        );
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
        const contract = await this.getContract();
        return await contract.getCounteroffer(
            collectionAddress,
            nftId,
            offerId
        );
    }

    async takeCounteroffer(
        id: BigNumber | number,
        valueToSent: BigNumber | number = 0
    ) {
        const contract = await this.getContract();
        const tx = await contract.takeCounteroffer(id, { value: valueToSent });
        await tx.wait(this.confirmations);

        return tx;
    }

    async isListed(collectionAddress: string, nftId: BigNumber | number) {
        const contract = await this.getContract();
        return await contract.isListed(collectionAddress, nftId);
    }

    async getFusyonaFeeFor(ethersValue: BigNumber) {
        const contract = await this.getContract();
        return await contract.getFusyonaFeeFor(ethersValue);
    }

    async changePriceOf(
        collectionAddress: Address,
        nftId: BigNumber | number,
        newPrice: BigNumber | number
    ) {
        const contract = await this.getContract();
        return await contract.changePriceOf(collectionAddress, nftId, newPrice);
    }

    async getNftInfo(collectionAddress: Address, nftId: BigNumber | number) {
        const contract = await this.getContract();
        return await contract.getNftInfo(collectionAddress, nftId);
    }

    async setFloorRatioFromPercentage(percentage: number) {
        const contract = await this.getContract();
        const tx = await contract.setFloorRatioFromPercentage(percentage);
        await tx.wait(this.confirmations);
        return tx;
    }

    async floorRatio() {
        const contract = await this.getContract();
        return await contract.floorRatio();
    }
}

export { Marketplace };
