import {
    ExternalProvider,
    JsonRpcFetchFunc,
    JsonRpcSigner,
} from "@ethersproject/providers";
import { Address, NotUndefined } from "./marketplace-wrapper";
import Erc20PaymentMarketplaceWrapper from "./erc20-payment-marketplace-wrapper";
import { BigNumber, Signer, Wallet, providers } from "ethers";
import { waitAndReturn } from "../utils/transactions";

const SFUEL_ENOUGH_FOR_1K_TRXS = BigNumber.from("10000000000000");

export default class SkaleMarketplaceWrapper {
    private erc20MarketplaceWrapper: Erc20PaymentMarketplaceWrapper;
    private provider: providers.Web3Provider;
    private signer!: JsonRpcSigner;
    private funder: Wallet;

    fundingAmount = SFUEL_ENOUGH_FOR_1K_TRXS;

    constructor(
        marketplaceAddress: Address,
        marketplaceAbi: NotUndefined,
        erc20Address: Address,
        erc20Abi: NotUndefined,
        funderPrivateKey: string,
        provider: ExternalProvider | JsonRpcFetchFunc,
        private confirmations: number | undefined = undefined
    ) {
        this.provider = new providers.Web3Provider(provider);
        this.erc20MarketplaceWrapper = new Erc20PaymentMarketplaceWrapper(
            marketplaceAddress,
            marketplaceAbi,
            erc20Address,
            erc20Abi,
            provider,
            confirmations
        );
        this.funder = new Wallet(funderPrivateKey, this.provider);

        this.withSignerIndex(0);
    }

    withSignerIndex(index: number) {
        this.erc20MarketplaceWrapper.withSignerIndex(index);
        this.signer = this.provider.getSigner(index);

        return this;
    }

    withSigner(signer: JsonRpcSigner) {
        this.erc20MarketplaceWrapper.withSigner(signer);
        this.signer = signer;

        return this;
    }

    async ensureSFuelAndDo<T>(
        onMarketplace: (_: Erc20PaymentMarketplaceWrapper) => Promise<T>
    ) {
        await this.fundUserIfNecessary();
        return onMarketplace(this.erc20MarketplaceWrapper);
    }

    private async fundUserIfNecessary() {
        const userBalance = await this.signer.getBalance();
        const threshold = this.fundingAmount.div(10);
        if (userBalance.lt(threshold)) {
            await this.getSFuelFor(this.signer);
        }
    }

    private async getSFuelFor(beneficiary: Wallet | Signer) {
        const currentBalance = await beneficiary.getBalance();
        const sFuelToSend = this.fundingAmount.sub(currentBalance);
        await waitAndReturn(
            this.funder.sendTransaction({
                to: await beneficiary.getAddress(),
                value: sFuelToSend,
            }),
            this.confirmations
        );
    }
}
