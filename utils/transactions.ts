import { ContractTransaction } from "ethers";

export async function waitAndReturn(
    transactionPromise: Promise<ContractTransaction>,
    confirmations: number | undefined = undefined
) {
    const transaction = await transactionPromise;
    await transaction.wait(confirmations);
    return transaction;
}
