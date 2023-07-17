import Web3 from "Web3";
import {
    BigNumber,
    Contract,
    ContractReceipt,
    ContractTransaction,
    providers,
} from "ethers";
import { IMarketplace } from "../typechain-types";

type Address = string;
type NotUndefined = Exclude<any, undefined>;

export default class Marketplace {
    contract: IMarketplace;

    constructor(
        private contractAddress: Address,
        private contractAbi: NotUndefined,
        web3: Web3,
        signerIndex: number,
        private confirmations: number | undefined = undefined
    ) {
        const signer = new providers.Web3Provider(
            web3.currentProvider as any
        ).getSigner(signerIndex);

        this.contract = new Contract(
            this.contractAddress,
            this.contractAbi,
            signer
        ) as IMarketplace;
    }

    async list(
        collectionAddress: Address,
        nftId: number | BigNumber,
        price: BigNumber | number
    ) {
        return await this.waitAndReturn(
            this.contract.list(collectionAddress, nftId, price)
        );
    }

    private async waitAndReturn(
        transactionPromise: Promise<ContractTransaction>
    ) {
        const transaction = await transactionPromise;
        await transaction.wait(this.confirmations);
        return transaction;
    }

    async isListed(collectionAddress: string, nftId: BigNumber | number) {
        return await this.contract.isListed(collectionAddress, nftId);
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
        return await (this.contract as Contract).queryFilter(eventName);
    }

    async getNftInfo(collectionAddress: Address, nftId: BigNumber | number) {
        return await this.contract.getNftInfo(collectionAddress, nftId);
    }

    async changePriceOf(
        collectionAddress: Address,
        nftId: BigNumber | number,
        newPrice: BigNumber | number
    ) {
        return await this.contract.changePriceOf(
            collectionAddress,
            nftId,
            newPrice
        );
    }

    async buy(collectionAddress: Address, nftId: number | BigNumber) {
        const nft = await this.getNftInfo(collectionAddress, nftId);
        return await this.waitAndReturn(
            this.contract.buy(collectionAddress, nftId, { value: nft.price })
        );
    }

    async makeOffer(
        collectionAddress: Address,
        nftId: number | BigNumber,
        offerPrice: number | BigNumber,
        durationInDays: number
    ) {
        return await this.waitAndReturn(
            this.contract.makeOffer(collectionAddress, nftId, durationInDays, {
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
        const offerTx = await this.contract.makeOffer(
            collectionAddress,
            nftId,
            durationInDays,
            {
                value: offerPrice,
            }
        );
        const id = await this.getOfferIdFromTransaction(offerTx);
        return { offerId: id, transaction: offerTx };
    }

    private async getOfferIdFromTransaction(
        makeOfferTransaction: ContractTransaction
    ) {
        const offerId: BigNumber = await new Promise(async (resolve) => {
            this.contract.on("OfferMade", (_, __, ___, offerId: BigNumber) => {
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
        return await this.contract.getOffer(
            collectionAddress,
            nftId,
            indexOfOfferMapping
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
        return await this.waitAndReturn(
            this.contract.cancelOffer(
                collectionAddress,
                nftId,
                indexOfOfferMapping
            )
        );
    }

    async takeOffer(
        collectionAddress: Address,
        nftId: number | BigNumber,
        indexOfOfferMapping: number | BigNumber
    ) {
        return await this.waitAndReturn(
            this.contract.takeOffer(
                collectionAddress,
                nftId,
                indexOfOfferMapping
            )
        );
    }

    async makeCounteroffer(
        collectionAddress: Address,
        nftId: BigNumber | number = 1,
        offerId: BigNumber | number = 1,
        newPrice: BigNumber | number = 1,
        durationInDays: number = 3
    ) {
        return await this.waitAndReturn(
            this.contract.makeCounteroffer(
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
        const counterofferTx = await this.contract.makeCounteroffer(
            collectionAddress,
            nftId,
            offerId,
            newPrice,
            durationInDays
        );
        const id = await this.getCounterofferIdFromTransaction(counterofferTx);
        return { counterofferId: id, transaction: counterofferTx };
    }

    async getCounterofferIdFromTransaction(
        makeCountreofferTransaction: ContractTransaction
    ) {
        const counterofferId: BigNumber = await new Promise(async (resolve) => {
            this.contract.on(
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
        return await this.contract.getCounteroffer(
            collectionAddress,
            nftId,
            offerId
        );
    }

    async takeCounteroffer(
        id: BigNumber | number,
        valueToSent: BigNumber | number = 0
    ) {
        return await this.waitAndReturn(
            this.contract.takeCounteroffer(id, { value: valueToSent })
        );
    }

    async getFusyonaFeeFor(ethersValue: BigNumber | number) {
        return await this.contract.getFusyonaFeeFor(ethersValue);
    }

    async setFeeRatioFromPercentage(percentage: number) {
        return await this.waitAndReturn(
            this.contract.setFeeRatioFromPercentage(percentage)
        );
    }

    async feeRatio() {
        return await this.contract.feeRatio();
    }

    async withdraw() {
        return await this.waitAndReturn(this.contract.withdraw());
    }

    async setFloorRatioFromPercentage(percentage: number) {
        return await this.waitAndReturn(
            this.contract.setFloorRatioFromPercentage(percentage)
        );
    }

    async floorRatio() {
        return await this.contract.floorRatio();
    }

    async fusyBenefitsAccumulated() {
        return await this.contract.fusyBenefitsAccumulated();
    }

    plotUri(receipt: ContractReceipt) {
        return this.uriScanner(receipt.transactionHash);
    }

    uriScanner(txHash: string) {
        return `https://mumbai.polygonscan.com/tx/${txHash}`;
    }
}
