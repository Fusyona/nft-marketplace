import { ethers } from "hardhat";
import { Address, Receipt } from "hardhat-deploy/types";
import {
    Event,
    Contract,
    Signer,
    BigNumber,
    ContractTransaction,
} from "ethers";
import { Marketplace as MarketplaceContract } from "../typechain-types";

class Marketplace {
    contractAddress: Address;
    signer: Signer;
    private contractSingleton: MarketplaceContract | undefined = undefined;

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

    async withdraw(): Promise<Receipt> {
        try {
            const receipt = await (await this.getContract()).withdraw();
            return await receipt.wait();
        } catch (error) {
            throw error;
        }
    }

    async list(
        collectionAddress: Address,
        nftId: string,
        price: string
    ): Promise<Receipt> {
        try {
            const receipt = await (
                await this.getContract()
            ).list(collectionAddress, nftId, price);
            return await receipt.wait();
        } catch (error: any) {
            throw new Error(error.message);
        }
    }

    async buy(collectionAddress: Address, nftId: string): Promise<Receipt> {
        try {
            const dataNFT = await this.getDataNFT(collectionAddress, nftId);
            const receipt = await (
                await this.getContract()
            ).buy(collectionAddress, nftId, { value: dataNFT.price });
            return await receipt.wait();
        } catch (error: any) {
            throw error;
        }
    }

    async makeOffer(
        collectionAddress: Address,
        nftId: string,
        priceOffer: BigNumber | number,
        durationInDays: number
    ) {
        const contract = await this.getContract();
        return await contract.makeOffer(
            collectionAddress,
            nftId,
            durationInDays,
            {
                value: priceOffer,
            }
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
        collectionAddress: string,
        nftId: number | BigNumber,
        offerPrice: number | BigNumber,
        durationInDays: number
    ) {
        const offerTx = await this.makeOffer(
            collectionAddress,
            nftId.toString(),
            offerPrice,
            durationInDays
        );
        return await this.getOfferIdFromTransaction(offerTx);
    }

    async makeCounterofferAndGetId(
        collectionAddress: string,
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

    async offersOf(
        collectionAddress: Address,
        nftId: string
    ): Promise<BigNumber> {
        try {
            const dataNFT = await this.getDataNFT(collectionAddress, nftId);
            return dataNFT.totalOffers;
        } catch (error: any) {
            throw error;
        }
    }

    async getDataNFT(collectionAddress: Address, nftId: string) {
        try {
            const dataNFT = await (
                await this.getContract()
            ).nftsListed(collectionAddress, nftId);
            if (dataNFT.listed === false) {
                throw new Error("NFT has not been listed yet");
            } else {
                return dataNFT;
            }
        } catch (error: any) {
            if ("message" in error) {
                throw error.message;
            }
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

    async getContract(): Promise<MarketplaceContract> {
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

    async nftsListed(collectionAddress: Address, nftId: BigNumber | number) {
        const contract = await this.getContract();
        return await contract.nftsListed(collectionAddress, nftId);
    }
}

export { Marketplace };
