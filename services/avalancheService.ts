import { Avalanche, BinTools, Buffer, BN } from '@avalabs/avalanchejs'
import { ethers } from 'ethers'

class AvalancheService {
    private avalanche: Avalanche
    private network: {
        mainnet: string
        fuji: string
    }
    private bintools: BinTools
    
    constructor() {
        this.network = {
            mainnet: 'https://api.avax.network',
            fuji: 'https://api.avax-test.network'
        }
        // Initialize with Fuji testnet by default
        this.avalanche = new Avalanche('api.avax-test.network', 443, 'https')
        this.bintools = BinTools.getInstance()
    }

    // Connect to Avalanche network (mainnet or testnet)
    public async connect(networkType: 'mainnet' | 'fuji' = 'fuji') {
        const protocol = 'https'
        const ip = networkType === 'mainnet' ? 'api.avax.network' : 'api.avax-test.network'
        const port = 443
        const chainID = networkType === 'mainnet' ? 1 : 5
        
        this.avalanche = new Avalanche(ip, port, protocol, chainID)
        return this.avalanche
    }

    // Get wallet balance
    public async getBalance(address: string) {
        try {
            const provider = new ethers.JsonRpcProvider(this.network.fuji)
            const balance = await provider.getBalance(address)
            return ethers.formatEther(balance)
        } catch (error) {
            console.error('Error getting balance:', error)
            throw error
        }
    }

    // Send AVAX
    public async sendAVAX(
        privateKey: string,
        toAddress: string,
        amount: string
    ) {
        try {
            const provider = new ethers.JsonRpcProvider(this.network.fuji)
            const wallet = new ethers.Wallet(privateKey, provider)
            
            const tx = await wallet.sendTransaction({
                to: toAddress,
                value: ethers.parseEther(amount)
            })
            
            return await tx.wait()
        } catch (error) {
            console.error('Error sending AVAX:', error)
            throw error
        }
    }

    // Create a new wallet
    public createWallet() {
        const wallet = ethers.Wallet.createRandom()
        return {
            address: wallet.address,
            privateKey: wallet.privateKey,
            mnemonic: wallet.mnemonic?.phrase
        }
    }

    // Get transaction history
    public async getTransactionHistory(address: string) {
        try {
            const provider = new ethers.JsonRpcProvider(this.network.fuji)
            const history = await provider.getHistory(address)
            return history.map(tx => ({
                hash: tx.hash,
                from: tx.from,
                to: tx.to,
                value: ethers.formatEther(tx.value),
                timestamp: tx.blockNumber // You'll need to get the actual timestamp from the block
            }))
        } catch (error) {
            console.error('Error getting transaction history:', error)
            throw error
        }
    }
}

export const avalancheService = new AvalancheService()
