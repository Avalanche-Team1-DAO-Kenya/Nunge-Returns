'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ethers } from 'ethers'

interface TransactionReceiptProps {
    transactionHash?: string;
    blockNumber?: number;
    gasUsed?: string;
}

export function TransactionReceipt({ transactionHash, blockNumber, gasUsed }: TransactionReceiptProps) {
    const [explorerUrl, setExplorerUrl] = useState<string>('')

    useEffect(() => {
        if (transactionHash) {
            // Avalanche Fuji Testnet Explorer
            setExplorerUrl(`https://testnet.snowtrace.io/tx/${transactionHash}`)
        }
    }, [transactionHash])

    if (!transactionHash) {
        return null
    }

    return (
        <Card className="w-full mt-4">
            <CardHeader>
                <CardTitle>Transaction Receipt</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    <div>
                        <span className="font-semibold">Transaction Hash: </span>
                        <a 
                            href={explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 break-all"
                        >
                            {transactionHash}
                        </a>
                    </div>
                    {blockNumber && (
                        <div>
                            <span className="font-semibold">Block Number: </span>
                            {blockNumber}
                        </div>
                    )}
                    {gasUsed && (
                        <div>
                            <span className="font-semibold">Gas Used: </span>
                            {ethers.formatUnits(gasUsed, 'gwei')} Gwei
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
