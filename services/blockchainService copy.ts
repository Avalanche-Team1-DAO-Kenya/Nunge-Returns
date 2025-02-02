// @ts-nocheck


import { ethers } from 'ethers'
import { CertificateNFTAbi, PaymentTrackerAbi } from '../types/contracts'

export class BlockchainService {
    // SessionStatus enum to match Solidity contract's FilingStatus
    static SessionStatus = {
        CREATED: 0,
        PAYMENT_RECEIVED: 1,
        COMPLETED: 2,
        FAILED: 3,
        TIMED_OUT: 4,
        PAID: 1  // Alias for payment received
    }

    static CartStatus = {
        ACTIVE: 0,
        ABANDONED: 1
    }

    private provider: ethers.JsonRpcProvider | null = null
    private paymentContract: ethers.Contract | null = null
    private certificateContract: ethers.Contract | null = null
    private organizationWallet: ethers.Wallet | null = null

    constructor() {
        // Initialize with Fuji testnet
        this.provider = new ethers.JsonRpcProvider('https://api.avax-test.network/ext/bc/C/rpc')
        this.initializeContracts()
    }

    private async initializeContracts() {
        try {
            if (!process.env.NEXT_PUBLIC_PAYMENT_CONTRACT_ADDRESS || !process.env.NEXT_PUBLIC_CERTIFICATE_CONTRACT_ADDRESS) {
                throw new Error('Contract addresses not found in environment variables');
            }

            const paymentContractAddress = process.env.NEXT_PUBLIC_PAYMENT_CONTRACT_ADDRESS;
            const certificateContractAddress = process.env.NEXT_PUBLIC_CERTIFICATE_CONTRACT_ADDRESS;

            if (!this.provider) {
                this.provider = new ethers.JsonRpcProvider('https://api.avax-test.network/ext/bc/C/rpc');
            }

            this.paymentContract = new ethers.Contract(
                paymentContractAddress,
                PaymentTrackerAbi,
                this.provider
            );

            this.certificateContract = new ethers.Contract(
                certificateContractAddress,
                CertificateNFTAbi,
                this.provider
            );

            console.log('Contracts initialized successfully');
        } catch (error) {
            console.error('Failed to initialize contracts:', error);
            throw new Error('Failed to initialize blockchain contracts');
        }
    }

    private async getOrganizationWallet() {
        if (!this.provider) throw new Error('Provider not initialized')
        if (this.organizationWallet) return this.organizationWallet

        // Use NEXT_PUBLIC prefix for client-side environment variables
        const orgPrivateKey = process.env.NEXT_PUBLIC_PRIVATE_KEY || process.env.PRIVATE_KEY
        if (!orgPrivateKey) throw new Error('Organization wallet private key not found')
        
        this.organizationWallet = new ethers.Wallet(orgPrivateKey, this.provider)
        return this.organizationWallet
    }

    async getAllLogs() {
        if (!this.paymentContract || !this.certificateContract) {
            throw new Error('Contracts not initialized')
        }

        try {
            // Get current block number
            const currentBlock = await this.provider?.getBlockNumber()
            if (!currentBlock) throw new Error('Failed to get current block number')

            // Calculate fromBlock (last 1000 blocks or genesis)
            const fromBlock = Math.max(0, currentBlock - 1000)

            // Create event filters for all events
            const sessionCreatedFilter = this.paymentContract.filters.SessionCreated()
            const sessionStatusFilter = this.paymentContract.filters.SessionStatusUpdated()
            const paymentRecordedFilter = this.paymentContract.filters.PaymentRecorded()
            const certificateIssuedFilter = this.certificateContract.filters.CertificateIssued()

            // Query all events
            const [sessions, statusUpdates, payments, certificates] = await Promise.all([
                this.paymentContract.queryFilter(sessionCreatedFilter, fromBlock, currentBlock),
                this.paymentContract.queryFilter(sessionStatusFilter, fromBlock, currentBlock),
                this.paymentContract.queryFilter(paymentRecordedFilter, fromBlock, currentBlock),
                this.certificateContract.queryFilter(certificateIssuedFilter, fromBlock, currentBlock)
            ])

            return {
                sessions: sessions.map(event => ({
                    type: 'SessionCreated',
                    kraPin: event.args?.kraPin,
                    sessionId: event.args?.sessionId,
                    amount: event.args?.amount?.toString(),
                    timestamp: new Date(Number(event.args?.timestamp) * 1000),
                    transactionHash: event.transactionHash,
                    category: 'session'
                })),
                statusUpdates: statusUpdates.map(event => ({
                    type: 'SessionStatusUpdated',
                    sessionId: event.args?.sessionId,
                    status: this.getSessionStatusString(event.args?.status),
                    timestamp: new Date(Number(event.args?.timestamp) * 1000),
                    transactionHash: event.transactionHash,
                    category: 'status'
                })),
                payments: payments.map(event => ({
                    type: 'PaymentRecorded',
                    sessionId: event.args?.sessionId,
                    paymentReference: event.args?.paymentReference,
                    timestamp: new Date(Number(event.args?.timestamp) * 1000),
                    transactionHash: event.transactionHash,
                    category: 'payment'
                })),
                certificates: certificates.map(event => ({
                    type: 'CertificateIssued',
                    tokenId: event.args?.tokenId?.toString(),
                    recipient: event.args?.recipient,
                    name: event.args?.name,
                    timestamp: new Date(Number(event.args?.issueDate) * 1000),
                    transactionHash: event.transactionHash,
                    category: 'certificate'
                }))
            }
        } catch (error) {
            console.error('Error fetching blockchain logs:', error)
            throw error
        }
    }

    getSessionStatusString(status: number): string {
        switch (status) {
            case BlockchainService.SessionStatus.CREATED:
                return 'Created'
            case BlockchainService.SessionStatus.PAYMENT_RECEIVED:
                return 'Payment Received'
            case BlockchainService.SessionStatus.COMPLETED:
                return 'Completed'
            case BlockchainService.SessionStatus.FAILED:
                return 'Failed'
            case BlockchainService.SessionStatus.TIMED_OUT:
                return 'Timed Out'
            default:
                return 'Unknown'
        }
    }

    async getCertificatesByPin(pin: string) {
        if (!this.certificateContract) throw new Error('Certificate contract not initialized')
        const tokenIds = await this.certificateContract.getCertificatesByPin(pin)
        return Promise.all(tokenIds.map(async (id: bigint) => {
            const cert = await this.certificateContract?.getCertificate(id)
            return {
                tokenId: id.toString(),
                kraPin: cert.kraPin,
                sessionId: cert.sessionId,
                issueDate: new Date(Number(cert.issueDate) * 1000),
                isValid: cert.isValid
            }
        }))
    }

    async getFilingHistory(pin: string) {
        if (!this.paymentContract) throw new Error('Payment contract not initialized')
        const history = await this.paymentContract.getFilingHistory(pin)
        return history.map((session: any) => ({
            kraPin: session.kraPin,
            amount: ethers.formatEther(session.amount),
            timestamp: new Date(Number(session.timestamp) * 1000),
            status: ['Created', 'PaymentReceived', 'Completed', 'Failed', 'TimedOut'][session.status],
            paymentReference: session.paymentReference,
            attempts: Number(session.attempts)
        }))
    }

    async getSession(sessionId: string) {
        if (!this.paymentContract) throw new Error('Payment contract not initialized')
        const session = await this.paymentContract.getSession(sessionId)
        return {
            kraPin: session.kraPin,
            amount: ethers.formatEther(session.amount),
            timestamp: new Date(Number(session.timestamp) * 1000),
            status: ['Created', 'PaymentReceived', 'Completed', 'Failed', 'TimedOut'][session.status],
            paymentReference: session.paymentReference,
            attempts: Number(session.attempts)
        }
    }

    async trackFilingSession(pin: string, amount: number) {
        try {
            if (!this.paymentContract) {
                await this.initializeContracts();
            }

            const sessionId = ethers.hexlify(ethers.randomBytes(32));
            const amountInWei = ethers.parseEther(amount.toString());

            console.log('Initializing blockchain session', { pin, amount, amountInWei });

            const feeData = await this.provider!.getFeeData();
            
            const wallet = await this.getOrganizationWallet();
            const contract = this.paymentContract!.connect(wallet);

            const tx = await contract.createSession(sessionId, pin, amountInWei, {
                maxFeePerGas: feeData.maxFeePerGas,
                maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
            });

            const receipt = await tx.wait();

            return {
                success: true,
                sessionId,
                transactionHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString()
            };
        } catch (error) {
            const errorMessage = this.getDetailedErrorMessage(error);
            console.error('Detailed error:', errorMessage);
            throw new Error(`Transaction failed: ${errorMessage}`);
        }
    }
    
    // Add this helper method for better error handling
    private getDetailedErrorMessage(error: any): string {
        if (error.code === 'CALL_EXCEPTION') {
            return 'Contract call failed - possible causes: insufficient funds, wrong method, or contract requirements not met';
        }
        if (error.code === 'INSUFFICIENT_FUNDS') {
            return 'Insufficient funds to cover gas costs';
        }
        return error.message || 'Unknown error occurred';
    }

    async createSession(sessionId: string, pin: string, amount: string) {
        if (!this.paymentContract) {
            throw new Error('Payment contract not initialized')
        }

        try {
            const wallet = await this.getOrganizationWallet()
            const contract = this.paymentContract.connect(wallet)
            
            // Validate inputs
            if (!sessionId || !pin || !amount) {
                throw new Error('Missing required parameters for creating session')
            }

            // Parse and validate amount
            const parsedAmount = ethers.parseEther(amount)
            if (parsedAmount <= BigInt(0)) {
                throw new Error('Amount must be greater than 0')
            }

            const tx = await contract.createSession(
                sessionId,
                pin,
                parsedAmount
            )
            
            const receipt = await tx.wait()
            return {
                transactionHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                status: receipt.status === 1 ? 'success' : 'failed'
            }
        } catch (error) {
            console.error('Error creating session:', error)
            throw new Error(`Failed to create session: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    async recordPayment(sessionId: string, paymentReference: string) {
        const wallet = await this.getOrganizationWallet()
        const contract = this.paymentContract?.connect(wallet)
        const tx = await contract?.recordPayment(sessionId, paymentReference)
        return tx.wait()
    }

    async checkPaymentTimeout(sessionId: string) {
        const wallet = await this.getOrganizationWallet()
        const contract = this.paymentContract?.connect(wallet)
        const tx = await contract?.checkPaymentTimeout(sessionId)
        return tx.wait()
    }

    async reinitializePayment(sessionId: string) {
        const wallet = await this.getOrganizationWallet()
        const contract = this.paymentContract?.connect(wallet)
        const tx = await contract?.reinitializePayment(sessionId)
        return tx.wait()
    }

    async mintCertificate(to: string, pin: string, sessionId: string, uri: string) {
        const wallet = await this.getOrganizationWallet()
        const contract = this.certificateContract?.connect(wallet)
        const tx = await contract?.safeMint(to, pin, sessionId, uri)
        return tx.wait()
    }

    async setCertificateValidity(tokenId: string, isValid: boolean) {
        const wallet = await this.getOrganizationWallet()
        const contract = this.certificateContract?.connect(wallet)
        const tx = await contract?.setCertificateValidity(tokenId, isValid)
        return tx.wait()
    }

    // Add method for user carts (mock implementation)
    async getUserCarts(userId: string) {
        console.log('Fetching carts for user:', userId)
        // Mock implementation, replace with actual blockchain logic
        return [
            {
                id: `cart-${userId}-1`,
                items: [],
                total: '0',
                status: 'pending'
            }
        ]
    }

    // Add method to submit blockchain transaction
    async submitTransaction(data: {
        sessionId: string, 
        pin: string, 
        amount: string, 
        paymentReference?: string
    }) {
        try {
            // Create session
            const sessionTx = await this.createSession(
                data.sessionId, 
                data.pin, 
                data.amount
            )

            // If payment reference exists, record payment
            if (data.paymentReference) {
                await this.recordPayment(
                    data.sessionId, 
                    data.paymentReference
                )
            }

            // Update session status to completed
            await this.updateSessionStatus(data.sessionId, 2) // Assuming 2 is 'Completed'

            console.log('Blockchain transaction submitted successfully', {
                sessionId: data.sessionId,
                pin: data.pin,
                amount: data.amount
            })

            return {
                success: true,
                sessionId: data.sessionId
            }
        } catch (error) {
            console.error('Blockchain transaction failed:', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            }
        }
    }

    async getNFTsByPin(pin: string) {
        try {
            if (!this.certificateContract) {
                await this.initializeContracts();
            }

            if (!this.certificateContract) {
                throw new Error('Certificate contract not initialized');
            }

            // Set up filter for events
            const filter = {
                fromBlock: -1000,
                toBlock: 'latest'
            };

            // Get all certificate events
            const events = await this.certificateContract.queryFilter('CertificateIssued', filter.fromBlock, filter.toBlock);

            // Filter and map the events
            const nfts = await Promise.all(events
                .filter(event => event.args && event.args.pin === pin)
                .map(async (event) => {
                    const args = event.args || {};
                    const tokenId = args.tokenId?.toString();
                    
                    if (!tokenId) return null;

                    try {
                        // Get certificate details
                        const certificate = await this.certificateContract!.getCertificate(tokenId);
                        
                        return {
                            tokenId,
                            recipient: args.recipient,
                            pin: args.pin,
                            uri: certificate.uri,
                            isValid: certificate.isValid,
                            timestamp: new Date(Number(certificate.timestamp) * 1000).toISOString()
                        };
                    } catch (error) {
                        console.error(`Error fetching certificate ${tokenId}:`, error);
                        return null;
                    }
                }));

            // Filter out null values and return valid NFTs
            return nfts.filter(nft => nft !== null);
        } catch (error) {
            console.error('Error in getNFTsByPin:', error);
            throw error;
        }
    }

    async issueCertificate(recipient: string, pin: string, name: string) {
        if (!this.certificateContract) {
            throw new Error('Certificate contract not initialized')
        }

        try {
            const courseName = "KRA Tax Return Filing"
            const issuerName = "KRA Digital Services"
            const tokenURI = `https://kra.go.ke/certificates/${pin}`

            const tx = await this.certificateContract.issueCertificate(
                recipient,
                courseName,
                name,
                issuerName,
                tokenURI
            )
            await tx.wait()

            return {
                transactionHash: tx.hash
            }
        } catch (error) {
            console.error('Error issuing certificate:', error)
            throw error
        }
    }

    // Add method to handle cart abandonment
    async abandonCart(cartId: string, reason: string) {
        if (!this.paymentContract) throw new Error('Payment contract not initialized')
        
        try {
            const tx = await this.paymentContract.abandonCart(cartId, reason)
            await tx.wait()
            
            return {
                success: true,
                transactionHash: tx.hash
            }
        } catch (error) {
            console.error('Error abandoning cart:', error)
            throw error
        }
    }

    // Add method to check cart status
    async getCartStatus(cartId: string) {
        if (!this.paymentContract) throw new Error('Payment contract not initialized')
        
        try {
            const status = await this.paymentContract.getCartStatus(cartId)
            return {
                status: BlockchainService.CartStatus[status] || 'Unknown',
                isAbandoned: status === 1
            }
        } catch (error) {
            console.error('Error getting cart status:', error)
            throw error
        }
    }
}

export const blockchainService = new BlockchainService()
export const { SessionStatus, CartStatus } = BlockchainService
