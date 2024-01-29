import {
    BigNumber,
    Contract,
    ContractTransaction,
    Signer,
    providers,
} from "ethers";
import { IMarketplace } from "../typechain-types";
import { ExternalProvider, JsonRpcFetchFunc } from "@ethersproject/providers";

export type Address = string;
export type NotUndefined = Exclude<any, undefined>;
export type IMarketplaceView = Pick<
    IMarketplace,
    keyof NonTransactionFunctions<IMarketplace["functions"]>
>;
type NonTransactionFunctions<T> = Pick<
    T,
    {
        [K in keyof T]: Exclude<
            T[K],
            (...args: any[]) => Promise<ContractTransaction>
        > extends never
            ? never
            : K;
    }[keyof T]
>;

export default abstract class MarketplaceWrapper {
    protected _contract: IMarketplace;
    protected provider: providers.Web3Provider;
    protected signer?: Signer;

    constructor(
        private contractAddress: Address,
        private contractAbi: NotUndefined,
        provider: ExternalProvider | JsonRpcFetchFunc,
        private confirmations: number | undefined = undefined
    ) {
        this.provider = new providers.Web3Provider(provider);
        this._contract = new Contract(
            this.contractAddress,
            this.contractAbi
        ) as IMarketplace;

        this._withSignerIndex(0);
    }

    private _withSignerIndex(index: number) {
        this.signer = this.provider.getSigner(index);
        return this._withSigner(this.signer);
    }

    private _withSigner(signer: Signer) {
        this._contract = this._contract.connect(signer);
        return this;
    }

    withSignerIndex(index: number) {
        return this._withSignerIndex(index);
    }

    withSigner(signer: Signer) {
        return this._withSigner(signer);
    }

    get contract() {
        return this._contract;
    }

    get call() {
        return this.contract as IMarketplaceView;
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

    protected async waitAndReturn(
        transactionPromise: Promise<ContractTransaction>
    ) {
        const transaction = await transactionPromise;
        await transaction.wait(this.confirmations);
        return transaction;
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

    async changePriceOf(
        collectionAddress: Address,
        nftId: BigNumber | number,
        newPrice: BigNumber | number
    ) {
        return await this.waitAndReturn(
            this.contract.changePriceOf(collectionAddress, nftId, newPrice)
        );
    }

    async buyAtPrice(collectionAddress: Address, nftId: number | BigNumber) {
        const nft = await this.call.getNftInfo(collectionAddress, nftId);
        return await this.buy(collectionAddress, nftId, nft.price);
    }

    abstract buy(
        collectionAddress: Address,
        nftId: number | BigNumber,
        valueToSent: number | BigNumber
    ): Promise<ContractTransaction>;

    abstract makeOffer(
        collectionAddress: Address,
        nftId: number | BigNumber,
        offerPrice: number | BigNumber,
        durationInDays: number
    ): Promise<ContractTransaction>;

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

    async offersOf(collectionAddress: Address, nftId: number | BigNumber) {
        const nft = await this.call.getNftInfo(collectionAddress, nftId);
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

    async takeCounterofferAtPrice(id: BigNumber | number) {
        const counteroffer = await this.call["getCounteroffer(uint256)"](id);
        return await this.takeCounteroffer(id, counteroffer.price);
    }

    abstract takeCounteroffer(
        id: BigNumber | number,
        valueToSent: BigNumber | number
    ): Promise<ContractTransaction>;

    async setFeeRatioFromPercentage(percentage: number) {
        return await this.waitAndReturn(
            this.contract.setFeeRatioFromPercentage(percentage)
        );
    }

    async withdraw() {
        return await this.waitAndReturn(this.contract.withdraw());
    }

    async setFloorRatioFromPercentage(percentage: number) {
        return await this.waitAndReturn(
            this.contract.setFloorRatioFromPercentage(percentage)
        );
    }

    async getCounterofferFromId(id: BigNumber | number) {
        return await this.call["getCounteroffer(uint256)"](id);
    }

    async getCounterofferFromOffer(
        collection: Address,
        nftId: number | BigNumber,
        offerId: number | BigNumber
    ) {
        return await this.call["getCounteroffer(address,uint256,uint256)"](
            collection,
            nftId,
            offerId
        );
    }
}
