'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { blockchainService } from '@/services/blockchainService'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

interface NFTViewerProps {
    pin?: string
}

export function NFTViewer({ pin }: NFTViewerProps) {
    const [nfts, setNfts] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const loadNFTs = async () => {
        if (!pin) return
        
        setLoading(true)
        try {
            const nftList = await blockchainService.getNFTsByPin(pin)
            setNfts(nftList)
        } catch (error: any) {
            console.error('Error loading NFTs:', error)
            setError(error.message || 'Failed to load NFTs')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadNFTs()
    }, [pin])

    if (loading) {
        return <div>Loading NFTs...</div>
    }

    if (error) {
        return <div className="text-red-500">Error: {error}</div>
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Your NFT Certificates</CardTitle>
            </CardHeader>
            <CardContent>
                {nfts.length === 0 ? (
                    <p>No NFT certificates found</p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Token ID</TableHead>
                                <TableHead>Date Issued</TableHead>
                                <TableHead>Transaction</TableHead>
                                <TableHead>View</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {nfts.map((nft) => (
                                <TableRow key={nft.tokenId}>
                                    <TableCell>{nft.tokenId}</TableCell>
                                    <TableCell>{nft.timestamp.toLocaleString()}</TableCell>
                                    <TableCell>
                                        <a 
                                            href={`https://testnet.snowtrace.io/tx/${nft.transactionHash}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-500 hover:underline"
                                        >
                                            View
                                        </a>
                                    </TableCell>
                                    <TableCell>
                                        <a 
                                            href={nft.uri}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-500 hover:underline"
                                        >
                                            View Certificate
                                        </a>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    )
}
