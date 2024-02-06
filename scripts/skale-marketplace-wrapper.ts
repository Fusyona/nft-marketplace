import {
    ExternalProvider,
    JsonRpcFetchFunc,
    JsonRpcSigner,
} from "@ethersproject/providers";
import { Address, NotUndefined } from "./marketplace-wrapper";
import Erc20PaymentMarketplaceWrapper from "./erc20-payment-marketplace-wrapper";
import {
    Contract,
    ContractTransaction,
    Signer,
    Wallet,
    providers,
} from "ethers";
import { NebulaFaucet } from "../typechain-types";
import { waitAndReturn } from "../utils/transactions";

export default class SkaleMarketplaceWrapper {
    private erc20MarketplaceWrapper: Erc20PaymentMarketplaceWrapper;
    private provider: providers.Web3Provider;
    private faucet: NebulaFaucet;
    private signer!: JsonRpcSigner;
    private faucetCaller: Wallet;

    constructor(
        marketplaceAddress: Address,
        marketplaceAbi: NotUndefined,
        erc20Address: Address,
        erc20Abi: NotUndefined,
        faucetAddress: Address,
        faucetCallerPrivateKey: string,
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
        this.faucet = this.getFaucetContract(faucetAddress);

        this.faucetCaller = new Wallet(faucetCallerPrivateKey, this.provider);

        this.withSignerIndex(0);
    }

    private getFaucetContract(faucetAddress: Address): NebulaFaucet {
        return new Contract(
            faucetAddress,
            [
                "function pay(address payable receiver) external",
                "function getAmount() external view returns (uint256)",
            ],
            this.provider
        ) as NebulaFaucet;
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
        await this.ensureSFuel();
        return onMarketplace(this.erc20MarketplaceWrapper);
    }

    private async ensureSFuel() {
        await this.fundFaucetCallerIfNecessary();
        await this.fundUserIfNecessary();
    }

    private async fundFaucetCallerIfNecessary() {
        const faucetCallerBalance = await this.faucetCaller.getBalance();

        const amountToClaim = await this.faucet.getAmount();
        const minFaucetCallerBalance = amountToClaim.div(100);

        if (faucetCallerBalance.lt(minFaucetCallerBalance))
            await this.getSFuelFor(this.faucetCaller);
    }

    private async getSFuelFor(beneficiary: Wallet | Signer) {
        await this.waitAndReturn(
            this.faucet
                .connect(this.faucetCaller)
                .pay(await beneficiary.getAddress())
        );
    }

    protected async waitAndReturn(
        transactionPromise: Promise<ContractTransaction>
    ) {
        await waitAndReturn(transactionPromise, this.confirmations);
    }

    private async fundUserIfNecessary() {
        const userBalance = await this.signer.getBalance();
        const amountToClaim = await this.faucet.getAmount();
        if (userBalance.lt(amountToClaim)) {
            await this.getSFuelFor(this.signer);
        }
    }
}
